import { describe, it, expect } from "vitest";
import { renderStaticPackingSlipsHtml } from "./static-slip-renderer.server";
import { DEMO_ORDERS } from "./demo-orders";
import { DEFAULT_SETTINGS } from "../types/thermoslip";

describe("static-slip-renderer.server", () => {
  it("renders a valid self-contained HTML document with empty orders", () => {
    const html = renderStaticPackingSlipsHtml({
      orders: [],
      shopName: "My Shop",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<title>ThermoSlip Packing Slips</title>");
    expect(html).toContain('<div id="print-root" class="print-preview-wrapper">');
    expect(html).toContain("</html>");
  });

  it("renders an order with barcode SVG, customer note, warnings, and line items", () => {
    const testOrder = DEMO_ORDERS[0]; // #1001
    const html = renderStaticPackingSlipsHtml({
      orders: [testOrder],
      shopName: "Alpine Workshop",
      settings: DEFAULT_SETTINGS,
    });

    // Check header and Shop Name
    expect(html).toContain("Alpine Workshop");
    expect(html).toContain("#1001");
    expect(html).toContain("slip-barcode");
    expect(html).toContain("<svg");

    // Check Items to Pack
    expect(html).toContain("Items to Pack");
    expect(html).toContain("Pack T-Shirts Coton Bio");

    // Check Address
    expect(html).toContain("Ship To");
    expect(html).toContain("Alice Dupont");

    // Check single page (no multi-page indicator)
    expect(html).not.toContain("Page 1/2");
  });

  it("renders customer note when present", () => {
    const orderWithNote = DEMO_ORDERS[1]; // #1002
    const html = renderStaticPackingSlipsHtml({
      orders: [orderWithNote],
      shopName: "Alpine Workshop",
      settings: DEFAULT_SETTINGS,
    });

    expect(html).toContain("Note");
    expect(html).toContain("Sonner à l&#039;interphone Bâtiment B svp");
  });

  it("paginates a large order (>8 items) into multiple slips with continuation header and PageIndicator", () => {
    // Find large order (demo-order-large has 15 items)
    const largeOrder = DEMO_ORDERS.find((o) => o.lineItems.length > 8)!;
    expect(largeOrder).toBeDefined();

    const html = renderStaticPackingSlipsHtml({
      orders: [largeOrder],
      shopName: "Alpine Workshop",
      settings: DEFAULT_SETTINGS,
    });

    // Check both pages are rendered
    expect(html).toContain('data-page-number="1"');
    expect(html).toContain('data-page-number="2"');
    expect(html).toContain("Page 1/2");
    expect(html).toContain("Page 2/2");

    // Check continuation header on page 2
    expect(html).toContain(`${largeOrder.name} (Cont.)`);
    expect(html).toContain("Items to Pack (Continued)");
  });

  it("inlines print.css rules with @page 4in 6in", () => {
    const html = renderStaticPackingSlipsHtml({
      orders: [DEMO_ORDERS[0]],
      shopName: "Test",
    });

    expect(html).toContain("<style>");
    expect(html).toContain("size: 4in 6in");
    expect(html).toContain(".packing-slip");
    expect(html).toContain("</style>");
  });
});
