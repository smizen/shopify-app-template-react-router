import type { LoaderFunctionArgs } from "react-router";
import { renderStaticPackingSlipsHtml } from "../lib/static-slip-renderer.server";
import { DEMO_ORDERS } from "../lib/demo-orders";
import { DEFAULT_SETTINGS } from "../types/thermoslip";

/**
 * Public standalone sample preview route.
 * Safe to open in a new tab (_blank) outside the Shopify Admin iframe.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  const showLogo = url.searchParams.get("showLogo") !== "false";
  const showAddress = url.searchParams.get("showAddress") !== "false";
  const showSku = url.searchParams.get("showSku") !== "false";
  const showNotes = url.searchParams.get("showNotes") !== "false";
  const footer = url.searchParams.get("footer") || DEFAULT_SETTINGS.footer;

  const settings = {
    showLogo,
    showAddress,
    showSku,
    showNotes,
    footer,
  };

  const baseHtml = renderStaticPackingSlipsHtml({
    orders: [DEMO_ORDERS[1]],
    shopName: "ThermoSlip Store",
    settings,
  });

  const toolbarHtml = `
  <div class="screen-only" style="background:#0f172a; color:#fff; padding:12px 24px; display:flex; justify-content:space-between; align-items:center; font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif; position:sticky; top:0; z-index:9999; box-shadow:0 2px 8px rgba(0,0,0,0.15);">
    <div style="display:flex; align-items:center; gap:12px;">
      <span style="font-weight:600; font-size:14px;">🏷️ ThermoSlip · Sample 4×6 Thermal Preview</span>
      <span style="background:rgba(255,255,255,0.15); padding:3px 8px; border-radius:12px; font-size:12px;">4×6 in (203 DPI)</span>
    </div>
    <div style="display:flex; gap:10px;">
      <button onclick="window.print()" style="background:#4f46e5; color:#fff; border:none; padding:8px 16px; border-radius:6px; font-weight:600; cursor:pointer; font-size:13px; transition:background 0.2s;">🖨️ Print Test Label</button>
      <button onclick="window.close()" style="background:rgba(255,255,255,0.15); color:#fff; border:none; padding:8px 14px; border-radius:6px; font-weight:500; cursor:pointer; font-size:13px;">Close</button>
    </div>
  </div>
`;

  // Inject toolbar right after <body>
  const fullHtml = baseHtml.replace("<body>", `<body>\n${toolbarHtml}`);

  return new Response(fullHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
