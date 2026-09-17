import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { Barcode, computeBarcodeWidth } from "./Barcode";
import JsBarcode from "jsbarcode";

describe("Barcode Component & Utilities (Story 3.2, FR-7)", () => {
  describe("computeBarcodeWidth", () => {
    it("returns 2 for short order identifiers (<= 8 chars)", () => {
      expect(computeBarcodeWidth("#1001")).toBe(2);
      expect(computeBarcodeWidth("1001")).toBe(2);
      expect(computeBarcodeWidth("#1004")).toBe(2);
      expect(computeBarcodeWidth("WEB-1001")).toBe(2);
    });

    it("returns 1.5 for longer order identifiers (> 8 chars) to preserve 4x6 bounds", () => {
      expect(computeBarcodeWidth("WEB-100001")).toBe(1.5);
      expect(computeBarcodeWidth("ORDER-2026-99999")).toBe(1.5);
    });

    it("respects explicit customWidth parameter regardless of length", () => {
      expect(computeBarcodeWidth("#1001", 1.8)).toBe(1.8);
      expect(computeBarcodeWidth("WEB-100001", 2.2)).toBe(2.2);
      expect(computeBarcodeWidth("#1001", 1)).toBe(1);
    });
  });

  describe("Barcode rendering", () => {
    it("returns null / empty output when value is empty string", () => {
      const html = renderToStaticMarkup(<Barcode value="" />);
      expect(html).toBe("");
    });

    it("returns null / empty output when value is whitespace only", () => {
      const html = renderToStaticMarkup(<Barcode value="   " />);
      expect(html).toBe("");
    });

    it("renders SVG element with slip-barcode class and aria-label for standard order #1001", () => {
      const html = renderToStaticMarkup(<Barcode value="#1001" />);
      expect(html).toContain("<svg");
      expect(html).toContain('class="slip-barcode"');
      expect(html).toContain('aria-label="Barcode #1001"');
    });

    it("renders SVG element for long order name WEB-100001", () => {
      const html = renderToStaticMarkup(<Barcode value="WEB-100001" />);
      expect(html).toContain("<svg");
      expect(html).toContain('aria-label="Barcode WEB-100001"');
    });

    it("allows custom className override", () => {
      const html = renderToStaticMarkup(
        <Barcode value="#1001" className="custom-barcode-class" />
      );
      expect(html).toContain('class="custom-barcode-class"');
    });
  });

  describe("JsBarcode CODE128 compatibility", () => {
    it("successfully encodes standard and long Shopify order names without throwing", () => {
      const testCases = [
        "#1001",
        "1001",
        "#10425",
        "WEB-1001",
        "WEB-100001",
        "ORDER-2026-LONG-IDENTIFIER-99999",
      ];

      // Create a mock SVG node to test JsBarcode execution
      for (const val of testCases) {
        // Mock SVG element
        const mockSvg = {
          setAttribute: () => {},
          appendChild: () => {},
          removeChild: () => {},
          firstChild: null,
          childNodes: [],
        };

        expect(() => {
          JsBarcode(mockSvg as any, val, {
            format: "CODE128",
            width: computeBarcodeWidth(val),
            height: 42,
            displayValue: true,
          });
        }).not.toThrow();
      }
    });
  });
});
