import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { OrderList } from "./OrderList";
import type { Order } from "../types/thermoslip";

function createMockOrder(id: string, name: string, isPrinted: boolean): Order {
  return {
    id,
    name,
    createdAt: new Date().toISOString(),
    customerName: "Atelier Tester",
    note: null,
    shippingMethod: "Standard",
    shippingAddress: null,
    lineItems: [
      {
        id: "gid://shopify/LineItem/1",
        title: "Test Product",
        variantTitle: null,
        quantity: 1,
        unfulfilledQuantity: 1,
        quantityToPack: 1,
        requiresShipping: true,
        sku: "SKU-1",
      },
    ],
    hasMoreItems: false,
    printStatus: isPrinted ? "printed" : null,
    warnings: [],
  };
}

describe("OrderList Component (Story 4.2, FR-12)", () => {
  it("renders empty state when orders is empty", () => {
    const html = renderToStaticMarkup(
      <AppProvider i18n={enTranslations}>
        <OrderList orders={[]} filter="ready" />
      </AppProvider>,
    );
    expect(html).toContain("You&#x27;re all caught up");
  });

  it("renders ready badge and no Reprint button for unprinted orders", () => {
    const readyOrder = createMockOrder("gid://shopify/Order/1", "#1001", false);
    const onReprint = vi.fn();

    const html = renderToStaticMarkup(
      <AppProvider i18n={enTranslations}>
        <OrderList orders={[readyOrder]} filter="ready" onReprint={onReprint} />
      </AppProvider>,
    );

    expect(html).toContain("#1001");
    expect(html).toContain("Ready");
    expect(html).not.toContain("Reprint");
  });

  it("renders Printed badge and discreet Reprint button when order is already printed", () => {
    const printedOrder = createMockOrder("gid://shopify/Order/2", "#1002", true);
    const onReprint = vi.fn();

    const html = renderToStaticMarkup(
      <AppProvider i18n={enTranslations}>
        <OrderList orders={[printedOrder]} filter="all" onReprint={onReprint} />
      </AppProvider>,
    );

    expect(html).toContain("#1002");
    expect(html).toContain("Printed");
    expect(html).toContain("Reprint");
    expect(html).toContain("Reprint packing slip for #1002");
  });

  it("renders both ready and printed orders correctly in mixed view", () => {
    const readyOrder = createMockOrder("gid://shopify/Order/1", "#1001", false);
    const printedOrder = createMockOrder("gid://shopify/Order/2", "#1002", true);
    const onReprint = vi.fn();

    const html = renderToStaticMarkup(
      <AppProvider i18n={enTranslations}>
        <OrderList orders={[readyOrder, printedOrder]} filter="all" onReprint={onReprint} />
      </AppProvider>,
    );

    expect(html).toContain("#1001");
    expect(html).toContain("#1002");
    expect(html).toContain("Ready");
    expect(html).toContain("Printed");
  });
});
