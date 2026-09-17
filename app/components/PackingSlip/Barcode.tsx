import { useEffect, useRef, useState } from "react";
import JsBarcode from "jsbarcode";

export interface BarcodeProps {
  value: string;
  format?: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
}

/**
 * Vector SVG Barcode component for Code 128 thermal printing (Story 3.2, FR-7).
 *
 * Designed for 203 DPI / 300 DPI thermal printing:
 * - Emits pure vector SVG to avoid canvas pixelation/blur.
 * - Adaptive width: width=2 for short order IDs (<= 8 chars, e.g. #1001),
 *   auto-scales down to 1.5 for longer IDs (e.g. WEB-100001) to stay within 4x6 bounds.
 * - height defaults to 42px (optimal for 1D laser scanner distance).
 * - displayValue defaults to true (shows clean monospace text under bars).
 * - Pure 1-bit black on white (#000000 on #FFFFFF).
 * - Resilient try/catch: errors in encoding will NEVER crash the slip or page.
 */
/**
 * Simple adaptive width strategy:
 * - width=2 for short order IDs (<= 8 chars, e.g. #1001, #1004) -> crisp 203 DPI laser readability.
 * - width=1.5 for longer IDs (e.g. WEB-100001) -> stays within 4×6 header bounds.
 */
export function computeBarcodeWidth(value: string, customWidth?: number): number {
  if (typeof customWidth === "number") {
    return customWidth;
  }
  return value && value.trim().length <= 8 ? 2 : 1.5;
}

export function Barcode({
  value,
  format = "CODE128",
  width: customWidth,
  height = 42,
  displayValue = true,
  fontSize = 10,
  className = "slip-barcode",
}: BarcodeProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hasError, setHasError] = useState(false);

  const computedWidth = computeBarcodeWidth(value, customWidth);

  useEffect(() => {
    if (!svgRef.current || !value || !value.trim()) {
      return;
    }

    try {
      JsBarcode(svgRef.current, value.trim(), {
        format,
        width: computedWidth,
        height,
        displayValue,
        font: "Courier New, monospace",
        fontSize,
        textMargin: 2,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
      });
      setHasError(false);
    } catch (err) {
      console.warn("[Barcode] Failed to render barcode for value:", value, err);
      setHasError(true);
    }
  }, [value, format, computedWidth, height, displayValue, fontSize]);

  if (!value || !value.trim()) {
    return null;
  }

  // Graceful fallback if barcode generation throws
  if (hasError) {
    return <span className="slip-barcode-fallback">{value}</span>;
  }

  return (
    <svg
      ref={svgRef}
      className={className}
      aria-label={`Barcode ${value}`}
    />
  );
}
