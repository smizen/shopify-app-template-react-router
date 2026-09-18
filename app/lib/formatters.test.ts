import { describe, it, expect } from "vitest";
import {
  formatRelativeTime,
  formatItemsToPackCount,
  getPrintButtonText,
  getPrintButtonTooltip,
} from "./formatters";

describe("formatRelativeTime", () => {
  const baseTime = new Date("2026-09-16T12:00:00Z");

  it("returns 'just now' for dates less than 60 seconds ago", () => {
    const date = new Date("2026-09-16T11:59:35Z"); // 25s ago
    expect(formatRelativeTime(date, baseTime)).toBe("just now");
  });

  it("returns 'just now' for dates slightly in the future due to slight clock drift", () => {
    const futureDate = new Date("2026-09-16T12:00:05Z");
    expect(formatRelativeTime(futureDate, baseTime)).toBe("just now");
  });

  it("returns '1 minute ago' for 60 to 119 seconds ago", () => {
    const date = new Date("2026-09-16T11:58:45Z"); // 75s ago
    expect(formatRelativeTime(date, baseTime)).toBe("1 minute ago");
  });

  it("returns 'X minutes ago' for 2 to 59 minutes ago", () => {
    const date5m = new Date("2026-09-16T11:55:00Z"); // 5m ago
    expect(formatRelativeTime(date5m, baseTime)).toBe("5 minutes ago");

    const date42m = new Date("2026-09-16T11:18:00Z"); // 42m ago
    expect(formatRelativeTime(date42m, baseTime)).toBe("42 minutes ago");
  });

  it("returns '1 hour ago' for 60 to 119 minutes ago", () => {
    const date1h = new Date("2026-09-16T10:45:00Z"); // 1h 15m ago
    expect(formatRelativeTime(date1h, baseTime)).toBe("1 hour ago");
  });

  it("returns 'X hours ago' for 2 to 23 hours ago", () => {
    const date2h = new Date("2026-09-16T10:00:00Z"); // 2h ago
    expect(formatRelativeTime(date2h, baseTime)).toBe("2 hours ago");

    const date14h = new Date("2026-09-15T22:00:00Z"); // 14h ago
    expect(formatRelativeTime(date14h, baseTime)).toBe("14 hours ago");
  });

  it("returns 'Yesterday' for 24 to 47 hours ago", () => {
    const dateYesterday = new Date("2026-09-15T11:00:00Z"); // 25h ago
    expect(formatRelativeTime(dateYesterday, baseTime)).toBe("Yesterday");
  });

  it("returns 'X days ago' for 2 or more days ago", () => {
    const date3Days = new Date("2026-09-13T12:00:00Z"); // 3 days ago
    expect(formatRelativeTime(date3Days, baseTime)).toBe("3 days ago");
  });

  it("returns empty string for invalid dates", () => {
    expect(formatRelativeTime("invalid-date-string", baseTime)).toBe("");
  });
});

describe("formatItemsToPackCount", () => {
  it("formats singular item count correctly", () => {
    expect(formatItemsToPackCount(1, false)).toBe("1 item");
  });

  it("formats plural items count correctly", () => {
    expect(formatItemsToPackCount(0, false)).toBe("0 items");
    expect(formatItemsToPackCount(4, false)).toBe("4 items");
  });

  it("appends '+' when hasMoreItems is true", () => {
    expect(formatItemsToPackCount(15, true)).toBe("15+ items");
    expect(formatItemsToPackCount(8, true)).toBe("8+ items");
  });
});

describe("getPrintButtonText", () => {
  it("returns 'Print Packing Slips' when 0 selected", () => {
    expect(getPrintButtonText(0)).toBe("Print Packing Slips");
    expect(getPrintButtonText(-1)).toBe("Print Packing Slips");
  });

  it("returns 'Print 1 Packing Slip' when 1 selected", () => {
    expect(getPrintButtonText(1)).toBe("Print 1 Packing Slip");
  });

  it("returns 'Print X Packing Slips' when multiple selected", () => {
    expect(getPrintButtonText(2)).toBe("Print 2 Packing Slips");
    expect(getPrintButtonText(10)).toBe("Print 10 Packing Slips");
    expect(getPrintButtonText(50)).toBe("Print 50 Packing Slips");
  });

  it("returns 'Reprint' variants when isReprintAll is true", () => {
    expect(getPrintButtonText(0, true)).toBe("Reprint Packing Slips");
    expect(getPrintButtonText(1, true)).toBe("Reprint 1 Packing Slip");
    expect(getPrintButtonText(3, true)).toBe("Reprint 3 Packing Slips");
  });
});

describe("getPrintButtonTooltip", () => {
  it("returns undefined when 0 items selected", () => {
    expect(getPrintButtonTooltip({ newCount: 0, reprintCount: 0 })).toBeUndefined();
  });

  it("returns undefined when only new items selected", () => {
    expect(getPrintButtonTooltip({ newCount: 1, reprintCount: 0 })).toBeUndefined();
    expect(getPrintButtonTooltip({ newCount: 5, reprintCount: 0 })).toBeUndefined();
  });

  it("returns undefined when only reprint items selected", () => {
    expect(getPrintButtonTooltip({ newCount: 0, reprintCount: 1 })).toBeUndefined();
    expect(getPrintButtonTooltip({ newCount: 0, reprintCount: 3 })).toBeUndefined();
  });

  it("returns mixed tooltip with plural reprints (e.g. 8 new, 2 reprints)", () => {
    expect(getPrintButtonTooltip({ newCount: 8, reprintCount: 2 })).toBe(
      "Print 10 slips (8 new, 2 reprints)"
    );
  });

  it("returns mixed tooltip with singular reprint (e.g. 1 new, 1 reprint)", () => {
    expect(getPrintButtonTooltip({ newCount: 1, reprintCount: 1 })).toBe(
      "Print 2 slips (1 new, 1 reprint)"
    );
  });

  it("returns mixed tooltip with singular reprint and multiple new (e.g. 9 new, 1 reprint)", () => {
    expect(getPrintButtonTooltip({ newCount: 9, reprintCount: 1 })).toBe(
      "Print 10 slips (9 new, 1 reprint)"
    );
  });

  it("returns quota reached tooltip when remaining is 0 and newCount > 0", () => {
    expect(
      getPrintButtonTooltip({ newCount: 1, reprintCount: 0, remainingQuota: 0 }),
    ).toBe("Monthly free quota reached. Upgrade to Pro for unlimited printing.");

    // Reprints only at remaining = 0 does NOT show quota reached
    expect(
      getPrintButtonTooltip({ newCount: 0, reprintCount: 2, remainingQuota: 0 }),
    ).toBeUndefined();
  });

  it("returns specific count required when newCount > remainingQuota", () => {
    expect(
      getPrintButtonTooltip({ newCount: 3, reprintCount: 2, remainingQuota: 2 }),
    ).toBe("3 new prints required, only 2 remaining.");
  });

  it("ignores remainingQuota when isPro (remainingQuota is null)", () => {
    expect(
      getPrintButtonTooltip({ newCount: 3, reprintCount: 2, remainingQuota: null }),
    ).toBe("Print 5 slips (3 new, 2 reprints)");
  });
});

