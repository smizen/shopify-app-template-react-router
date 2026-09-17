import type { Warning, WarningCode } from "../../types/thermoslip";

const WARNING_PRINT_CONFIG: Record<WarningCode, { label: string; symbol: string }> = {
  MULTI_QTY: { label: "MULTI QTY", symbol: "×" },
  CUSTOMER_NOTE: { label: "NOTE", symbol: "!" },
  EXPRESS: { label: "EXPRESS", symbol: "★" },
};

interface WarningBannerProps {
  warnings: Warning[];
}

/**
 * Renders packing warning badges optimized for thermal print.
 * Uses plain CSS classes (no Polaris) so that styles are fully predictable
 * at print time without Polaris CSS specificity interference.
 */
export function WarningBanner({ warnings }: WarningBannerProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="slip-warnings">
      {warnings.map((w) => {
        const config = WARNING_PRINT_CONFIG[w.code];
        return (
          <span
            key={w.code}
            className={`slip-warning-badge slip-warning-badge--${w.code}`}
          >
            {config.symbol} {config.label}
          </span>
        );
      })}
    </div>
  );
}
