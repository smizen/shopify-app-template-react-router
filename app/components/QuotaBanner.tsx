import React from "react";
import { Banner, Text } from "@shopify/polaris";
import type { QuotaState } from "../types/thermoslip";

export interface QuotaBannerProps {
  quotaState: QuotaState;
  onUpgradeClick?: () => void;
}

/**
 * Story 5.1 & Story 5.3 (FR-14, FR-15) — QuotaBanner Component
 *
 * Displays the current monthly free tier printing capacity:
 * - "X prints remaining this month"
 * - If remaining is 0: "Monthly free quota reached. Upgrade to Pro for unlimited printing."
 * - Hidden when the merchant has an unlimited plan (Pro).
 */
export function QuotaBanner({ quotaState, onUpgradeClick }: QuotaBannerProps) {
  if (quotaState.isUnlimited) {
    return null;
  }

  const remaining = quotaState.remaining ?? 0;

  if (remaining === 0) {
    return (
      <Banner
        title="Monthly free quota reached"
        tone="warning"
        action={
          onUpgradeClick
            ? {
                content: "Upgrade to Pro",
                onAction: onUpgradeClick,
                url: "/app/billing",
              }
            : {
                content: "Upgrade to Pro",
                url: "/app/billing",
              }
        }
      >
        <p>Monthly free quota reached. Upgrade to Pro for unlimited printing.</p>
      </Banner>
    );
  }

  const pluralSuffix = remaining === 1 ? "print" : "prints";
  const tone = remaining <= 10 ? "warning" : "info";

  return (
    <Banner tone={tone}>
      <p>
        <strong>{remaining} {pluralSuffix}</strong> remaining this month
      </p>
    </Banner>
  );
}
