import React from "react";
import {
  IndexTable,
  Card,
  useIndexResourceState,
  Text,
  Badge,
  EmptyState,
  InlineStack,
  Box,
  Button,
} from "@shopify/polaris";
import type { IndexTableProps } from "@shopify/polaris";
import type { Order, OrderFilter, WarningCode } from "../types/thermoslip";
import { formatRelativeTime, formatItemsToPackCount } from "../lib/formatters";

const WARNING_CONFIG: Record<
  WarningCode,
  { label: string; tone: "attention" | "info" | "critical" }
> = {
  MULTI_QTY: { label: "Multiple Qty", tone: "attention" },
  CUSTOMER_NOTE: { label: "Note", tone: "info" },
  EXPRESS: { label: "Express", tone: "critical" },
};

export interface OrderListProps {
  orders: Order[];
  filter: OrderFilter;
  selectedResources?: string[];
  selectedOrderIds?: string[];
  allResourcesSelected?: boolean;
  onSelectionChange?: IndexTableProps["onSelectionChange"];
  onSelectedOrderIdsChange?: (selectedIds: string[]) => void;
  promotedBulkActions?: IndexTableProps["promotedBulkActions"];
  onReprint?: (orderId: string) => void;
}

export function OrderList({
  orders,
  filter,
  selectedResources,
  selectedOrderIds,
  allResourcesSelected,
  onSelectionChange,
  onSelectedOrderIdsChange,
  promotedBulkActions,
  onReprint,
}: OrderListProps) {
  const resourceName = {
    singular: "order",
    plural: "orders",
  };

  const internalResourceState = useIndexResourceState(
    orders as unknown as Array<{ [key: string]: unknown; id: string }>,
    {
      selectedResources: selectedResources ?? selectedOrderIds,
    }
  );

  const selectedList = onSelectionChange
    ? (selectedResources ?? selectedOrderIds ?? [])
    : internalResourceState.selectedResources;

  const isAllSelected = onSelectionChange
    ? (allResourcesSelected ?? (orders.length > 0 && selectedList.length === orders.length))
    : internalResourceState.allResourcesSelected;

  const handleSelection = onSelectionChange ?? internalResourceState.handleSelectionChange;

  React.useEffect(() => {
    if (!onSelectionChange) {
      onSelectedOrderIdsChange?.(internalResourceState.selectedResources);
    }
  }, [internalResourceState.selectedResources, onSelectedOrderIdsChange, onSelectionChange]);

  if (orders.length === 0) {
    if (filter === "ready") {
      return (
        <Card>
          <EmptyState
            heading="You're all caught up"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>No orders ready to pack.</p>
          </EmptyState>
        </Card>
      );
    }

    return (
      <Card>
        <EmptyState
          heading="No orders found"
          image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
        >
          <p>There are no unfulfilled or partially fulfilled orders matching the queue.</p>
        </EmptyState>
      </Card>
    );
  }

  const rowMarkup = orders.map((order, index) => {
    const isPrinted = order.printStatus === "printed";
    const knownQuantity = order.lineItems.reduce(
      (total, item) => total + item.quantityToPack,
      0
    );
    const itemsLabel = formatItemsToPackCount(knownQuantity, Boolean(order.hasMoreItems));
    const relativeTime = formatRelativeTime(order.createdAt);

    return (
      <IndexTable.Row
        id={order.id}
        key={order.id}
        selected={selectedList.includes(order.id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {order.name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{relativeTime}</IndexTable.Cell>
        <IndexTable.Cell>{order.customerName}</IndexTable.Cell>
        <IndexTable.Cell>{itemsLabel}</IndexTable.Cell>
        <IndexTable.Cell>
          {order.warnings && order.warnings.length > 0 ? (
            <InlineStack gap="100">
              {order.warnings.map((w) => {
                const config = WARNING_CONFIG[w.code];
                return (
                  <Badge key={w.code} tone={config.tone}>
                    {config.label}
                  </Badge>
                );
              })}
            </InlineStack>
          ) : (
            <Text as="span" tone="subdued">
              —
            </Text>
          )}
        </IndexTable.Cell>
        <IndexTable.Cell>
          {isPrinted ? (
            <InlineStack gap="200" align="start" blockAlign="center">
              <Badge tone="info">Printed</Badge>
              {onReprint && (
                <span onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="micro"
                    variant="plain"
                    onClick={() => onReprint(order.id)}
                    accessibilityLabel={`Reprint packing slip for ${order.name}`}
                  >
                    Reprint
                  </Button>
                </span>
              )}
            </InlineStack>
          ) : (
            <Badge tone="attention">Ready</Badge>
          )}
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Card padding="0">
      <IndexTable
        resourceName={resourceName}
        itemCount={orders.length}
        selectedItemsCount={
          isAllSelected ? "All" : selectedList.length
        }
        onSelectionChange={handleSelection}
        promotedBulkActions={promotedBulkActions}
        headings={[
          { title: "Order" },
          { title: "Date" },
          { title: "Customer" },
          { title: "Items to pack" },
          { title: "Warnings" },
          { title: "Status" },
        ]}
      >
        {rowMarkup}
      </IndexTable>
    </Card>
  );
}
