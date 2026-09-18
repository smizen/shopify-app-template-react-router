import { Modal, Text, BlockStack } from "@shopify/polaris";

export interface ConfirmPrintModalProps {
  open: boolean;
  orderCount: number;
  newOrderCount?: number;
  isSubmitting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function getConfirmModalText(orderCount: number, newOrderCount?: number) {
  const isAllReprint = newOrderCount !== undefined && newOrderCount === 0;

  if (isAllReprint) {
    return {
      title: "Reprint Complete",
      heading: "Reprint complete",
      description: "These orders are already marked as Printed. Their status remains unchanged.",
      primaryActionText: "Done",
      secondaryActionText: null as string | null,
    };
  }

  const targetCount = newOrderCount ?? orderCount;
  const targetPlural = targetCount > 1 ? "orders" : "order";
  const isMixed = newOrderCount !== undefined && newOrderCount > 0 && newOrderCount < orderCount;

  return {
    title: "Confirm Printing",
    heading: isMixed
      ? `Mark ${targetCount} new ${targetPlural} as printed? (${orderCount - targetCount} already printed)`
      : `Did your packing slips print successfully for ${orderCount} ${targetPlural}?`,
    description:
      "Marking them as printed will move them to the Printed list in your active orders queue.",
    primaryActionText: "Yes, mark as printed",
    secondaryActionText: "No, keep in queue",
  };
}

/**
 * Story 4.1 (FR-10) & Story 4.2 (FR-12) — Explicit Post-Print Confirmation Modal
 *
 * Prompts the workshop operator after the browser print dialog closes:
 * - New orders: "Yes, mark as printed" → Submits mutation to set $app:print_status = "printed"
 * - 100% Reprints: "Done" → Returns cleanly without mutation or quota consumption
 * - Mixed batch: Confirms only unprinted orders
 */
export function ConfirmPrintModal({
  open,
  orderCount,
  newOrderCount,
  isSubmitting = false,
  onConfirm,
  onCancel,
}: ConfirmPrintModalProps) {
  const text = getConfirmModalText(orderCount, newOrderCount);
  const isAllReprint = newOrderCount !== undefined && newOrderCount === 0;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={text.title}
      primaryAction={{
        content: text.primaryActionText,
        onAction: onConfirm,
        loading: isSubmitting,
        disabled: isSubmitting,
      }}
      secondaryActions={
        text.secondaryActionText
          ? [
              {
                content: text.secondaryActionText,
                onAction: onCancel,
                disabled: isSubmitting,
              },
            ]
          : []
      }
    >
      <Modal.Section>
        <BlockStack gap="300">
          <Text as="p" variant="bodyMd" fontWeight={isAllReprint ? "semibold" : "regular"}>
            {text.heading}
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            {text.description}
          </Text>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
