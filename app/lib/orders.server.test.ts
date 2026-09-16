import { describe, it, expect } from "vitest";
import { computeQuantityToPack, transformOrder, type RawOrder } from "./orders.server";

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
});
