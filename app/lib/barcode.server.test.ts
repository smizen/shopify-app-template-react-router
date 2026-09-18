import { describe, it, expect } from "vitest";
import { generateBarcodeSvg } from "./barcode.server";

describe("barcode.server", () => {
  it("returns empty string for empty or whitespace values", () => {
    expect(generateBarcodeSvg("")).toBe("");
    expect(generateBarcodeSvg("   ")).toBe("");
  });

  it("generates a valid SVG string for a standard order number", () => {
    const svg = generateBarcodeSvg("#1001");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain('class="slip-barcode"');
    expect(svg).toContain('aria-label="Barcode #1001"');
    expect(svg).toContain("<rect");
  });

  it("generates valid SVG for longer order numbers", () => {
    const svg = generateBarcodeSvg("WEB-998822");
    expect(svg).toContain("<svg");
    expect(svg).toContain('aria-label="Barcode WEB-998822"');
  });

  it("handles custom width and height options", () => {
    const svg = generateBarcodeSvg("#1042", { width: 3, height: 60 });
    expect(svg).toContain("<svg");
    expect(svg).toContain('height="60"');
    expect(svg).toContain('viewBox="0 0 237 72"');
  });
});
