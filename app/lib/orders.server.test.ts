import { describe, it, expect, vi } from "vitest";
import {
  computeQuantityToPack,
  transformOrder,
  fetchRemainingLineItems,
  type RawOrder,
  type RawLineItem,
} from "./orders.server";

describe("orders.server — computeQuantityToPack", () => {
  it("returns 0 for non-physical items (requiresShipping === false)", () => {
    // E.g. Gift cards, tips, donations, digital goods
    const qty = computeQuantityToPack({
      requiresShipping: false,
      unfulfilledQuantity: 2,
      refundableQuantity: 2,
      quantity: 2,
    });
    expect(qty).toBe(0);
  });

  it("handles normal unfulfilled items (no refunds)", () => {
    const qty = computeQuantityToPack({
      requiresShipping: true,
      unfulfilledQuantity: 3,
      refundableQuantity: 3,
      quantity: 3,
    });
    expect(qty).toBe(3);
  });

  it("handles partial fulfillment", () => {
    // Ordered: 4, Fulfilled: 2, Remaining unfulfilled: 2
    const qty = computeQuantityToPack({
      requiresShipping: true,
      unfulfilledQuantity: 2,
      refundableQuantity: 4, // 4 can still technically be refunded, but only 2 remain unfulfilled
      quantity: 4,
    });
    expect(qty).toBe(2);
  });

  it("handles refund with restock before shipping", () => {
    // Ordered: 3. 1 was refunded and restocked/cancelled before shipping.
    // unfulfilledQuantity is decremented to 2, refundableQuantity is 2.
    const qty = computeQuantityToPack({
      requiresShipping: true,
      unfulfilledQuantity: 2,
      refundableQuantity: 2,
      quantity: 3,
    });
    expect(qty).toBe(2);
  });

  it("handles refund without restock before shipping", () => {
    // Ordered: 3. 1 was refunded WITHOUT restock.
    // If Shopify unfulfilledQuantity still reports 3, refundableQuantity is capped at 2.
    // Math.min(3, 2) prevents over-packing the refunded unit!
    const qty = computeQuantityToPack({
      requiresShipping: true,
      unfulfilledQuantity: 3,
      refundableQuantity: 2,
      quantity: 3,
    });
    expect(qty).toBe(2);
  });

  it("handles refund after fulfillment (customer return)", () => {
    // Ordered: 2. Both 2 fulfilled. 1 refunded later as return.
    // unfulfilledQuantity: 0. refundableQuantity: 1.
    // Math.min(0, 1) = 0. Nothing left to pack!
    const qty = computeQuantityToPack({
      requiresShipping: true,
      unfulfilledQuantity: 0,
      refundableQuantity: 1,
      quantity: 2,
    });
    expect(qty).toBe(0);
  });

  it("handles entire order refund before shipping", () => {
    // Ordered: 2. Both refunded. refundableQuantity = 0.
    const qty = computeQuantityToPack({
      requiresShipping: true,
      unfulfilledQuantity: 2,
      refundableQuantity: 0,
      quantity: 2,
    });
    expect(qty).toBe(0);
  });

  it("handles order edit where line items are reduced", () => {
    // Order was edited: quantity changed, unfulfilled = 1, refundable = 1
    const qty = computeQuantityToPack({
      requiresShipping: true,
      unfulfilledQuantity: 1,
      refundableQuantity: 1,
      quantity: 2,
    });
    expect(qty).toBe(1);
  });
});

describe("orders.server — transformOrder", () => {
  it("filters out line items with quantityToPack === 0", () => {
    const raw: RawOrder = {
      id: "gid://shopify/Order/1",
      name: "#1001",
      createdAt: "2026-09-16T10:00:00Z",
      lineItems: {
        pageInfo: { hasNextPage: false },
        nodes: [
          {
            id: "gid://shopify/LineItem/1",
            title: "Physical T-Shirt",
            requiresShipping: true,
            quantity: 2,
            unfulfilledQuantity: 2,
            refundableQuantity: 2,
          },
          {
            id: "gid://shopify/LineItem/2",
            title: "Tip / Donation",
            requiresShipping: false,
            quantity: 1,
            unfulfilledQuantity: 1,
            refundableQuantity: 1,
          },
          {
            id: "gid://shopify/LineItem/3",
            title: "Already Fulfilled Cap",
            requiresShipping: true,
            quantity: 1,
            unfulfilledQuantity: 0,
            refundableQuantity: 1,
          },
        ],
      },
    };

    const order = transformOrder(raw);
    expect(order).not.toBeNull();
    expect(order?.lineItems).toHaveLength(1);
    expect(order?.lineItems[0].title).toBe("Physical T-Shirt");
    expect(order?.lineItems[0].quantityToPack).toBe(2);
  });

  it("excludes ghost orders where all loaded items have quantityToPack === 0 and !hasMoreItems", () => {
    const raw: RawOrder = {
      id: "gid://shopify/Order/2",
      name: "#1002",
      createdAt: "2026-09-16T10:00:00Z",
      lineItems: {
        pageInfo: { hasNextPage: false },
        nodes: [
          {
            id: "gid://shopify/LineItem/10",
            title: "Fully Refunded Mug",
            requiresShipping: true,
            quantity: 1,
            unfulfilledQuantity: 1,
            refundableQuantity: 0,
          },
          {
            id: "gid://shopify/LineItem/11",
            title: "Digital E-Book",
            requiresShipping: false,
            quantity: 1,
            unfulfilledQuantity: 1,
            refundableQuantity: 1,
          },
        ],
      },
    };

    const order = transformOrder(raw);
    expect(order).toBeNull();
  });

  it("preserves an order if loaded items have 0 packable units BUT hasMoreItems is true", () => {
    // E.g. First 15 items were gift cards or fulfilled, but more items exist on the next page
    const raw: RawOrder = {
      id: "gid://shopify/Order/3",
      name: "#1003",
      createdAt: "2026-09-16T10:00:00Z",
      lineItems: {
        pageInfo: { hasNextPage: true, endCursor: "cursor_15" },
        nodes: [
          {
            id: "gid://shopify/LineItem/20",
            title: "Fulfilled item 1",
            requiresShipping: true,
            quantity: 1,
            unfulfilledQuantity: 0,
            refundableQuantity: 1,
          },
        ],
      },
    };

    const order = transformOrder(raw);
    expect(order).not.toBeNull();
    expect(order?.hasMoreItems).toBe(true);
    expect(order?.lineItems).toHaveLength(0);
  });

  it("extracts printStatus correctly from $app:print_status metafield", () => {
    const printedOrderRaw: RawOrder = {
      id: "gid://shopify/Order/4",
      name: "#1004",
      createdAt: "2026-09-16T10:00:00Z",
      printStatus: { value: "printed" },
      lineItems: {
        pageInfo: { hasNextPage: false },
        nodes: [
          {
            id: "gid://shopify/LineItem/30",
            title: "Hoodie",
            requiresShipping: true,
            quantity: 1,
            unfulfilledQuantity: 1,
            refundableQuantity: 1,
          },
        ],
      },
    };

    const order = transformOrder(printedOrderRaw);
    expect(order?.printStatus).toBe("printed");

    const unprintedRaw: RawOrder = {
      ...printedOrderRaw,
      id: "gid://shopify/Order/5",
      name: "#1005",
      printStatus: null,
    };
    const unprintedOrder = transformOrder(unprintedRaw);
    expect(unprintedOrder?.printStatus).toBeNull();
  });

  it("resolves customerName prioritizing shippingAddress.name, then customer names, then 'Customer'", () => {
    const baseLineItems = {
      pageInfo: { hasNextPage: false },
      nodes: [
        {
          id: "gid://shopify/LineItem/40",
          title: "Book",
          requiresShipping: true,
          quantity: 1,
          unfulfilledQuantity: 1,
          refundableQuantity: 1,
        },
      ],
    };

    // 1. Shipping address name is primary
    const withShippingName: RawOrder = {
      id: "gid://shopify/Order/6",
      name: "#1006",
      createdAt: "2026-09-16T10:00:00Z",
      shippingAddress: { name: "John Recipient" },
      customer: { firstName: "Jane", lastName: "Buyer" },
      lineItems: baseLineItems,
    };
    expect(transformOrder(withShippingName)?.customerName).toBe("John Recipient");

    // 2. Falls back to customer firstName + lastName if no shipping address name
    const withCustomerOnly: RawOrder = {
      id: "gid://shopify/Order/7",
      name: "#1007",
      createdAt: "2026-09-16T10:00:00Z",
      shippingAddress: { formatted: ["123 Street"] },
      customer: { firstName: "Alice", lastName: "Smith" },
      lineItems: baseLineItems,
    };
    expect(transformOrder(withCustomerOnly)?.customerName).toBe("Alice Smith");

    // 3. Customer with only first name
    const withFirstOnly: RawOrder = {
      id: "gid://shopify/Order/8",
      name: "#1008",
      createdAt: "2026-09-16T10:00:00Z",
      customer: { firstName: "Bob", lastName: null },
      lineItems: baseLineItems,
    };
    expect(transformOrder(withFirstOnly)?.customerName).toBe("Bob");

    // 4. Fallback to "Customer"
    const withNoNames: RawOrder = {
      id: "gid://shopify/Order/9",
      name: "#1009",
      createdAt: "2026-09-16T10:00:00Z",
      customer: null,
      shippingAddress: null,
      lineItems: baseLineItems,
    };
    expect(transformOrder(withNoNames)?.customerName).toBe("Customer");
  });

  it("computes packing warnings (MULTI_QTY, CUSTOMER_NOTE, EXPRESS) on transformed order", () => {
    const rawOrder: RawOrder = {
      id: "gid://shopify/Order/10",
      name: "#1010",
      createdAt: "2026-09-16T10:00:00Z",
      note: "Urgent package for birthday",
      shippingLine: { title: "Chronopost Express 24h" },
      lineItems: {
        nodes: [
          {
            id: "gid://shopify/LineItem/50",
            title: "T-Shirt",
            requiresShipping: true,
            quantity: 3,
            unfulfilledQuantity: 3,
            refundableQuantity: 3,
          },
        ],
      },
    };

    const transformed = transformOrder(rawOrder);
    expect(transformed?.warnings).toEqual([
      { code: "MULTI_QTY" },
      { code: "CUSTOMER_NOTE" },
      { code: "EXPRESS" },
    ]);
  });

  it("analyzes extraLineItems when hasMoreItems is true to prevent missing MULTI_QTY", () => {
    // 15 initial items with quantity = 1 each
    const first15Items: RawLineItem[] = Array.from({ length: 15 }, (_, i) => ({
      id: `gid://shopify/LineItem/${i + 1}`,
      title: `Item ${i + 1}`,
      requiresShipping: true,
      quantity: 1,
      unfulfilledQuantity: 1,
      refundableQuantity: 1,
    }));

    const rawOrder: RawOrder = {
      id: "gid://shopify/Order/11",
      name: "#1011",
      createdAt: "2026-09-16T10:00:00Z",
      lineItems: {
        pageInfo: {
          hasNextPage: true,
          endCursor: "cursor-15",
        },
        nodes: first15Items,
      },
    };

    // Without extra items (only first 15 seen), MULTI_QTY would not be triggered
    const withoutExtra = transformOrder(rawOrder);
    expect(withoutExtra?.warnings.find((w) => w.code === "MULTI_QTY")).toBeUndefined();
    expect(withoutExtra?.hasMoreItems).toBe(true);

    // With 16th item having quantity 4, MULTI_QTY is properly triggered!
    const extraItems: RawLineItem[] = [
      {
        id: "gid://shopify/LineItem/16",
        title: "Bulk Socks 4-Pack",
        requiresShipping: true,
        quantity: 4,
        unfulfilledQuantity: 4,
        refundableQuantity: 4,
      },
    ];

    const withExtra = transformOrder(rawOrder, extraItems);
    expect(withExtra?.warnings).toContainEqual({ code: "MULTI_QTY" });
    expect(withExtra?.hasMoreItems).toBe(true);
    // order.lineItems still maintains the first 15 items for list view performance
    expect(withExtra?.lineItems.length).toBe(15);
  });
});

describe("orders.server — fetchRemainingLineItems", () => {
  it("paginates and fetches remaining line items for an order", async () => {
    const mockGraphql = vi.fn().mockImplementation(async (_query, options) => {
      if (options?.variables?.cursor === "cursor-1") {
        return {
          json: async () => ({
            data: {
              order: {
                lineItems: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: [
                    {
                      id: "gid://shopify/LineItem/17",
                      title: "Cap",
                      quantity: 1,
                      unfulfilledQuantity: 1,
                      requiresShipping: true,
                    },
                  ],
                },
              },
            },
          }),
        };
      }

      return {
        json: async () => ({
          data: {
            order: {
              lineItems: {
                pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
                nodes: [
                  {
                    id: "gid://shopify/LineItem/16",
                    title: "Socks",
                    quantity: 2,
                    unfulfilledQuantity: 2,
                    requiresShipping: true,
                  },
                ],
              },
            },
          },
        }),
      };
    });

    const admin = { graphql: mockGraphql };
    const items = await fetchRemainingLineItems(admin, "gid://shopify/Order/100", "cursor-0");

    expect(items.length).toBe(2);
    expect(items[0].id).toBe("gid://shopify/LineItem/16");
    expect(items[1].id).toBe("gid://shopify/LineItem/17");
    expect(mockGraphql).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateAndDedupeOrderIds
// ─────────────────────────────────────────────────────────────────────────────

import { validateAndDedupeOrderIds, getOrdersByIds } from "./orders.server";

describe("orders.server — validateAndDedupeOrderIds", () => {
  const VALID_GID = "gid://shopify/Order/1234";
  const VALID_GID_2 = "gid://shopify/Order/5678";

  it("returns unique valid GIDs in original order", () => {
    const result = validateAndDedupeOrderIds([VALID_GID, VALID_GID_2]);
    expect(result).toEqual([VALID_GID, VALID_GID_2]);
  });

  it("deduplicates IDs while preserving first occurrence order", () => {
    const result = validateAndDedupeOrderIds([VALID_GID, VALID_GID, VALID_GID_2]);
    expect(result).toEqual([VALID_GID, VALID_GID_2]);
  });

  it("throws 400 for empty array", () => {
    expect(() => validateAndDedupeOrderIds([])).toThrow();
    try {
      validateAndDedupeOrderIds([]);
    } catch (e: any) {
      expect(e.status).toBe(400);
    }
  });

  it("throws 400 when more than 50 unique IDs are provided", () => {
    const manyIds = Array.from({ length: 51 }, (_, i) => `gid://shopify/Order/${i + 1}`);
    try {
      validateAndDedupeOrderIds(manyIds);
      expect.fail("Should have thrown");
    } catch (e: any) {
      expect(e.status).toBe(400);
    }
  });

  it("accepts exactly 50 unique IDs", () => {
    const fiftyIds = Array.from({ length: 50 }, (_, i) => `gid://shopify/Order/${i + 1}`);
    const result = validateAndDedupeOrderIds(fiftyIds);
    expect(result.length).toBe(50);
  });

  it("throws 400 when all IDs are invalid (no GID prefix)", () => {
    try {
      validateAndDedupeOrderIds(["12345", "not-a-gid", "order/123"]);
      expect.fail("Should have thrown");
    } catch (e: any) {
      expect(e.status).toBe(400);
    }
  });

  it("filters out invalid IDs and keeps only valid GIDs", () => {
    const result = validateAndDedupeOrderIds(["not-a-gid", VALID_GID, "", VALID_GID_2]);
    expect(result).toEqual([VALID_GID, VALID_GID_2]);
  });

  it("rejects GIDs for non-Order resources", () => {
    // Only gid://shopify/Order/... should pass
    const nonOrderGids = [
      "gid://shopify/Product/123",
      "gid://shopify/Customer/456",
    ];
    try {
      validateAndDedupeOrderIds(nonOrderGids);
      expect.fail("Should have thrown");
    } catch (e: any) {
      expect(e.status).toBe(400);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getOrdersByIds
// ─────────────────────────────────────────────────────────────────────────────

function makeLineItemNode(overrides: Partial<RawLineItem> = {}): RawLineItem {
  return {
    id: "gid://shopify/LineItem/1",
    title: "Test Product",
    variantTitle: "Default",
    sku: "SKU-001",
    quantity: 1,
    unfulfilledQuantity: 1,
    refundableQuantity: 1,
    requiresShipping: true,
    ...overrides,
  };
}

function makeOrderNode(id: string, overrides: any = {}): any {
  return {
    id,
    name: `#${id.split("/").pop()}`,
    createdAt: new Date().toISOString(),
    note: null,
    customer: null,
    shippingAddress: {
      name: "Test Customer",
      formatted: ["1 Main St", "Paris", "France"],
      address1: "1 Main St",
      address2: null,
      city: "Paris",
      province: null,
      zip: "75001",
      country: "France",
    },
    shippingLine: { title: "Standard Shipping" },
    printStatus: null,
    lineItems: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [makeLineItemNode()],
    },
    ...overrides,
  };
}

function makeMockAdmin(responses: any[]): any {
  let callIndex = 0;
  return {
    graphql: vi.fn().mockImplementation(async () => {
      const data = responses[callIndex++] ?? responses[responses.length - 1];
      return {
        json: async () => data,
      };
    }),
  };
}

describe("orders.server — getOrdersByIds", () => {
  const ID_A = "gid://shopify/Order/1001";
  const ID_B = "gid://shopify/Order/1002";

  it("returns orders in selection order, not GraphQL response order", async () => {
    // GraphQL returns B then A, but selection was A then B
    const mockAdmin = makeMockAdmin([
      {
        data: {
          nodes: [makeOrderNode(ID_B), makeOrderNode(ID_A)],
        },
      },
    ]);

    const result = await getOrdersByIds(mockAdmin, [ID_A, ID_B]);
    expect(result[0].id).toBe(ID_A);
    expect(result[1].id).toBe(ID_B);
  });

  it("skips null nodes (deleted or inaccessible orders)", async () => {
    const mockAdmin = makeMockAdmin([
      {
        data: {
          nodes: [null, makeOrderNode(ID_A)],
        },
      },
    ]);

    const result = await getOrdersByIds(mockAdmin, [ID_B, ID_A]);
    // null is skipped, only ID_A survives
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(ID_A);
  });

  it("skips nodes that are not Order type (no id field from inline fragment)", async () => {
    const mockAdmin = makeMockAdmin([
      {
        data: {
          // Non-Order node won't have id from Order inline fragment
          nodes: [{ __typename: "Product" }, makeOrderNode(ID_A)],
        },
      },
    ]);

    const result = await getOrdersByIds(mockAdmin, [ID_B, ID_A]);
    expect(result.length).toBe(1);
    expect(result[0].id).toBe(ID_A);
  });

  it("triggers lineItems pagination when hasNextPage is true", async () => {
    const orderWithMoreItems = makeOrderNode(ID_A, {
      lineItems: {
        pageInfo: { hasNextPage: true, endCursor: "cursor-1" },
        nodes: [makeLineItemNode({ id: "gid://shopify/LineItem/1", quantity: 1, unfulfilledQuantity: 1, refundableQuantity: 1 })],
      },
    });

    const extraLineItemResponse = {
      data: {
        order: {
          lineItems: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [
              makeLineItemNode({ id: "gid://shopify/LineItem/51", quantity: 2, unfulfilledQuantity: 2, refundableQuantity: 2 }),
            ],
          },
        },
      },
    };

    const mockAdmin = makeMockAdmin([
      // First call: batch fetch
      { data: { nodes: [orderWithMoreItems] } },
      // Second call: fetchRemainingLineItems pagination
      extraLineItemResponse,
    ]);

    const result = await getOrdersByIds(mockAdmin, [ID_A]);
    expect(result.length).toBe(1);
    // Both the initial item AND the paginated item should be in the result
    expect(result[0].lineItems.length).toBe(2);
    expect(mockAdmin.graphql).toHaveBeenCalledTimes(2);
  });

  it("handles order with no shippingAddress gracefully", async () => {
    const orderWithoutAddress = makeOrderNode(ID_A, {
      shippingAddress: null,
      customer: { firstName: "Jean", lastName: "Dupont" },
    });

    const mockAdmin = makeMockAdmin([{ data: { nodes: [orderWithoutAddress] } }]);

    const result = await getOrdersByIds(mockAdmin, [ID_A]);
    expect(result.length).toBe(1);
    expect(result[0].shippingAddress).toBeNull();
    expect(result[0].customerName).toBe("Jean Dupont");
  });

  it("handles line items with no SKU", async () => {
    const orderWithNoSku = makeOrderNode(ID_A, {
      lineItems: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [makeLineItemNode({ sku: null })],
      },
    });

    const mockAdmin = makeMockAdmin([{ data: { nodes: [orderWithNoSku] } }]);

    const result = await getOrdersByIds(mockAdmin, [ID_A]);
    expect(result.length).toBe(1);
    expect(result[0].lineItems[0].sku).toBeNull();
  });

  it("processes multiple batches when IDs exceed BATCH_SIZE", async () => {
    // 21 IDs = 2 batches (20 + 1)
    const ids = Array.from({ length: 21 }, (_, i) => `gid://shopify/Order/${i + 1}`);
    const batch1Nodes = ids.slice(0, 20).map((id) => makeOrderNode(id));
    const batch2Nodes = ids.slice(20).map((id) => makeOrderNode(id));

    const mockAdmin = makeMockAdmin([
      { data: { nodes: batch1Nodes } },
      { data: { nodes: batch2Nodes } },
    ]);

    const result = await getOrdersByIds(mockAdmin, ids);
    expect(result.length).toBe(21);
    expect(mockAdmin.graphql).toHaveBeenCalledTimes(2);
  });

  it("throws on GraphQL errors", async () => {
    const mockAdmin = makeMockAdmin([
      { errors: [{ message: "Access denied" }] },
    ]);

    await expect(getOrdersByIds(mockAdmin, [ID_A])).rejects.toThrow("Access denied");
  });
});
