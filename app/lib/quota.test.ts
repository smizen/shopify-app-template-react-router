import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCurrentPeriod,
  resetUsageIfNewPeriod,
  getQuotaState,
  canPrint,
  getAppUsage,
  reservePrintQuota,
  resetDemoUsageForTesting,
  setDemoUsageForTesting,
  simulateConcurrencyConflictNextCall,
} from "./quota.server";
import type { Usage } from "../types/thermoslip";
import { FREE_TIER_LIMIT } from "../types/thermoslip";

describe("Quota Logic & Period Reset (Story 5.1, FR-14)", () => {
  beforeEach(() => {
    resetDemoUsageForTesting();
  });

  it("getCurrentPeriod returns format YYYY-MM", () => {
    const fixedDate = new Date("2026-09-18T12:00:00Z");
    expect(getCurrentPeriod(fixedDate)).toBe("2026-09");

    const januaryDate = new Date("2026-01-05T00:00:00Z");
    expect(getCurrentPeriod(januaryDate)).toBe("2026-01");
  });

  it("resetUsageIfNewPeriod keeps usage intact if period matches", () => {
    const usage: Usage = {
      period: "2026-09",
      consumed: 15,
      countedOrderIds: ["gid://shopify/Order/1"],
    };
    const result = resetUsageIfNewPeriod(usage, "2026-09");
    expect(result.consumed).toBe(15);
    expect(result.countedOrderIds).toEqual(["gid://shopify/Order/1"]);
  });

  it("resetUsageIfNewPeriod resets consumed and countedOrderIds if period changed", () => {
    const usage: Usage = {
      period: "2026-08",
      consumed: 45,
      countedOrderIds: ["gid://shopify/Order/1", "gid://shopify/Order/2"],
    };
    const result = resetUsageIfNewPeriod(usage, "2026-09");
    expect(result.period).toBe("2026-09");
    expect(result.consumed).toBe(0);
    expect(result.countedOrderIds).toEqual([]);
  });

  it("getQuotaState never serializes Infinity for Pro plan", () => {
    const usage: Usage = { period: "2026-09", consumed: 30, countedOrderIds: [] };
    const proState = getQuotaState(usage, true);
    expect(proState.isUnlimited).toBe(true);
    expect(proState.remaining).toBeNull();
    expect(JSON.stringify(proState)).toBe('{"isUnlimited":true,"remaining":null}');
  });

  it("getQuotaState computes remaining correctly for Free plan and clamps to 0", () => {
    const usage: Usage = { period: "2026-09", consumed: 20, countedOrderIds: [] };
    const freeState = getQuotaState(usage, false);
    expect(freeState.isUnlimited).toBe(false);
    expect(freeState.remaining).toBe(30);

    const exhaustedUsage: Usage = { period: "2026-09", consumed: 55, countedOrderIds: [] };
    const exhaustedState = getQuotaState(exhaustedUsage, false);
    expect(exhaustedState.remaining).toBe(0);
  });
});

describe("canPrint Evaluation & Reprints (Story 5.1, FR-14)", () => {
  beforeEach(() => {
    resetDemoUsageForTesting();
  });

  it("allows all orders on Pro plan regardless of count", () => {
    const usage: Usage = { period: "2026-09", consumed: 50, countedOrderIds: [] };
    const orders = Array.from({ length: 10 }, (_, i) => ({
      id: `gid://shopify/Order/${i + 1}`,
      printStatus: null,
    }));
    const result = canPrint(usage, orders, true);
    expect(result.allowed).toBe(true);
    expect(result.isUnlimited).toBe(true);
    expect(result.remaining).toBeNull();
    expect(result.newIds).toEqual([]);
  });

  it("excludes cross-month reprints (printStatus === 'printed') from quota consumption", () => {
    // Quota exhausted (consumed = 50, remaining = 0)
    const usage: Usage = { period: "2026-09", consumed: 50, countedOrderIds: [] };
    const reprints = [
      { id: "gid://shopify/Order/old-august", printStatus: "printed" },
      { id: "gid://shopify/Order/old-july", printStatus: "printed" },
    ];

    const result = canPrint(usage, reprints, false);
    expect(result.allowed).toBe(true);
    expect(result.newIds).toHaveLength(0);
    expect(result.remaining).toBe(0);
  });

  it("deduplicates orders already counted in the current month", () => {
    const usage: Usage = {
      period: "2026-09",
      consumed: 1,
      countedOrderIds: ["gid://shopify/Order/100"],
    };
    const orders = [
      { id: "gid://shopify/Order/100", printStatus: null }, // already counted
      { id: "gid://shopify/Order/101", printStatus: null }, // new
    ];

    const result = canPrint(usage, orders, false);
    expect(result.allowed).toBe(true);
    expect(result.newIds).toEqual(["gid://shopify/Order/101"]);
  });

  it("blocks entire batch if new required prints exceed remaining quota (no partial deduction)", () => {
    // 48 consumed -> 2 remaining
    const usage: Usage = { period: "2026-09", consumed: 48, countedOrderIds: [] };
    const orders = [
      { id: "gid://shopify/Order/reprint-1", printStatus: "printed" },
      { id: "gid://shopify/Order/reprint-2", printStatus: "printed" },
      { id: "gid://shopify/Order/new-1", printStatus: null },
      { id: "gid://shopify/Order/new-2", printStatus: null },
      { id: "gid://shopify/Order/new-3", printStatus: null },
    ];

    const result = canPrint(usage, orders, false);
    expect(result.allowed).toBe(false);
    expect(result.newIds).toEqual([
      "gid://shopify/Order/new-1",
      "gid://shopify/Order/new-2",
      "gid://shopify/Order/new-3",
    ]);
    expect(result.remaining).toBe(2);
    expect(result.reason).toBe("3 new prints required, only 2 remaining.");
  });

  it("displays explicit upgrade message when remaining quota is 0", () => {
    const usage: Usage = { period: "2026-09", consumed: 50, countedOrderIds: [] };
    const orders = [{ id: "gid://shopify/Order/new-1", printStatus: null }];

    const result = canPrint(usage, orders, false);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.reason).toBe(
      "Monthly free quota reached. Upgrade to Pro for unlimited printing.",
    );
  });
});

describe("reservePrintQuota & Concurrency compareDigest (Story 5.1, FR-14)", () => {
  beforeEach(() => {
    resetDemoUsageForTesting();
  });

  it("reserves quota for new orders in demo/memory environment", async () => {
    const orders = [
      { id: "demo-1", printStatus: null },
      { id: "demo-2", printStatus: null },
    ];

    const res = await reservePrintQuota(null, orders, false);
    expect(res.allowed).toBe(true);
    expect(res.usage.consumed).toBe(2);
    expect(res.usage.countedOrderIds).toEqual(["demo-1", "demo-2"]);

    // Printing again in same month doesn't increment quota
    const res2 = await reservePrintQuota(null, orders, false);
    expect(res2.allowed).toBe(true);
    expect(res2.usage.consumed).toBe(2);
  });

  it("handles GraphQL CAS with compareDigest null when creating metafield for first time", async () => {
    let capturedVariables: any = null;
    const mockAdmin = {
      graphql: vi.fn().mockImplementation(async (query: string, options?: any) => {
        if (query.includes("GetAppInstallationUsage")) {
          return {
            json: async () => ({
              data: {
                currentAppInstallation: {
                  id: "gid://shopify/AppInstallation/123",
                  usage: null, // metafield does not exist yet
                },
              },
            }),
          };
        }
        if (query.includes("MetafieldsSetUsage")) {
          capturedVariables = options?.variables;
          return {
            json: async () => ({
              data: {
                metafieldsSet: {
                  metafields: [{ id: "gid://shopify/Metafield/1", compareDigest: "digest-1" }],
                  userErrors: [],
                },
              },
            }),
          };
        }
        return { json: async () => ({}) };
      }),
    };

    const orders = [{ id: "gid://shopify/Order/1", printStatus: null }];
    const res = await reservePrintQuota(mockAdmin as any, orders, false);

    expect(res.allowed).toBe(true);
    expect(res.usage.consumed).toBe(1);
    expect(capturedVariables?.metafields[0].compareDigest).toBeNull();
  });

  it("retries on compareDigest collision and succeeds with refreshed digest", async () => {
    let callCount = 0;
    const mockAdmin = {
      graphql: vi.fn().mockImplementation(async (query: string, options?: any) => {
        if (query.includes("GetAppInstallationUsage")) {
          callCount++;
          return {
            json: async () => ({
              data: {
                currentAppInstallation: {
                  id: "gid://shopify/AppInstallation/123",
                  usage: {
                    id: "gid://shopify/Metafield/1",
                    value: JSON.stringify({
                      period: getCurrentPeriod(),
                      consumed: callCount === 1 ? 5 : 6, // changed concurrently on retry
                      countedOrderIds: callCount === 1 ? ["gid://shopify/Order/0"] : ["gid://shopify/Order/0", "gid://shopify/Order/other"],
                    }),
                    compareDigest: callCount === 1 ? "stale-digest" : "fresh-digest",
                  },
                },
              },
            }),
          };
        }
        if (query.includes("MetafieldsSetUsage")) {
          if (options?.variables?.metafields[0].compareDigest === "stale-digest") {
            // First attempt fails with collision
            return {
              json: async () => ({
                data: {
                  metafieldsSet: {
                    metafields: [],
                    userErrors: [
                      {
                        code: "COMPARE_DIGEST_MISMATCH",
                        message: "Compare digest value did not match.",
                      },
                    ],
                  },
                },
              }),
            };
          }
          // Second attempt with fresh-digest succeeds
          return {
            json: async () => ({
              data: {
                metafieldsSet: {
                  metafields: [{ id: "gid://shopify/Metafield/1", compareDigest: "digest-final" }],
                  userErrors: [],
                },
              },
            }),
          };
        }
        return { json: async () => ({}) };
      }),
    };

    const orders = [{ id: "gid://shopify/Order/my-order", printStatus: null }];
    const res = await reservePrintQuota(mockAdmin as any, orders, false);

    expect(res.allowed).toBe(true);
    expect(callCount).toBe(2); // Retried once
    expect(res.usage.consumed).toBe(7); // 6 + 1
  });
});
