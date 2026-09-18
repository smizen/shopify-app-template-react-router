import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  PackingSlipPage,
  calculateTotalPages,
  chunkLineItems,
  ITEMS_PER_PAGE,
} from "./PackingSlipPage";
import { PageIndicator } from "./PageIndicator";
import type { Order, Settings, LineItem } from "../../types/thermoslip";
import { DEFAULT_SETTINGS } from "../../types/thermoslip";

function createMockLineItem(index: number): LineItem {
  return {
    id: `gid://shopify/LineItem/mock-${index}`,
    title: `Product Title ${index}`,
    variantTitle: index % 2 === 0 ? `Variant ${index}` : null,
    quantity: 1,
    unfulfilledQuantity: 1,
    quantityToPack: 1,
    requiresShipping: true,
    sku: `SKU-${index}`,
  };
}

function createMockOrder(itemCount: number): Order {
  const lineItems = Array.from({ length: itemCount }, (_, i) =>
    createMockLineItem(i + 1)
  );

  return {
    id: "gid://shopify/Order/mock-order-1",
    name: "#1042",
    createdAt: "2026-09-17T12:00:00Z",
    customerName: "Jean Dupont",
    note: "Special instructions for delivery",
    shippingMethod: "Colissimo",
    shippingAddress: {
      name: "Jean Dupont",
      formatted: ["12 Rue de Paris"],
      city: "Paris",
      country: "France",
    },
    lineItems,
    printStatus: null,
    warnings: [{ code: "MULTI_QTY" }],
  };
}

describe("PackingSlip Multi-Page Pagination (Story 3.3, FR-8)", () => {
  describe("ITEMS_PER_PAGE constant", () => {
    it("is strictly set to 8 items per label", () => {
      expect(ITEMS_PER_PAGE).toBe(8);
    });
  });

  describe("calculateTotalPages", () => {
    it("returns 1 for 0 items", () => {
      expect(calculateTotalPages(0)).toBe(1);
    });

    it("returns 1 for 1 to 8 items", () => {
      expect(calculateTotalPages(1)).toBe(1);
      expect(calculateTotalPages(4)).toBe(1);
      expect(calculateTotalPages(8)).toBe(1);
    });

    it("returns 2 for 9 to 16 items", () => {
      expect(calculateTotalPages(9)).toBe(2);
      expect(calculateTotalPages(15)).toBe(2);
      expect(calculateTotalPages(16)).toBe(2);
    });

    it("returns 3 for 17 items", () => {
      expect(calculateTotalPages(17)).toBe(3);
      expect(calculateTotalPages(24)).toBe(3);
    });
  });

  describe("chunkLineItems", () => {
    it("returns a single empty array for empty items", () => {
      const chunks = chunkLineItems([]);
      expect(chunks).toEqual([[]]);
    });

    it("returns 1 chunk for items <= 8", () => {
      const items = Array.from({ length: 5 }, (_, i) => createMockLineItem(i + 1));
      const chunks = chunkLineItems(items);
      expect(chunks.length).toBe(1);
      expect(chunks[0].length).toBe(5);
    });

    it("chunks 15 items into 2 pages (8 and 7)", () => {
      const items = Array.from({ length: 15 }, (_, i) => createMockLineItem(i + 1));
      const chunks = chunkLineItems(items);
      expect(chunks.length).toBe(2);
      expect(chunks[0].length).toBe(8);
      expect(chunks[1].length).toBe(7);
      expect(chunks[0][0].title).toBe("Product Title 1");
      expect(chunks[1][0].title).toBe("Product Title 9");
    });
  });

  describe("PageIndicator Component", () => {
    it("renders nothing if totalPages is 1", () => {
      const html = renderToStaticMarkup(
        <PageIndicator currentPage={1} totalPages={1} />
      );
      expect(html).toBe("");
    });

    it("renders 'Page 1/2' when totalPages is 2 and currentPage is 1", () => {
      const html = renderToStaticMarkup(
        <PageIndicator currentPage={1} totalPages={2} />
      );
      expect(html).toContain("Page 1/2");
      expect(html).toContain("slip-page-indicator");
    });

    it("renders 'Page 2/2' when totalPages is 2 and currentPage is 2", () => {
      const html = renderToStaticMarkup(
        <PageIndicator currentPage={2} totalPages={2} />
      );
      expect(html).toContain("Page 2/2");
    });
  });

  describe("PackingSlipPage Rendering", () => {
    const defaultSettings: Settings = DEFAULT_SETTINGS;
    const shopName = "ThermoSlip Boutique";

    it("renders a single 4x6 slip when order has <= 8 items", () => {
      const order = createMockOrder(5);
      const html = renderToStaticMarkup(
        <PackingSlipPage
          order={order}
          settings={defaultSettings}
          shopName={shopName}
        />
      );

      // Only 1 packing slip page
      const slipMatches = html.match(/class="packing-slip print-preview-slip"/g);
      expect(slipMatches?.length).toBe(1);

      // No page indicator for single page orders
      expect(html).not.toContain("slip-page-indicator");
      expect(html).not.toContain("Page 1/1");

      // Full header rendered
      expect(html).toContain("#1042");
      expect(html).not.toContain("#1042 (Cont.)");

      // Address and warnings present
      expect(html).toContain("Ship To");
      expect(html).toContain("12 Rue de Paris");
      expect(html).toContain("MULTI QTY");
    });

    it("renders 2 slips with continuation header and pagination for a 15-item order", () => {
      const order = createMockOrder(15);
      const html = renderToStaticMarkup(
        <PackingSlipPage
          order={order}
          settings={defaultSettings}
          shopName={shopName}
        />
      );

      // Exactly 2 physical packing slips generated
      const slipMatches = html.match(/class="packing-slip print-preview-slip"/g);
      expect(slipMatches?.length).toBe(2);

      // Data attributes for page numbers
      expect(html).toContain('data-page-number="1"');
      expect(html).toContain('data-page-number="2"');
      expect(html).toContain('data-total-pages="2"');

      // Page indicators
      expect(html).toContain("Page 1/2");
      expect(html).toContain("Page 2/2");

      // Header on page 1 vs continuation header on page 2
      expect(html).toContain("slip-header--continuation");
      expect(html).toContain("#1042 (Cont.)");

      // First chunk items appear on page 1, 9th item appears on page 2
      expect(html).toContain("Product Title 1");
      expect(html).toContain("Product Title 8");
      expect(html).toContain("Product Title 9");
      expect(html).toContain("Product Title 15");

      // Header continuation items title
      expect(html).toContain("Items to Pack (Continued)");

      // Address and note only on page 1, not duplicated on page 2
      const addressMatches = html.match(/Ship To/g);
      expect(addressMatches?.length).toBe(1);

      const noteMatches = html.match(/Special instructions for delivery/g);
      expect(noteMatches?.length).toBe(1);
    });

    it("formats product and variant on a single line for deterministic height", () => {
      const order = createMockOrder(2);
      // Item 2 has a variant title "Variant 2"
      const html = renderToStaticMarkup(
        <PackingSlipPage
          order={order}
          settings={defaultSettings}
          shopName={shopName}
        />
      );

      expect(html).toContain("Product Title 2 / Variant 2");
    });
  });
});
