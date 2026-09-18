import type { LinksFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSubmit, useNavigation, redirect } from "react-router";
import { useState } from "react";
import { Page, BlockStack, Banner, Button, InlineStack, Text, Box } from "@shopify/polaris";
import { PrintIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import {
  validateAndDedupeOrderIds,
  getOrdersByIds,
  getShopName,
} from "../lib/orders.server";
import { setOrdersPrintedStatus, getAppSettings } from "../lib/metafields.server";
import { reservePrintQuota } from "../lib/quota.server";
import { billingService } from "../lib/plan.server";
import { PackingSlipPage, calculateTotalPages } from "../components/PackingSlip/PackingSlipPage";
import { ConfirmPrintModal } from "../components/PackingSlip/ConfirmPrintModal";
import { DEFAULT_SETTINGS } from "../types/thermoslip";
import type { Order, Settings } from "../types/thermoslip";
import { DEMO_ORDERS } from "../lib/demo-orders";
import { AppIcon } from "../components/AppIcon";
import printStyles from "../components/PackingSlip/print.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: printStyles },
];

/**
 * Story 3.1, 4.1, 4.2 & 4.3 — Print Route Loader
 *
 * Security model: query-string IDs are treated as a user-supplied hint only.
 * Every ID is re-fetched from the Shopify Admin GraphQL API after authentication.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const isPro = await billingService.isPro({ admin, session });

  const url = new URL(request.url);
  const rawOrdersParam = url.searchParams.get("orders") ?? "";
  const isReprint = url.searchParams.get("reprint") === "true";
  const isSample = url.searchParams.get("sample") === "true";

  // Story 4.3: Sample preview mode from Settings
  if (isSample) {
    const [settings, shopName] = await Promise.all([
      getAppSettings(admin),
      getShopName(admin),
    ]);
    return {
      orders: [DEMO_ORDERS[1]],
      shopName: shopName || "Demo Store",
      settings,
      isReprint: false,
      error: null,
    };
  }

  const rawIds = rawOrdersParam
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  // Guard: validate, dedupe, cap at 50. Throws Response(400) on invalid input.
  let validatedIds: string[];
  try {
    validatedIds = validateAndDedupeOrderIds(rawIds);
  } catch (err: any) {
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
    const [settings, shopName] = await Promise.all([
      getAppSettings(admin),
      getShopName(admin),
    ]);
    const demoMap = new Map(DEMO_ORDERS.map((o) => [o.id, o]));
    const orders = validatedIds
      .map((id) => demoMap.get(id))
      .filter((o): o is Order => Boolean(o));

    const quotaResult = await reservePrintQuota(admin, orders, isPro);
    if (!quotaResult.allowed) {
      return {
        orders: [] as Order[],
        shopName: "",
        settings,
        isReprint,
        error: quotaResult.reason || "Monthly free quota reached. Upgrade to Pro for unlimited printing.",
      };
    }

    return {
      orders,
      shopName: shopName || "Demo Store",
      settings,
      isReprint,
      error: null,
    };
  }

  try {
    // Fetch orders, shop name, and app settings concurrently
    const [orders, shopName, settings] = await Promise.all([
      getOrdersByIds(admin, validatedIds),
      getShopName(admin),
      getAppSettings(admin),
    ]);

    const quotaResult = await reservePrintQuota(admin, orders, isPro);
    if (!quotaResult.allowed) {
      return {
        orders: [] as Order[],
        shopName: "",
        settings,
        isReprint,
        error: quotaResult.reason || "Monthly free quota reached. Upgrade to Pro for unlimited printing.",
      };
    }

    return {
      orders,
      shopName,
      settings,
      isReprint,
      error: null,
    };
  } catch (err: any) {
    console.error("[Print Loader] Error fetching orders:", err?.message || err);
    const isProtectedDataError =
      err?.message?.includes("protected-customer-data") ||
      err?.message?.includes("not approved to access the Order object");

    const settings = await getAppSettings(admin);

    if (isProtectedDataError) {
      const demoOrders = DEMO_ORDERS.slice(
        0,
        Math.max(1, Math.min(validatedIds.length, DEMO_ORDERS.length)),
      );

      const quotaResult = await reservePrintQuota(admin, demoOrders, isPro);
      if (!quotaResult.allowed) {
        return {
          orders: [] as Order[],
          shopName: "",
          settings,
          isReprint,
          error: quotaResult.reason || "Monthly free quota reached. Upgrade to Pro for unlimited printing.",
        };
      }

      return {
        orders: demoOrders,
        shopName: "Dev Store (Atelier Preview)",
        settings,
        isReprint,
        error: null,
      };
    }

    return {
      orders: [] as Order[],
      shopName: "",
      settings,
      isReprint,
      error: err?.message || "Failed to load orders for printing.",
    };
  }
};

/**
 * Story 4.1 — Action for marking orders as Printed via $app:print_status
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "mark_printed") {
    const rawIds = formData.get("orderIds");
    const orderIds: string[] = typeof rawIds === "string" ? JSON.parse(rawIds) : [];

    if (orderIds.length > 0) {
      await setOrdersPrintedStatus(admin, orderIds);
    }

    return redirect("/app?printed=true");
  }

  return redirect("/app");
};

export default function PrintRoute() {
  const { orders, shopName, settings, isReprint, error } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [showConfirmModal, setShowConfirmModal] = useState(false);

  /**
   * Post-print dialog detection (Spike 1.6):
   * Listens for `afterprint` event and provides a 500ms timeout fallback
   * for blocking window.print() implementations.
   */
  const handlePrint = () => {
    let dialogClosed = false;

    const onDialogClose = () => {
      if (dialogClosed) return;
      dialogClosed = true;
      window.removeEventListener("afterprint", onDialogClose);
      setShowConfirmModal(true);
    };

    window.addEventListener("afterprint", onDialogClose);
    window.print();
    setTimeout(onDialogClose, 500);
  };

  const newOrders = orders.filter((o) => o.printStatus !== "printed");
  const newOrderCount = newOrders.length;
  const orderCount = orders.length;
  const isPureReprint = orderCount > 0 && newOrderCount === 0;

  const handleConfirmPrinted = () => {
    // Only mark orders that are not already printed (Story 4.2 reprint idempotence)
    const idsToMark = newOrders.map((o) => o.id);

    if (idsToMark.length === 0) {
      // 100% reprint batch: no mutation needed, navigate back directly
      navigate("/app");
      return;
    }

    submit(
      {
        intent: "mark_printed",
        orderIds: JSON.stringify(idsToMark),
      },
      { method: "post" },
    );
  };

  const handleCancelModal = () => {
    setShowConfirmModal(false);
    navigate("/app");
  };

  const totalSlipCount = orders.reduce(
    (sum, order) => sum + calculateTotalPages(order.lineItems.length),
    0,
  );

  const subtitle = error
    ? "Could not load orders"
    : orderCount > 0
      ? totalSlipCount === orderCount
        ? `${orderCount} ${orderCount === 1 ? "order" : "orders"} (${totalSlipCount} ${totalSlipCount === 1 ? "slip" : "slips"}) ready to print${isPureReprint || isReprint ? " (reprint)" : ""}`
        : `${orderCount} ${orderCount === 1 ? "order" : "orders"} (${totalSlipCount} slips) ready to print${isPureReprint || isReprint ? " (reprint)" : ""}`
      : "No orders to print";

  return (
    <Page
      title="Print Packing Slips"
      titleMetadata={<AppIcon size={28} />}
      subtitle={subtitle}
      backAction={{
        content: "Ready to Pack",
        onAction: () => navigate("/app"),
      }}
    >
      <BlockStack gap="400">
        {/* ── Error Banner ─────────────────────────────────────────────── */}
        {error && (
          <Banner
            title="Cannot print"
            tone="critical"
            action={
              error.toLowerCase().includes("quota")
                ? {
                    content: "Upgrade to Pro",
                    url: "/app/billing",
                  }
                : undefined
            }
          >
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
                    {totalSlipCount} {totalSlipCount === 1 ? "slip" : "slips"} ready
                    {totalSlipCount !== orderCount ? ` across ${orderCount} orders` : ""}
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
                  {isPureReprint ? "Reprint" : "Print"}{" "}
                  {totalSlipCount === 1 ? "1 Slip" : `${totalSlipCount} Slips`}
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
          </div>
        )}

        {/* ── Post-Print Confirmation Modal (Story 4.1 & 4.2) ─────────── */}
        <ConfirmPrintModal
          open={showConfirmModal}
          orderCount={orderCount}
          newOrderCount={newOrderCount}
          isSubmitting={isSubmitting}
          onConfirm={handleConfirmPrinted}
          onCancel={handleCancelModal}
        />
      </BlockStack>
    </Page>
  );
}
