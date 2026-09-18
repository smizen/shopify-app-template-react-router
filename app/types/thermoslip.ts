// ─────────────────────────────────────────────────────────────────────────────
// ThermoSlip ‑ Order Printer — Shared Types
// All identifiers use slug "thermoslip" — never the marketing name with dashes.
// ─────────────────────────────────────────────────────────────────────────────

// ── Packing Warnings ────────────────────────────────────────────────────────

export type WarningCode = "MULTI_QTY" | "CUSTOMER_NOTE" | "EXPRESS";

export interface Warning {
  code: WarningCode;
}

// ── Line Items ───────────────────────────────────────────────────────────────

export interface LineItem {
  id: string;
  title: string;
  variantTitle: string | null;
  quantity: number;
  currentQuantity?: number;
  unfulfilledQuantity: number;
  refundableQuantity?: number;
  requiresShipping: boolean;
  sku: string | null;
  /**
   * Computed: requiresShipping ? Math.max(0, Math.min(unfulfilledQuantity, refundableQuantity)) : 0
   */
  quantityToPack: number;
}

// ── Orders ───────────────────────────────────────────────────────────────────

export type PrintStatus = "printed" | null;
export type OrderFilter = "ready" | "all";

export interface Order {
  id: string;
  /** Display name e.g. "#1042" */
  name: string;
  createdAt: string;
  /** Resolved customer/recipient name for packing slip and table view */
  customerName: string;
  note: string | null;
  shippingMethod: string | null;
  shippingAddress: ShippingAddress | null;
  lineItems: LineItem[];
  /** Flagged true if an order has more lineItems than the first 15 fetched in list view */
  hasMoreItems?: boolean;
  /** From app-owned Order metafield $app / print_status */
  printStatus: PrintStatus;
  warnings: Warning[];
}

export interface ShippingAddress {
  name?: string | null;
  formatted: string[];
  city: string | null;
  country: string | null;
}

// ── Settings (App-data metafield AppInstallation thermoslip/settings) ────────

export interface Settings {
  /** Store branding / logo in slip header */
  showLogo: boolean;
  showBranding?: boolean;
  showAddress: boolean;
  showSku: boolean;
  showNotes: boolean;
  /** Optional custom footer, max 120 chars */
  footer: string;
}

export const DEFAULT_SETTINGS: Settings = {
  showLogo: true,
  showAddress: true,
  showSku: true,
  showNotes: true,
  footer: "",
};

// ── Usage / Quota (App-data metafield AppInstallation thermoslip/usage) ──────
// NFR-QUOTA-INTENT: quota consumed at print intent (doc generation), not at
// status confirmation.
// NFR-REPRINT-CROSSMONTH: a command with printStatus="printed" is always a
// reprint regardless of the month.

export interface Usage {
  /** ISO year-month e.g. "2026-09" */
  period: string;
  /** Number of unique orders that consumed quota this period */
  consumed: number;
  /** GIDs of orders that consumed quota this period (dedup guard) */
  countedOrderIds: string[];
}

export const DEFAULT_USAGE: Usage = {
  period: "",
  consumed: 0,
  countedOrderIds: [],
};

export const FREE_TIER_LIMIT = 50;

// ── Plan ─────────────────────────────────────────────────────────────────────

export type Plan = "free" | "pro";

export interface QuotaState {
  isUnlimited: boolean;
  remaining: number | null;
}

// ── Loader return types ───────────────────────────────────────────────────────

export interface AppIndexLoaderData {
  orders: Order[];
  settings: Settings;
  usage: Usage;
  plan: Plan;
  isPro: boolean;
  quotaState: QuotaState;
  remaining: number | null;
}
