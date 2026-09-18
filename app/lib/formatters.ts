/**
 * Formats an ISO date string into a clean, human-readable English relative time string.
 *
 * Examples:
 * - < 1 minute: "just now"
 * - 1 minute: "1 minute ago"
 * - 2-59 minutes: "X minutes ago"
 * - 1 hour: "1 hour ago"
 * - 2-23 hours: "X hours ago"
 * - 24-47 hours: "Yesterday"
 * - 2+ days: "X days ago"
 */
export function formatRelativeTime(dateInput: string | Date, nowInput?: string | Date): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    return "";
  }

  const now = nowInput ? (typeof nowInput === "string" ? new Date(nowInput) : nowInput) : new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Future dates or negative diff (clock skew)
  if (diffInSeconds < 0) {
    return "just now";
  }

  if (diffInSeconds < 60) {
    return "just now";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes === 1) {
    return "1 minute ago";
  }
  if (diffInMinutes < 60) {
    return `${diffInMinutes} minutes ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours === 1) {
    return "1 hour ago";
  }
  if (diffInHours < 24) {
    return `${diffInHours} hours ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return "Yesterday";
  }
  return `${diffInDays} days ago`;
}

/**
 * Formats the packable items count with pluralization and a '+' indicator if items are truncated (> 15).
 *
 * Examples:
 * - 1 item (hasMore = false): "1 item"
 * - 4 items (hasMore = false): "4 items"
 * - 15 items (hasMore = true): "15+ items"
 */
export function formatItemsToPackCount(count: number, hasMoreItems: boolean = false): string {
  if (hasMoreItems) {
    return `${count}+ items`;
  }
  return count === 1 ? "1 item" : `${count} items`;
}

/**
 * Returns the dynamic label for the print packing slips button based on selected count.
 *
 * Examples:
 * - 0: "Print Packing Slips"
 * - 1: "Print 1 Packing Slip"
 * - X > 1: "Print X Packing Slips"
 * - 1 (reprint): "Reprint 1 Packing Slip"
 * - X > 1 (reprint): "Reprint X Packing Slips"
 */
export function getPrintButtonText(selectedCount: number, isReprintAll: boolean = false): string {
  const verb = isReprintAll ? "Reprint" : "Print";
  if (selectedCount <= 0) {
    return isReprintAll ? "Reprint Packing Slips" : "Print Packing Slips";
  }
  if (selectedCount === 1) {
    return `${verb} 1 Packing Slip`;
  }
  return `${verb} ${selectedCount} Packing Slips`;
}

/**
 * Returns the tooltip text for print button:
 * - If remainingQuota is exceeded by newCount:
 *   - remaining = 0: "Monthly free quota reached. Upgrade to Pro for unlimited printing."
 *   - newCount > remaining: "X new prints required, only Y remaining."
 * - Else if mixed selection (Ready + Printed): "Print X slips (Y new, Z reprints)"
 * - Otherwise: undefined
 */
export function getPrintButtonTooltip({
  newCount,
  reprintCount,
  remainingQuota,
}: {
  newCount: number;
  reprintCount: number;
  remainingQuota?: number | null;
}): string | undefined {
  if (remainingQuota !== undefined && remainingQuota !== null) {
    if (remainingQuota === 0 && newCount > 0) {
      return "Monthly free quota reached. Upgrade to Pro for unlimited printing.";
    }
    if (newCount > remainingQuota) {
      return `${newCount} new prints required, only ${remainingQuota} remaining.`;
    }
  }

  if (newCount > 0 && reprintCount > 0) {
    const total = newCount + reprintCount;
    const reprintLabel = reprintCount === 1 ? "reprint" : "reprints";
    return `Print ${total} slips (${newCount} new, ${reprintCount} ${reprintLabel})`;
  }
  return undefined;
}

