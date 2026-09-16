import type { Order, LineItem, PrintStatus } from "../types/thermoslip";

export const GET_READY_TO_PACK_ORDERS_QUERY = `#graphql
query GetReadyToPackOrders($cursor: String) {
  orders(
    first: 50
    after: $cursor
    query: "status:open AND (fulfillment_status:unfulfilled OR fulfillment_status:partial) AND (financial_status:paid OR financial_status:partially_refunded)"
    sortKey: CREATED_AT
    reverse: false
  ) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      name
      createdAt
      note
      shippingLine {
        title
      }
      shippingAddress {
        formatted
        city
        country
      }
      printStatus: metafield(
        namespace: "$app"
        key: "print_status"
      ) {
        value
      }
      lineItems(first: 15) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          title
          variantTitle
          sku
          quantity
          currentQuantity
          unfulfilledQuantity
          refundableQuantity
          requiresShipping
        }
      }
    }
  }
}
`;

export interface RawLineItem {
  id: string;
  title: string;
  variantTitle?: string | null;
  sku?: string | null;
  quantity: number;
  currentQuantity?: number | null;
  unfulfilledQuantity: number;
  refundableQuantity?: number | null;
  requiresShipping?: boolean | null;
}

export interface RawOrder {
  id: string;
  name: string;
  createdAt: string;
  note?: string | null;
  shippingLine?: {
    title?: string | null;
  } | null;
  shippingAddress?: {
    formatted?: string[] | null;
    city?: string | null;
    country?: string | null;
  } | null;
  printStatus?: {
    value?: string | null;
  } | null;
  lineItems?: {
    pageInfo?: {
      hasNextPage: boolean;
      endCursor?: string | null;
    } | null;
    nodes?: RawLineItem[] | null;
  } | null;
}

export interface GraphQLCost {
  requestedQueryCost: number;
  actualQueryCost?: number;
  throttleStatus?: {
    maximumAvailable: number;
    currentlyAvailable: number;
    restoreRate: number;
  };
}

export interface OrdersQueryResult {
  orders: Order[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
  cost?: GraphQLCost;
}

/**
 * Computes quantityToPack for a given line item.
 *
 * Rules:
 * 1. Non-physical items (digital goods, tips, gift cards with requiresShipping === false) -> 0.
 * 2. Defensively capped by Math.min(unfulfilledQuantity, refundableQuantity):
 *    - unfulfilledQuantity: units remaining to be fulfilled in fulfillment orders.
 *    - refundableQuantity: units that have not been refunded.
 * 3. Never negative (Math.max(0, ...)).
 */
export function computeQuantityToPack(item: {
  requiresShipping?: boolean | null;
  unfulfilledQuantity?: number | null;
  refundableQuantity?: number | null;
  quantity?: number | null;
}): number {
  if (!item.requiresShipping) {
    return 0;
  }

  const unfulfilled = item.unfulfilledQuantity ?? 0;
  // If refundableQuantity is null/undefined (e.g. mock or special items), fall back to item.quantity or unfulfilled
  const refundable = item.refundableQuantity ?? (item.quantity ?? unfulfilled);

  return Math.max(0, Math.min(unfulfilled, refundable));
}

/**
 * Transforms a raw GraphQL order into the clean domain Order model.
 * Returns null if the order has no packable items AND has no further unloaded items.
 */
export function transformOrder(rawOrder: RawOrder): Order | null {
  const lineItemsData = rawOrder.lineItems?.nodes || [];
  const hasMoreItems = Boolean(rawOrder.lineItems?.pageInfo?.hasNextPage);

  const packableItems: LineItem[] = [];

  for (const rawItem of lineItemsData) {
    const quantityToPack = computeQuantityToPack(rawItem);
    if (quantityToPack > 0) {
      packableItems.push({
        id: rawItem.id,
        title: rawItem.title,
        variantTitle: rawItem.variantTitle || null,
        sku: rawItem.sku || null,
        quantity: rawItem.quantity,
        currentQuantity: rawItem.currentQuantity ?? undefined,
        unfulfilledQuantity: rawItem.unfulfilledQuantity,
        refundableQuantity: rawItem.refundableQuantity ?? undefined,
        requiresShipping: Boolean(rawItem.requiresShipping),
        quantityToPack,
      });
    }
  }

  // Ghost order guard: if all loaded items have 0 packable units AND there are no further items,
  // exclude the order from Ready to Pack queue.
  // CRITICAL: If hasMoreItems is true, we DO NOT discard the order even if the first 15 items had 0 packable units.
  if (packableItems.length === 0 && !hasMoreItems) {
    return null;
  }

  const printStatus: PrintStatus =
    rawOrder.printStatus?.value === "printed" ? "printed" : null;

  return {
    id: rawOrder.id,
    name: rawOrder.name,
    createdAt: rawOrder.createdAt,
    note: rawOrder.note || null,
    shippingMethod: rawOrder.shippingLine?.title || null,
    shippingAddress: rawOrder.shippingAddress
      ? {
          formatted: rawOrder.shippingAddress.formatted || [],
          city: rawOrder.shippingAddress.city || null,
          country: rawOrder.shippingAddress.country || null,
        }
      : null,
    lineItems: packableItems,
    hasMoreItems,
    printStatus,
    warnings: [],
  };
}

/**
 * Executes the GetReadyToPackOrders GraphQL query via Shopify Admin API.
 */
export async function getReadyToPackOrders(
  admin: { graphql: (query: string, options?: any) => Promise<Response> },
  cursor?: string | null
): Promise<OrdersQueryResult> {
  const response = await admin.graphql(GET_READY_TO_PACK_ORDERS_QUERY, {
    variables: {
      cursor: cursor || null,
    },
    headers: {
      "Shopify-GraphQL-Cost-Debug": "1",
    },
  });

  const json: any = await response.json();

  if (json.errors) {
    console.error("[Orders] GraphQL Errors:", json.errors);
    throw new Error(`Failed to fetch orders: ${json.errors.map((e: any) => e.message).join(", ")}`);
  }

  const data = json.data?.orders;
  const pageInfo = {
    hasNextPage: Boolean(data?.pageInfo?.hasNextPage),
    endCursor: (data?.pageInfo?.endCursor as string | null) || null,
  };

  const rawNodes: RawOrder[] = data?.nodes || [];
  const orders: Order[] = [];

  for (const raw of rawNodes) {
    const transformed = transformOrder(raw);
    if (transformed) {
      orders.push(transformed);
    }
  }

  const cost = json.extensions?.cost as GraphQLCost | undefined;
  if (cost) {
    console.log(
      `[GraphQL Cost] requested: ${cost.requestedQueryCost}, actual: ${cost.actualQueryCost}, available: ${cost.throttleStatus?.currentlyAvailable}/${cost.throttleStatus?.maximumAvailable} (restore: ${cost.throttleStatus?.restoreRate}/s)`
    );
  }

  return {
    orders,
    pageInfo,
    cost,
  };
}
