import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { loader as indexLoader } from "../routes/app._index";
import { loader as printLoader } from "../routes/app.print";
import { authenticate } from "../shopify.server";
import { getReadyToPackOrders, getOrdersByIds } from "./orders.server";
import { getAppUsage } from "./quota.server";
import { DEMO_ORDERS } from "./demo-orders";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("./orders.server", () => ({
  getReadyToPackOrders: vi.fn(),
  getOrdersByIds: vi.fn(),
  getShopName: vi.fn().mockResolvedValue("Test Store"),
  validateAndDedupeOrderIds: vi.fn((ids) => ids),
}));

vi.mock("./quota.server", () => ({
  getAppUsage: vi.fn(),
  getQuotaState: vi.fn().mockReturnValue({ isUnlimited: false, remaining: 50 }),
}));

vi.mock("./plan.server", () => ({
  billingService: {
    isPro: vi.fn().mockResolvedValue(false),
  },
}));

describe("Production Safety Guard — No Demo Orders in Production (Point 9)", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticate.admin).mockResolvedValue({
      admin: {
        graphql: vi.fn(),
      } as any,
      session: { shop: "live-store.myshopify.com" } as any,
    } as any);

    vi.mocked(getAppUsage).mockResolvedValue({
      usage: { period: "2026-09", consumed: 0, countedOrderIds: [] },
    } as any);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("never returns DEMO_ORDERS when NODE_ENV=production on Shopify API failure", async () => {
    process.env.NODE_ENV = "production";

    // Simulate Shopify GraphQL network or query failure
    vi.mocked(getReadyToPackOrders).mockRejectedValueOnce(
      new Error("Shopify GraphQL Internal Server Error 500")
    );

    const request = new Request("https://thermoslip-order-printer.fly.dev/app");
    const result = await indexLoader({
      request,
      params: {},
      context: {},
    } as any);

    // Assert: must return empty orders array, NEVER mock DEMO_ORDERS
    expect(result.orders).toEqual([]);
    expect(result.orders).not.toEqual(DEMO_ORDERS);
    expect(result.isDemoMode).toBe(false);
    expect(result.isProduction).toBe(true);
    expect(result.errorMessage).toBe("We couldn't load your Shopify orders. Please try again.");
  });

  it("never returns DEMO_ORDERS when NODE_ENV=production on Protected Customer Data (PCD) denial", async () => {
    process.env.NODE_ENV = "production";

    // Simulate PCD access error
    vi.mocked(getReadyToPackOrders).mockRejectedValueOnce(
      new Error("Access denied: protected-customer-data scope required")
    );

    const request = new Request("https://thermoslip-order-printer.fly.dev/app");
    const result = await indexLoader({
      request,
      params: {},
      context: {},
    } as any);

    expect(result.orders).toEqual([]);
    expect(result.isDemoMode).toBe(false);
    expect(result.isProduction).toBe(true);
    expect(result.errorMessage).toContain("Protected Customer Data");
  });

  it("allows DEMO_ORDERS fallback only in development environment", async () => {
    process.env.NODE_ENV = "development";

    vi.mocked(getReadyToPackOrders).mockRejectedValueOnce(
      new Error("API network failure in local development")
    );

    const request = new Request("http://localhost:3000/app");
    const result = await indexLoader({
      request,
      params: {},
      context: {},
    } as any);

    // In development only, atelier preview orders are permitted for UI inspection
    expect(result.orders).toEqual(DEMO_ORDERS);
    expect(result.isDemoMode).toBe(true);
    expect(result.isProduction).toBe(false);
  });

  it("never returns DEMO_ORDERS on /app/print when NODE_ENV=production on Protected Customer Data error", async () => {
    process.env.NODE_ENV = "production";

    vi.mocked(getOrdersByIds).mockRejectedValueOnce(
      new Error("Access denied: protected-customer-data scope required")
    );

    const request = new Request("https://thermoslip-order-printer.fly.dev/app/print?orders=gid://shopify/Order/1");
    const result = await printLoader({
      request,
      params: {},
      context: {},
    } as any);

    expect(result.orders).toEqual([]);
    expect(result.orders).not.toEqual(DEMO_ORDERS);
    expect(result.error).toContain("Protected Customer Data");
  });

  it("never returns DEMO_ORDERS on /app/print when NODE_ENV=production on general API error", async () => {
    process.env.NODE_ENV = "production";

    vi.mocked(getOrdersByIds).mockRejectedValueOnce(
      new Error("Shopify 500 Internal Error")
    );

    const request = new Request("https://thermoslip-order-printer.fly.dev/app/print?orders=gid://shopify/Order/1");
    const result = await printLoader({
      request,
      params: {},
      context: {},
    } as any);

    expect(result.orders).toEqual([]);
    expect(result.orders).not.toEqual(DEMO_ORDERS);
    expect(result.error).toBe("Shopify 500 Internal Error");
  });
});
