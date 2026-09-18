import JsBarcode from "jsbarcode";
import { DOMImplementation, XMLSerializer } from "@xmldom/xmldom";
import { computeBarcodeWidth } from "../components/PackingSlip/Barcode";

export interface ServerBarcodeOptions {
  format?: string;
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
}

/**
 * Generates a pure vector SVG barcode string synchronously on the server.
 * Uses JsBarcode + @xmldom/xmldom to eliminate any dependency on browser DOM.
 * Perfect for static HTML packing slip documents.
 */
export function generateBarcodeSvg(
  value: string,
  options: ServerBarcodeOptions = {},
): string {
  if (!value || !value.trim()) {
    return "";
  }

  const cleanValue = value.trim();
  const width = computeBarcodeWidth(cleanValue, options.width);
  const height = options.height ?? 42;
  const displayValue = options.displayValue ?? true;
  const fontSize = options.fontSize ?? 10;
  const format = options.format ?? "CODE128";

  try {
    const xmlDoc = new DOMImplementation().createDocument(
      "http://www.w3.org/1999/xhtml",
      "html",
      null,
    );
    const svgNode = xmlDoc.createElementNS("http://www.w3.org/2000/svg", "svg");

    JsBarcode(svgNode, cleanValue, {
      xmlDocument: xmlDoc as any,
      format,
      width,
      height,
      displayValue,
      font: "Courier New, monospace",
      fontSize,
      textMargin: 2,
      margin: 0,
      background: "#ffffff",
      lineColor: "#000000",
    });

    svgNode.setAttribute("class", "slip-barcode");
    svgNode.setAttribute("aria-label", `Barcode ${cleanValue}`);

    return new XMLSerializer().serializeToString(svgNode);
  } catch (err) {
    console.warn("[Barcode.server] Failed to generate barcode for:", cleanValue, err);
    return `<span class="slip-barcode-fallback">${cleanValue}</span>`;
  }
}
