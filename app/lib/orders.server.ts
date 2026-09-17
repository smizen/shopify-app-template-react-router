import type { Order, LineItem, PrintStatus, Settings } from "../types/thermoslip";
import { DEFAULT_SETTINGS } from "../types/thermoslip";
import { computePackingWarnings } from "./warnings";

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
      customer {
        firstName
        lastName
      }
      shippingLine {
        title
      }
      shippingAddress {
        name
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

export const GET_ORDER_REMAINING_LINE_ITEMS_QUERY = `#graphql
query GetOrderRemainingLineItems($id: ID!, $cursor: String) {
  order(id: $id) {
    lineItems(first: 250, after: $cursor) {
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
`;

// ─── Print Route Queries ────────────────────────────────────────────────────

/**
 * Fetches multiple orders by GID array using the polymorphic `nodes` field.
 * Uses an inline fragment `... on Order` to access Order-specific fields.
 * lineItems is capped at 50 per batch request; full pagination is done
 * per-order via fetchRemainingLineItems if hasNextPage is true.
 *
 * Max 20 IDs per call — kept small to respect the 1000-point GraphQL cost cap.
 */
export const GET_ORDERS_BY_IDS_QUERY = `#graphql
query GetOrdersByIds($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Order {
      id
      name
      createdAt
      note
      customer {
        firstName
        lastName
      }
      shippingAddress {
        name
        formatted
        address1
        address2
        city
        province
        zip
        country
      }
      shippingLine {
        title
      }
      printStatus: metafield(namespace: "$app", key: "print_status") {
        value
      }
      lineItems(first: 50) {
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

/** Fetches the store name for use on packing slip headers. */
export const GET_SHOP_NAME_QUERY = `#graphql
query GetShopName {
  shop {
    name
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
  customer?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
  shippingLine?: {
    title?: string | null;
  } | null;
  shippingAddress?: {
    name?: string | null;
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
 * Fetches remaining line items when hasMoreItems is true on an order.
 * Ensures complete analysis for MULTI_QTY without omission.
 */
export async function fetchRemainingLineItems(
  admin: { graphql: (query: string, options?: any) => Promise<Response> },
  orderId: string,
  startCursor?: string | null
): Promise<RawLineItem[]> {
  const allExtra: RawLineItem[] = [];
  let currentCursor = startCursor || null;
  let hasNext = true;

  while (hasNext) {
    const res = await admin.graphql(GET_ORDER_REMAINING_LINE_ITEMS_QUERY, {
      variables: {
        id: orderId,
        cursor: currentCursor,
      },
    });
    const json: any = await res.json();
    if (json.errors || !json.data?.order?.lineItems) {
      console.warn(
        `[Orders] Failed to fetch remaining items for order ${orderId}:`,
        json.errors
      );
      break;
    }
    const nodes: RawLineItem[] = json.data.order.lineItems.nodes || [];
    allExtra.push(...nodes);
    hasNext = Boolean(json.data.order.lineItems.pageInfo?.hasNextPage);
    currentCursor = json.data.order.lineItems.pageInfo?.endCursor || null;
    if (!currentCursor) break;
  }

  return allExtra;
}

/**
 * Transforms a raw GraphQL order into the clean domain Order model.
 * Returns null if the order has no packable items AND has no further unloaded items.
 * Accepts optional extraLineItems fetched when hasMoreItems is true to ensure
 * MULTI_QTY warning evaluates across all lines of the order.
 */
export function transformOrder(
  rawOrder: RawOrder,
  extraLineItems?: RawLineItem[]
): Order | null {
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

  const customerName =
    rawOrder.shippingAddress?.name?.trim() ||
    [rawOrder.customer?.firstName, rawOrder.customer?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Customer";

  // Build items list for warnings calculation including extra line items (16+)
  const allItemsForWarnings = [
    ...packableItems,
    ...(extraLineItems || []).map((item) => ({
      unfulfilledQuantity: item.unfulfilledQuantity,
      quantityToPack: computeQuantityToPack(item),
    })),
  ];

  const warningInput = {
    lineItems: allItemsForWarnings,
    note: rawOrder.note || null,
    shippingMethod: rawOrder.shippingLine?.title || null,
  };

  return {
    id: rawOrder.id,
    name: rawOrder.name,
    createdAt: rawOrder.createdAt,
    customerName,
    shippingAddress: rawOrder.shippingAddress
      ? {
          name: rawOrder.shippingAddress.name || null,
          formatted: rawOrder.shippingAddress.formatted || [],
          city: rawOrder.shippingAddress.city || null,
          country: rawOrder.shippingAddress.country || null,
        }
      : null,
    hasMoreItems,
    printStatus,
    lineItems: packableItems,
    note: warningInput.note,
    shippingMethod: warningInput.shippingMethod,
    warnings: computePackingWarnings(warningInput),
  };
}

/**
 * Executes the GetReadyToPackOrders GraphQL query via Shopify Admin API.
 * Automatically fetches remaining line items for any order with hasMoreItems === true
 * so that packing warnings (MULTI_QTY) are evaluated across all order lines.
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

  // Concurrently fetch remaining line items for orders where hasMoreItems === true
  const nodesWithExtra = await Promise.all(
    rawNodes.map(async (raw) => {
      let extraItems: RawLineItem[] = [];
      if (raw.lineItems?.pageInfo?.hasNextPage) {
        try {
          extraItems = await fetchRemainingLineItems(
            admin,
            raw.id,
            raw.lineItems.pageInfo.endCursor
          );
        } catch (err) {
          console.error(`[Orders] Failed fetching remaining items for order ${raw.id}:`, err);
        }
      }
      return { raw, extraItems };
    })
  );

  const orders: Order[] = [];
  for (const { raw, extraItems } of nodesWithExtra) {
    const transformed = transformOrder(raw, extraItems);
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

// ─── Print Route Helpers ─────────────────────────────────────────────────────

const BATCH_SIZE = 20;
const MAX_ORDER_IDS = 50;
const SHOPIFY_ORDER_GID_PREFIX = "gid://shopify/Order/";

export interface PrintOrdersResult {
  orders: Order[];
  shopName: string;
  settings: Settings;
}

/**
 * Validates, deduplicates, and caps order IDs for the print route.
 * Throws a Response (400) if the list is empty, exceeds 50, or contains no valid GIDs.
 *
 * Returns ordered unique valid GIDs preserving the original selection order.
 */
export function validateAndDedupeOrderIds(rawIds: string[]): string[] {
  const uniqueIds = [...new Set(rawIds)];

  if (uniqueIds.length === 0) {
    throw new Response("No order IDs provided", { status: 400 });
  }

  if (uniqueIds.length > MAX_ORDER_IDS) {
    throw new Response(
      `Too many orders selected (max ${MAX_ORDER_IDS}, got ${uniqueIds.length})`,
      { status: 400 }
    );
  }

  const validIds = uniqueIds.filter((id) => id.startsWith(SHOPIFY_ORDER_GID_PREFIX));

  if (validIds.length === 0) {
    throw new Response("No valid Shopify Order GIDs provided", { status: 400 });
  }

  return validIds;
}

/**
 * Fetches the store name from the Shopify Admin API.
 * Returns a fallback empty string on error (non-blocking).
 */
export async function getShopName(
  admin: { graphql: (query: string, options?: any) => Promise<Response> }
): Promise<string> {
  try {
    const res = await admin.graphql(GET_SHOP_NAME_QUERY);
    const json: any = await res.json();
    return json.data?.shop?.name ?? "";
  } catch {
    return "";
  }
}

/**
 * Fetches full Order data for a set of validated GIDs.
 *
 * Architecture:
 * - Batches IDs in groups of BATCH_SIZE (20) to respect the 1000-point GraphQL cost cap.
 * - Uses `nodes(ids: [...]) { ... on Order { ... } }` inline fragment.
 * - lineItems fetched with first: 50; paginated per-order if hasNextPage to guarantee completeness.
 * - Null nodes (deleted/invalid orders) and non-Order types are silently skipped.
 * - Final list is reordered to match the original selection order.
 */
export async function getOrdersByIds(
  admin: { graphql: (query: string, options?: any) => Promise<Response> },
  validatedIds: string[]
): Promise<Order[]> {
  const fetchedOrders: Order[] = [];

  // Process in batches to respect GraphQL cost limits
  for (let i = 0; i < validatedIds.length; i += BATCH_SIZE) {
    const batchIds = validatedIds.slice(i, i + BATCH_SIZE);

    const res = await admin.graphql(GET_ORDERS_BY_IDS_QUERY, {
      variables: { ids: batchIds },
      headers: { "Shopify-GraphQL-Cost-Debug": "1" },
    });
    const json: any = await res.json();

    if (json.errors) {
      console.error("[Print] GraphQL errors fetching orders by IDs:", json.errors);
      throw new Error(
        `Failed to fetch orders: ${json.errors.map((e: any) => e.message).join(", ")}`
      );
    }

    const cost = json.extensions?.cost;
    if (cost) {
      console.log(
        `[Print GraphQL Cost] batch ${i / BATCH_SIZE + 1}: requested=${cost.requestedQueryCost}, actual=${cost.actualQueryCost}, available=${cost.throttleStatus?.currentlyAvailable}/${cost.throttleStatus?.maximumAvailable}`
      );
    }

    const nodes: any[] = json.data?.nodes ?? [];

    // Paginate lineItems per order when hasNextPage is true
    const rawOrdersWithExtra = await Promise.all(
      nodes.map(async (node) => {
        // nodes() returns null for deleted/inaccessible IDs, and non-Order types
        // won't have the `id` field from the Order inline fragment.
        if (!node || typeof node !== "object" || !node.id) {
          return null;
        }

        const raw = node as RawOrder;
        let extraItems: RawLineItem[] = [];

        if (raw.lineItems?.pageInfo?.hasNextPage) {
          try {
            extraItems = await fetchRemainingLineItems(
              admin,
              raw.id,
              raw.lineItems.pageInfo.endCursor
            );
          } catch (err) {
            console.error(
              `[Print] Failed paginating lineItems for order ${raw.id}:`,
              err
            );
            // Non-blocking: print with what we have, but log clearly
          }
        }

        return { raw, extraItems };
      })
    );

    for (const item of rawOrdersWithExtra) {
      if (!item) continue;

      // For the print route, we must include ALL line items in the rendered slip.
      // Merge extra paginated items into raw.lineItems.nodes so that transformOrder
      // builds a complete LineItem[] — not just the first 50.
      // We also clear hasNextPage to false since we've fully paginated.
      const mergedRaw: RawOrder =
        item.extraItems.length > 0
          ? {
              ...item.raw,
              lineItems: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [
                  ...(item.raw.lineItems?.nodes ?? []),
                  ...item.extraItems,
                ],
              },
            }
          : item.raw;

      const order = transformOrder(mergedRaw);
      if (order) {
        fetchedOrders.push(order);
      }
    }
  }

  // Preserve selection order: user chose the order intentionally.
  // GraphQL may return nodes in a different order.
  const orderById = new Map(fetchedOrders.map((o) => [o.id, o]));
  return validatedIds.map((id) => orderById.get(id)).filter(Boolean) as Order[];
}
