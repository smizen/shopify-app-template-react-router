import fs from "node:fs";
import path from "node:path";
import type { Order, Settings } from "../types/thermoslip";
import { DEFAULT_SETTINGS } from "../types/thermoslip";
import { chunkLineItems } from "../components/PackingSlip/PackingSlipPage";
import { generateBarcodeSvg } from "./barcode.server";

let cachedPrintCss: string | null = null;

function getPrintCss(): string {
  if (cachedPrintCss && process.env.NODE_ENV === "production") {
    return cachedPrintCss;
  }
  const possiblePaths = [
    path.resolve(process.cwd(), "app/components/PackingSlip/print.css"),
    path.resolve(process.cwd(), "public/print.css"),
  ];
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        cachedPrintCss = fs.readFileSync(p, "utf-8");
        return cachedPrintCss;
      }
    } catch {}
  }
  console.warn("[static-slip-renderer] Failed to read print.css from disk");
  return "";
}

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export interface RenderStaticPackingSlipsOptions {
  orders: Order[];
  shopName: string;
  settings?: Settings;
}

/**
 * Generates pure, static HTML/CSS 4×6 packing slips without any client-side JavaScript.
 * Compliant with Shopify Admin Print Action (<s-admin-print-action src="...">).
 */
export function renderStaticPackingSlipsHtml({
  orders,
  shopName,
  settings = DEFAULT_SETTINGS,
}: RenderStaticPackingSlipsOptions): string {
  const css = getPrintCss();

  const slipsHtml = orders
    .map((order) => renderOrderSlips(order, shopName, settings))
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ThermoSlip Packing Slips</title>
  <style>
${css}
  </style>
</head>
<body>
  <div id="print-root" class="print-preview-wrapper">
${slipsHtml}
  </div>
</body>
</html>`;
}

function renderOrderSlips(
  order: Order,
  shopName: string,
  settings: Settings,
): string {
  const formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const recipientName =
    order.shippingAddress?.name?.trim() || order.customerName?.trim();

  const itemChunks = chunkLineItems(order.lineItems);
  const totalPages = itemChunks.length;

  return itemChunks
    .map((chunk, pageIndex) => {
      const isFirstPage = pageIndex === 0;
      const currentPage = pageIndex + 1;

      // Header
      const headerShopName =
        settings.showLogo && shopName ? escapeHtml(shopName) : "ThermoSlip";
      const barcodeSvg = isFirstPage
        ? generateBarcodeSvg(order.name, { width: 1.6, height: 36, fontSize: 9 })
        : generateBarcodeSvg(order.name, { width: 1.4, height: 28, fontSize: 8 });

      const headerHtml = isFirstPage
        ? `<div class="slip-header">
            <div class="slip-header-left">
              <div class="slip-shop-name">${headerShopName}</div>
              <div class="slip-order-date">${escapeHtml(formattedDate)}</div>
            </div>
            <div class="slip-order-meta">
              <div class="slip-order-name">${escapeHtml(order.name)}</div>
              ${barcodeSvg}
            </div>
          </div>`
        : `<div class="slip-header slip-header--continuation">
            <div class="slip-header-left">
              <div class="slip-shop-name">${headerShopName}</div>
              <div class="slip-order-date">${escapeHtml(formattedDate)}</div>
            </div>
            <div class="slip-order-meta">
              <div class="slip-order-name">${escapeHtml(order.name)} (Cont.)</div>
              ${barcodeSvg}
            </div>
          </div>`;

      // Carrier bar (page 1 only)
      const carrierHtml =
        isFirstPage && order.shippingMethod
          ? `<div class="slip-carrier-bar">
              <span class="slip-carrier-label">SHIP VIA:</span>
              <span class="slip-carrier-name">${escapeHtml(order.shippingMethod)}</span>
            </div>`
          : "";

      // Warnings (page 1 only)
      let warningsHtml = "";
      if (isFirstPage && order.warnings && order.warnings.length > 0) {
        const badgesHtml = order.warnings
          .map((w) => {
            const label =
              w.code === "MULTI_QTY"
                ? "Multiple Qty"
                : w.code === "CUSTOMER_NOTE"
                  ? "Note"
                  : w.code === "EXPRESS"
                    ? "Express"
                    : w.code;
            return `<span class="slip-warning-badge slip-warning-badge--${w.code.toLowerCase()}">${label}</span>`;
          })
          .join("");
        warningsHtml = `<div class="slip-warnings-banner">${badgesHtml}</div>`;
      }

      // Line items
      const itemsTitle = isFirstPage
        ? "Items to Pack"
        : "Items to Pack (Continued)";
      const itemsRowsHtml = chunk
        .map((item) => {
          const itemTitle = item.variantTitle
            ? `${item.title} / ${item.variantTitle}`
            : item.title;
          const skuHtml =
            settings.showSku && item.sku
              ? `<div class="line-item-sku">SKU: ${escapeHtml(item.sku)}</div>`
              : "";
          return `<div class="line-item-row">
            <span class="line-item-qty">${item.quantityToPack}×</span>
            <div class="line-item-details">
              <div class="line-item-name" title="${escapeHtml(itemTitle)}">${escapeHtml(itemTitle)}</div>
              ${skuHtml}
            </div>
          </div>`;
        })
        .join("");
      const itemsHtml = `<div class="slip-items">
        <div class="slip-items-title">${itemsTitle}</div>
        ${itemsRowsHtml}
      </div>`;

      // Shipping address (page 1 only)
      let addressHtml = "";
      if (
        isFirstPage &&
        settings.showAddress &&
        (order.shippingAddress || recipientName)
      ) {
        const formattedLines =
          order.shippingAddress?.formatted
            ?.map((l) => `<div>${escapeHtml(l)}</div>`)
            .join("") ?? "";
        const cityLine =
          order.shippingAddress?.city &&
          !order.shippingAddress.formatted?.some((l) =>
            l.includes(order.shippingAddress?.city || ""),
          )
            ? `<div>${escapeHtml(order.shippingAddress.city)}${
                order.shippingAddress.country
                  ? `, ${escapeHtml(order.shippingAddress.country)}`
                  : ""
              }</div>`
            : "";
        addressHtml = `<div class="slip-address">
          <div class="slip-address-title">Ship To</div>
          ${
            recipientName
              ? `<div class="slip-recipient-name">${escapeHtml(recipientName)}</div>`
              : ""
          }
          ${formattedLines}
          ${cityLine}
        </div>`;
      }

      // Customer note (page 1 only)
      const noteHtml =
        isFirstPage && settings.showNotes && order.note
          ? `<div class="slip-note">
              <div class="slip-note-title">Note</div>
              ${escapeHtml(order.note)}
            </div>`
          : "";

      // Page indicator (multi-page only)
      const pageIndicatorHtml =
        totalPages > 1
          ? `<div class="slip-page-indicator">Page ${currentPage}/${totalPages}</div>`
          : "";

      // Footer
      const footerText = settings.footer
        ? escapeHtml(settings.footer)
        : "ThermoSlip · Order Print";
      const footerHtml = `<div class="slip-footer">${footerText}</div>`;

      return `    <div
      class="packing-slip print-preview-slip"
      data-order-id="${escapeHtml(order.id)}"
      data-page-number="${currentPage}"
      data-total-pages="${totalPages}"
    >
      ${headerHtml}
      ${carrierHtml}
      ${warningsHtml}
      ${itemsHtml}
      ${addressHtml}
      ${noteHtml}
      ${pageIndicatorHtml}
      ${footerHtml}
    </div>`;
    })
    .join("\n");
}
