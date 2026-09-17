import type { Warning } from "../types/thermoslip";

export type PackingWarningInput = {
  lineItems: Array<{
    unfulfilledQuantity?: number | null;
    quantityToPack?: number | null;
  }>;
  note?: string | null;
  shippingMethod?: string | null;
};

export const EXPRESS_KEYWORDS = [
  "express",
  "chrono",
  "next day",
  "priority",
  "24h",
  "24 hours",
  "urgent",
] as const;

/**
 * Pure business logic engine to compute workshop packing warnings.
 * Evaluates MULTI_QTY, CUSTOMER_NOTE, and EXPRESS in deterministic order.
 *
 * NOTE on shippingMethod:
 * Uses a heuristic substring search over EXPRESS_KEYWORDS. This is an operational
 * workshop heuristic for V1, not a strict carrier API truth (e.g. 'Priority' triggers EXPRESS;
 * 'Non-priority' also triggers EXPRESS via substring match).
 */
export function computePackingWarnings(order: PackingWarningInput): Warning[] {
  const warnings: Warning[] = [];

  // Rule 1: MULTI_QTY
  // Priority: quantityToPack ?? unfulfilledQuantity ?? 0
  const hasMultipleQty = (order.lineItems ?? []).some((item) => {
    const qty = item.quantityToPack ?? item.unfulfilledQuantity ?? 0;
    return qty > 1;
  });

  if (hasMultipleQty) {
    warnings.push({ code: "MULTI_QTY" });
  }

  // Rule 2: CUSTOMER_NOTE (non-empty, non-whitespace customer note)
  const hasNote = Boolean(order.note && order.note.trim().length > 0);
  if (hasNote) {
    warnings.push({ code: "CUSTOMER_NOTE" });
  }

  // Rule 3: EXPRESS (shipping method matches any express keyword)
  const normalizedShipping = order.shippingMethod?.trim().toLowerCase() ?? "";
  const isExpress = EXPRESS_KEYWORDS.some((keyword) =>
    normalizedShipping.includes(keyword)
  );

  if (isExpress) {
    warnings.push({ code: "EXPRESS" });
  }

  return warnings;
}
