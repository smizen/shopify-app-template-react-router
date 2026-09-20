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
 * Pure 1-bit monochrome styling: solid black, bold borders, zero dithering.
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
            <span className="slip-warning-symbol">{config.symbol}</span>
            <span className="slip-warning-label">{config.label}</span>
          </span>
        );
      })}
    </div>
  );
}
