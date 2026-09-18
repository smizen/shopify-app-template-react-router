import { useState, useMemo } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate } from "react-router";
import {
  Page,
  Card,
  Text,
  Banner,
  Tabs,
  BlockStack,
  useIndexResourceState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getReadyToPackOrders } from "../lib/orders.server";
import { OrderList } from "../components/OrderList";
import type { Order, OrderFilter } from "../types/thermoslip";
import {
  getPrintButtonText,
  getPrintButtonTooltip,
} from "../lib/formatters";

import { DEMO_ORDERS } from "../lib/demo-orders";
import { AppIcon } from "../components/AppIcon";
import { getAppUsage, getQuotaState } from "../lib/quota.server";
import { QuotaBanner } from "../components/QuotaBanner";
import { billingService } from "../lib/plan.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");
  const justPrinted = url.searchParams.get("printed") === "true";

  const isPro = await billingService.isPro({ admin, session });

  try {
    const [{ orders, pageInfo, cost }, { usage }] = await Promise.all([
      getReadyToPackOrders(admin, cursor),
      getAppUsage(admin),
    ]);
    const quotaState = getQuotaState(usage, isPro);

    return {
      orders,
      pageInfo,
      cost,
      isDemoMode: false,
      errorMessage: null,
      justPrinted,
      usage,
      quotaState,
      isPro,
    };
  } catch (error: any) {
    console.error("[Orders Loader] API Error:", error?.message || error);
    const isProtectedDataError =
      error?.message?.includes("protected-customer-data") ||
      error?.message?.includes("not approved to access the Order object");

    const { usage } = await getAppUsage(admin);
    const quotaState = getQuotaState(usage, isPro);

    return {
      orders: DEMO_ORDERS,
      pageInfo: { hasNextPage: false, endCursor: null },
      cost: undefined,
      isDemoMode: true,
      errorMessage: isProtectedDataError
        ? "Access to Shopify Order data requires Protected Customer Data approval in Shopify Partners Dashboard (Apps > ThermoSlip > API access > Protected customer data). Displaying atelier preview orders with warnings below."
        : error?.message || "Failed to load orders from Shopify API",
      justPrinted,
      usage,
      quotaState,
      isPro,
    };
  }
};

export default function Index() {
  const {
    orders,
    pageInfo,
    cost,
    isDemoMode,
    errorMessage,
    justPrinted,
    quotaState,
    isPro,
  } = useLoaderData<typeof loader>();
  const [showPrintedBanner, setShowPrintedBanner] = useState(Boolean(justPrinted));
  const [selectedFilter, setSelectedFilter] = useState<OrderFilter>("ready");
  const navigate = useNavigate();

  const readyOrders = useMemo(
    () => orders.filter((order) => order.printStatus === null),
    [orders]
  );

  const displayedOrders = useMemo(
    () => (selectedFilter === "ready" ? readyOrders : orders),
    [selectedFilter, readyOrders, orders]
  );

  const {
    selectedResources,
    allResourcesSelected,
    handleSelectionChange,
    clearSelection,
  } = useIndexResourceState(
    displayedOrders as unknown as Array<{ [key: string]: unknown; id: string }>
  );

  const readyCount = readyOrders.length;
  const prominentSubtitle = `Ready to pack — ${readyCount} ${readyCount === 1 ? "order" : "orders"}`;

  const tabs = [
    {
      id: "ready-orders",
      content: "Ready",
      badge: readyCount.toString(),
      panelID: "ready-orders-content",
    },
    {
      id: "all-orders",
      content: "All",
      badge: orders.length.toString(),
      panelID: "all-orders-content",
    },
  ];

  const selectedTabIndex = selectedFilter === "ready" ? 0 : 1;

  const handleTabChange = (index: number) => {
    const nextFilter: OrderFilter = index === 0 ? "ready" : "all";
    clearSelection();
    setSelectedFilter(nextFilter);
  };

  const selectedOrders = useMemo(() => {
    const selectedSet = new Set(selectedResources);
    return displayedOrders.filter((order) => selectedSet.has(order.id));
  }, [displayedOrders, selectedResources]);

  const newCount = selectedOrders.filter((order) => order.printStatus === null).length;
  const reprintCount = selectedOrders.filter((order) => order.printStatus === "printed").length;
  const isAllReprint = selectedOrders.length > 0 && newCount === 0;

  // Quota enforcement on print button:
  // Disables print button if new prints require more quota than remaining
  const isQuotaExceeded =
    !isPro &&
    quotaState.remaining !== null &&
    (quotaState.remaining === 0 ? newCount > 0 : newCount > quotaState.remaining);

  const isPrintDisabled = selectedResources.length === 0 || isQuotaExceeded;

  const printButtonText = getPrintButtonText(selectedResources.length, isAllReprint);
  const printTooltip = getPrintButtonTooltip({
    newCount,
    reprintCount,
    remainingQuota: quotaState.remaining,
  });

  const handlePrint = () => {
    if (selectedResources.length === 0 || isQuotaExceeded) return;
    const params = new URLSearchParams();
    params.set("orders", selectedResources.join(","));
    if (isAllReprint) {
      params.set("reprint", "true");
    }
    navigate(`/app/print?${params.toString()}`);
  };

  const handleSingleReprint = (orderId: string) => {
    const params = new URLSearchParams();
    params.set("orders", orderId);
    params.set("reprint", "true");
    navigate(`/app/print?${params.toString()}`);
  };

  return (
    <Page
      title="Ready to Pack"
      titleMetadata={<AppIcon size={28} />}
      subtitle={prominentSubtitle}
      primaryAction={{
        content: printButtonText,
        disabled: isPrintDisabled,
        onAction: handlePrint,
        helpText: printTooltip,
      }}
    >
      <BlockStack gap="400">
        <QuotaBanner quotaState={quotaState} />

        {showPrintedBanner && (
          <Banner
            title="Packing slips marked as printed"
            tone="success"
            onDismiss={() => setShowPrintedBanner(false)}
          >
            <p>
              The selected orders have been marked as Printed and moved out of
              the Ready to Pack queue.
            </p>
          </Banner>
        )}

        {isDemoMode && errorMessage && (
          <Banner title="Atelier Preview Mode" tone="warning">
            <p>{errorMessage}</p>
          </Banner>
        )}

        {cost && (
          <Banner title="GraphQL Query Cost (Debug)" tone="info">
            <p>
              Requested Cost: <strong>{cost.requestedQueryCost}</strong> | Actual Cost:{" "}
              <strong>{cost.actualQueryCost ?? "N/A"}</strong> | Restore Rate:{" "}
              <strong>{cost.throttleStatus?.restoreRate ?? 50}/s</strong>
            </p>
          </Banner>
        )}

        <Tabs tabs={tabs} selected={selectedTabIndex} onSelect={handleTabChange}>
          <div style={{ marginTop: "16px" }}>
            <OrderList
              orders={displayedOrders}
              filter={selectedFilter}
              selectedResources={selectedResources}
              allResourcesSelected={allResourcesSelected}
              onSelectionChange={handleSelectionChange}
              onReprint={handleSingleReprint}
              promotedBulkActions={[
                {
                  content: printButtonText,
                  onAction: handlePrint,
                },
              ]}
            />
          </div>
        </Tabs>

        {pageInfo.hasNextPage && (
          <Card>
            <Text as="p" tone="subdued">
              More orders waiting in queue. Pagination will load subsequent batches.
            </Text>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
