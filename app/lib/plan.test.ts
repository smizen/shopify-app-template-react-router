import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  billingService,
  isProPlan,
  setMockPlanForTesting,
  resetMockPlanForTesting,
  setSimulatePartnerApiFailureForTesting,
} from "./plan.server";

describe("isProPlan — Stable Key Identification (Story 5.2, FR-15)", () => {
  it("returns true for recognized pro handles regardless of case", () => {
    expect(isProPlan({ id: "1", handle: "pro" })).toBe(true);
    expect(isProPlan({ id: "2", handle: "pro-monthly" })).toBe(true);
    expect(isProPlan({ id: "3", handle: "PRO-ANNUAL" })).toBe(true);
  });

  it("returns true for recognized pro GIDs", () => {
    expect(isProPlan({ id: "gid://shopify/AppPricingPlan/pro" })).toBe(true);
    expect(isProPlan({ id: "gid://shopify/AppPricingPlan/pro-annual" })).toBe(true);
  });

  it("returns false for null, empty, or unrecognized plans", () => {
    expect(isProPlan(null)).toBe(false);
    expect(isProPlan(undefined)).toBe(false);
    expect(isProPlan({ id: "custom-enterprise", handle: "enterprise" })).toBe(false);
    expect(isProPlan({ id: "custom-free", handle: "free" })).toBe(false);
  });
});

describe("BillingService — Shopify App Pricing Partner API (Story 5.2, FR-15)", () => {
  beforeEach(() => {
    resetMockPlanForTesting();
  });

  it("returns 'free' and isPro=false when activeSubscription is null (No active contract)", async () => {
    const mockPartnerClient = {
      graphql: vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            activeSubscription: null,
          },
        }),
      }),
    };

    const context = {
      partnerClient: mockPartnerClient,
      shopId: "gid://shopify/Shop/123",
      appId: "gid://shopify/App/456",
    };

    const plan = await billingService.getPlan(context);
    const isPro = await billingService.isPro(context);

    expect(plan).toBe("free");
    expect(isPro).toBe(false);
    expect(mockPartnerClient.graphql).toHaveBeenCalledTimes(2);
  });

  it("returns 'pro' and isPro=true for Active Pro Monthly subscription", async () => {
    const mockPartnerClient = {
      graphql: vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            activeSubscription: {
              id: "gid://shopify/AppSubscription/sub-1",
              status: "ACTIVE",
              plan: {
                id: "gid://shopify/AppPricingPlan/pro-monthly",
                handle: "pro-monthly",
                name: "Pro Monthly",
              },
            },
          },
        }),
      }),
    };

    const context = {
      partnerClient: mockPartnerClient,
      shopId: "gid://shopify/Shop/123",
      appId: "gid://shopify/App/456",
    };

    const plan = await billingService.getPlan(context);
    const isPro = await billingService.isPro(context);

    expect(plan).toBe("pro");
    expect(isPro).toBe(true);
  });

  it("returns 'pro' and isPro=true for Active Pro Annual subscription", async () => {
    const mockPartnerClient = {
      graphql: vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            activeSubscription: {
              id: "gid://shopify/AppSubscription/sub-2",
              status: "ACTIVE",
              plan: {
                id: "gid://shopify/AppPricingPlan/pro-annual",
                handle: "pro-annual",
                name: "Pro Annual ($49/year)",
              },
            },
          },
        }),
      }),
    };

    const context = {
      partnerClient: mockPartnerClient,
      shopId: "gid://shopify/Shop/123",
      appId: "gid://shopify/App/456",
    };

    const plan = await billingService.getPlan(context);
    const isPro = await billingService.isPro(context);

    expect(plan).toBe("pro");
    expect(isPro).toBe(true);
  });

  it("safely defaults to 'free' when active subscription has an unknown/unmapped plan", async () => {
    const mockPartnerClient = {
      graphql: vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            activeSubscription: {
              id: "gid://shopify/AppSubscription/sub-3",
              status: "ACTIVE",
              plan: {
                id: "gid://shopify/AppPricingPlan/vip-custom",
                handle: "vip-custom",
                name: "VIP Custom",
              },
            },
          },
        }),
      }),
    };

    const context = {
      partnerClient: mockPartnerClient,
      shopId: "gid://shopify/Shop/123",
      appId: "gid://shopify/App/456",
    };

    const plan = await billingService.getPlan(context);
    const isPro = await billingService.isPro(context);

    expect(plan).toBe("free");
    expect(isPro).toBe(false);
  });

  it("applies fail-safe revenue protection when Partner API throws network error", async () => {
    const mockPartnerClient = {
      graphql: vi.fn().mockRejectedValue(new Error("Partner API connection timeout")),
    };

    const context = {
      partnerClient: mockPartnerClient,
      shopId: "gid://shopify/Shop/123",
      appId: "gid://shopify/App/456",
    };

    const plan = await billingService.getPlan(context);
    const isPro = await billingService.isPro(context);

    // Never unlock Pro arbitrarily on API failures
    expect(plan).toBe("free");
    expect(isPro).toBe(false);
  });

  it("supports mockPlan in testing environment", async () => {
    setMockPlanForTesting("pro");
    expect(await billingService.isPro()).toBe(true);
    expect(await billingService.getPlan()).toBe("pro");

    setMockPlanForTesting("free");
    expect(await billingService.isPro()).toBe(false);
    expect(await billingService.getPlan()).toBe("free");
  });

  it("provides getUpgradeUrl abstraction with store domain", async () => {
    const url = await billingService.getUpgradeUrl({
      shopDomain: "my-store.myshopify.com",
    });
    expect(url).toBe("https://my-store.myshopify.com/admin/charges/pricing_plans");

    const fallbackUrl = await billingService.getUpgradeUrl({});
    expect(fallbackUrl).toBe("/app/billing");
  });
});
