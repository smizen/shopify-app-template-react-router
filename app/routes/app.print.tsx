import type { LinksFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import { Page, BlockStack, Banner, Button, InlineStack, Text, Box } from "@shopify/polaris";
import { PrintIcon, ArrowLeftIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import {
  validateAndDedupeOrderIds,
  getOrdersByIds,
  getShopName,
} from "../lib/orders.server";
import { PackingSlipPage } from "../components/PackingSlip/PackingSlipPage";
import { DEFAULT_SETTINGS } from "../types/thermoslip";
import type { Order, Settings } from "../types/thermoslip";
import { DEMO_ORDERS } from "../lib/demo-orders";
import printStyles from "../components/PackingSlip/print.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: printStyles },
];

/**
 * Story 3.1 — Print Route Loader
 *
 * Security model: query-string IDs are treated as a user-supplied hint only.
 * Every ID is re-fetched from the Shopify Admin GraphQL API after authentication.
 * The user cannot inject data — they can only select IDs, which are validated
 * and re-fetched server-side.
 *
 * Architecture:
 *  1. Authenticate Shopify Admin
 *  2. Parse + validate + dedupe order IDs (max 50, must be valid GIDs)
 *  3. In Demo Mode, return matching mock orders directly
 *  4. Fetch full order data in batches of 20 (cost-safe)
 *  5. Paginate lineItems per order until hasNextPage = false
 *  6. Preserve selection order
 *  7. Fetch shop name (non-blocking)
 *  8. Load settings (Story 4.3 will load from metafield; Story 3.1 uses defaults)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const rawOrdersParam = url.searchParams.get("orders") ?? "";
  const isReprint = url.searchParams.get("reprint") === "true";

  const rawIds = rawOrdersParam
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  // Guard: validate, dedupe, cap at 50. Throws Response(400) on invalid input.
  let validatedIds: string[];
  try {
    validatedIds = validateAndDedupeOrderIds(rawIds);
  } catch (err: any) {
    // Return a user-facing error instead of crashing the render
    return {
      orders: [] as Order[],
      shopName: "",
      settings: DEFAULT_SETTINGS as Settings,
      isReprint,
      error: err instanceof Response ? await err.text() : "Invalid order selection.",
    };
  }

  // Handle Demo Mode IDs (Atelier preview)
  const isDemo = validatedIds.some((id) => id.includes("demo-"));
  if (isDemo) {
    const demoMap = new Map(DEMO_ORDERS.map((o) => [o.id, o]));
    const demoOrders = validatedIds
      .map((id) => demoMap.get(id))
      .filter((o): o is Order => Boolean(o));

    return {
      orders: demoOrders,
      shopName: "ThermoSlip Atelier",
      settings: DEFAULT_SETTINGS as Settings,
      isReprint,
      error: null,
    };
  }

  try {
    // Fetch orders and shop name concurrently
    const [orders, shopName] = await Promise.all([
      getOrdersByIds(admin, validatedIds),
      getShopName(admin),
    ]);

    // Story 4.3 will load settings from App-data metafield.
    // For Story 3.1, apply defaults (all sections visible).
    const settings: Settings = DEFAULT_SETTINGS;

    return {
      orders,
      shopName,
      settings,
      isReprint,
      error: null,
    };
  } catch (err: any) {
    console.error("[Print Loader] Error fetching orders:", err?.message || err);
    return {
      orders: [] as Order[],
      shopName: "",
      settings: DEFAULT_SETTINGS as Settings,
      isReprint,
      error: err?.message || "Failed to load orders for printing.",
    };
  }
};

export default function PrintRoute() {
  const { orders, shopName, settings, isReprint, error } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const handlePrint = () => {
    // Story 4.1 will intercept the afterprint event for the confirmation modal.
    // For Story 3.1, print triggers directly on click (NFR: never via useEffect).
    window.print();
  };

  const orderCount = orders.length;
  const subtitle = error
    ? "Could not load orders"
    : orderCount > 0
      ? `${orderCount} ${orderCount === 1 ? "order" : "orders"} ready to print${isReprint ? " (reprint)" : ""}`
      : "No orders to print";

  return (
    <Page
      title="Print Packing Slips"
      subtitle={subtitle}
      backAction={{
        content: "Ready to Pack",
        onAction: () => navigate("/app"),
      }}
    >
      <BlockStack gap="400">
        {/* ── Error Banner ─────────────────────────────────────────────── */}
        {error && (
          <Banner title="Cannot print" tone="critical">
            <p>{error}</p>
          </Banner>
        )}

        {/* ── No Orders Warning ────────────────────────────────────────── */}
        {!error && orderCount === 0 && (
          <Banner title="No orders selected" tone="warning">
            <p>
              No valid orders were found for the selected IDs. Please go back
              and select at least one order.
            </p>
          </Banner>
        )}

        {/* ── Print Toolbar (screen-only) ──────────────────────────────── */}
        {orderCount > 0 && (
          <div className="screen-only">
            <Box
              background="bg-surface"
              padding="400"
              borderRadius="200"
              shadow="100"
            >
              <InlineStack align="space-between" blockAlign="center">
                <BlockStack gap="100">
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {orderCount} {orderCount === 1 ? "slip" : "slips"} ready
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Preview below — click Print to send to your thermal printer.
                    Set paper size to 4×6 in and margins to None in the print
                    dialog.
                  </Text>
                </BlockStack>
                <Button
                  variant="primary"
                  icon={PrintIcon}
                  onClick={handlePrint}
                  size="large"
                >
                  Print {orderCount === 1 ? "Slip" : `${orderCount} Slips`}
                </Button>
              </InlineStack>
            </Box>
          </div>
        )}

        {/* ── Packing Slips Preview + Print Root ──────────────────────── */}
        {orderCount > 0 && (
          <div id="print-root">
            <div className="print-preview-wrapper screen-only-bg">
              {orders.map((order) => (
                <PackingSlipPage
                  key={order.id}
                  order={order}
                  settings={settings}
                  shopName={shopName}
                />
              ))}
            </div>
            {/* The slips rendered above are also what prints.
                #print-root is visible in both screen and print contexts. */}
          </div>
        )}
      </BlockStack>
    </Page>
  );
}
