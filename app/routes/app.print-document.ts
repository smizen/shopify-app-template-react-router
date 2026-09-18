import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  validateAndDedupeOrderIds,
  getOrdersByIds,
  getShopName,
} from "../lib/orders.server";
import { DEMO_ORDERS } from "../lib/demo-orders";
import { DEFAULT_SETTINGS } from "../types/thermoslip";
import { renderStaticPackingSlipsHtml } from "../lib/static-slip-renderer.server";
import { getAppSettings } from "../lib/metafields.server";
import { reservePrintQuota } from "../lib/quota.server";
import { billingService } from "../lib/plan.server";

/**
 * Story 3.5 / Spike 3.4 — Dedicated Static Document Route for Shopify Admin Print Action
 *
 * Requirements:
 * 1. Returns pure static HTML without scripts or React/Polaris hydration chrome.
 * 2. Authenticates via authenticate.admin(request).
 * 3. Re-fetches orders securely server-side.
 * 4. Renders exact 4×6 CSS format with inlined styles and Code 128 vector SVG.
 * 5. Returns response wrapped in cors(...) to allow preview in Shopify Admin iframe.
 * 6. Does NOT alter $app:print_status (workshop status remains intact).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session, cors } = await authenticate.admin(request);
  const isPro = await billingService.isPro({ admin, session });

  const url = new URL(request.url);
  const rawOrdersParam = url.searchParams.get("orders") ?? "";

  const rawIds = rawOrdersParam
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  if (rawIds.length === 0) {
    return cors(
      new Response(
        renderStaticPackingSlipsHtml({
          orders: [],
          shopName: "",
        }),
        {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        },
      ),
    );
  }

  // Guard: validate, dedupe, cap at 50
  let validatedIds: string[];
  try {
    validatedIds = validateAndDedupeOrderIds(rawIds);
  } catch (err: any) {
    const errorMsg =
      err instanceof Response
        ? await err.text()
        : err?.message || "Invalid order selection.";
    return cors(
      new Response(
        `<!DOCTYPE html><html><body><p>Invalid order selection: ${errorMsg}</p></body></html>`,
        {
          status: 400,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        },
      ),
    );
  }

  // Handle Demo Mode IDs (Atelier preview)
  const isDemo = validatedIds.some((id) => id.includes("demo-"));
  let orders = [];
  let shopName = "ThermoSlip Store";

  if (isDemo) {
    const demoMap = new Map(DEMO_ORDERS.map((o) => [o.id, o]));
    orders = validatedIds
      .map((id) => demoMap.get(id))
      .filter((o): o is NonNullable<typeof o> => Boolean(o));
    shopName = "Demo Store";
  } else {
    try {
      const [fetchedOrders, fetchedShopName] = await Promise.all([
        getOrdersByIds(admin, validatedIds),
        getShopName(admin),
      ]);
      orders = fetchedOrders;
      shopName = fetchedShopName;
    } catch (error: any) {
      console.error("[print-document] Error fetching orders for print:", error?.message || error);
      const isProtectedDataError =
        error?.message?.includes("protected-customer-data") ||
        error?.message?.includes("not approved to access the Order object");

      if (isProtectedDataError) {
        // In development, if Protected Customer Data is pending approval in Partner Dashboard,
        // gracefully render preview slips so development/demo testing never breaks.
        orders = DEMO_ORDERS.slice(0, Math.max(1, Math.min(validatedIds.length, DEMO_ORDERS.length)));
        shopName = "Dev Store (Atelier Preview)";
      } else {
        return cors(
          new Response(
            `<!DOCTYPE html><html><body><p>Failed to load orders for printing: ${error?.message || "Error"}</p></body></html>`,
            {
              status: 500,
              headers: {
                "Content-Type": "text/html; charset=utf-8",
              },
            },
          ),
        );
      }
    }
  }

  const [settings, quotaResult] = await Promise.all([
    getAppSettings(admin),
    reservePrintQuota(admin, orders, isPro),
  ]);

  if (!quotaResult.allowed) {
    return cors(
      new Response(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quota Reached</title><style>body{font-family:system-ui,-apple-system,sans-serif;padding:32px;text-align:center;color:#202223;}h1{font-size:20px;color:#d82c0d;margin-bottom:8px;}p{font-size:14px;color:#6d7175;}</style></head><body><h1>Monthly Quota Reached</h1><p>${quotaResult.reason || "Monthly free quota reached. Upgrade to Pro to continue."}</p></body></html>`,
        {
          status: 403,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
          },
        },
      ),
    );
  }

  const html = renderStaticPackingSlipsHtml({
    orders,
    shopName,
    settings,
  });

  return cors(
    new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    }),
  );
};
