import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../routes/webhooks";
import { authenticate, sessionStorage } from "../shopify.server";

vi.mock("../shopify.server", () => ({
  authenticate: {
    webhook: vi.fn(),
  },
  sessionStorage: {
    findSessionsByShop: vi.fn(),
    deleteSessions: vi.fn(),
    deleteSession: vi.fn(),
    storeSession: vi.fn(),
  },
}));

describe("Shopify Mandatory Compliance Webhooks (/webhooks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CUSTOMERS_DATA_REQUEST", () => {
    it("acknowledges request with HTTP 200 (zero PII stored)", async () => {
      vi.mocked(authenticate.webhook).mockResolvedValueOnce({
        topic: "CUSTOMERS_DATA_REQUEST",
        shop: "test-store.myshopify.com",
        session: undefined,
        payload: {
          shop_id: 123456,
          shop_domain: "test-store.myshopify.com",
          customer: { id: 78910, email: "buyer@example.com" },
          orders_requested: [111, 222],
        },
        apiVersion: "2026-07",
        webhookId: "wh-1",
        subTopic: undefined,
      } as any);

      const request = new Request("https://thermoslip-order-printer.fly.dev/webhooks", {
        method: "POST",
      });

      const response = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(response.status).toBe(200);
      expect(sessionStorage.deleteSessions).not.toHaveBeenCalled();
    });
  });

  describe("CUSTOMERS_REDACT", () => {
    it("acknowledges request with HTTP 200 (no customer data to delete)", async () => {
      vi.mocked(authenticate.webhook).mockResolvedValueOnce({
        topic: "CUSTOMERS_REDACT",
        shop: "test-store.myshopify.com",
        session: undefined,
        payload: {
          shop_id: 123456,
          shop_domain: "test-store.myshopify.com",
          customer: { id: 78910, email: "buyer@example.com" },
          orders_to_redact: [111, 222],
        },
        apiVersion: "2026-07",
        webhookId: "wh-2",
        subTopic: undefined,
      } as any);

      const request = new Request("https://thermoslip-order-printer.fly.dev/webhooks", {
        method: "POST",
      });

      const response = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(response.status).toBe(200);
      expect(sessionStorage.deleteSessions).not.toHaveBeenCalled();
    });
  });

  describe("SHOP_REDACT", () => {
    it("purges all SQLite sessions associated with the shop and returns HTTP 200", async () => {
      vi.mocked(authenticate.webhook).mockResolvedValueOnce({
        topic: "SHOP_REDACT",
        shop: "purged-store.myshopify.com",
        session: undefined,
        payload: {
          shop_id: 999999,
          shop_domain: "purged-store.myshopify.com",
        },
        apiVersion: "2026-07",
        webhookId: "wh-3",
        subTopic: undefined,
      } as any);

      vi.mocked(sessionStorage.findSessionsByShop).mockResolvedValueOnce([
        { id: "offline_purged-store.myshopify.com", shop: "purged-store.myshopify.com" } as any,
        { id: "online_user_1", shop: "purged-store.myshopify.com" } as any,
      ]);

      const request = new Request("https://thermoslip-order-printer.fly.dev/webhooks", {
        method: "POST",
      });

      const response = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(response.status).toBe(200);
      expect(sessionStorage.findSessionsByShop).toHaveBeenCalledWith("purged-store.myshopify.com");
      expect(sessionStorage.deleteSessions).toHaveBeenCalledWith([
        "offline_purged-store.myshopify.com",
        "online_user_1",
      ]);
    });

    it("succeeds with HTTP 200 even if no active sessions exist for shop", async () => {
      vi.mocked(authenticate.webhook).mockResolvedValueOnce({
        topic: "SHOP_REDACT",
        shop: "empty-store.myshopify.com",
        session: undefined,
        payload: {
          shop_id: 888888,
          shop_domain: "empty-store.myshopify.com",
        },
        apiVersion: "2026-07",
        webhookId: "wh-4",
        subTopic: undefined,
      } as any);

      vi.mocked(sessionStorage.findSessionsByShop).mockResolvedValueOnce([]);

      const request = new Request("https://thermoslip-order-printer.fly.dev/webhooks", {
        method: "POST",
      });

      const response = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(response.status).toBe(200);
      expect(sessionStorage.findSessionsByShop).toHaveBeenCalledWith("empty-store.myshopify.com");
      expect(sessionStorage.deleteSessions).not.toHaveBeenCalled();
    });
  });

  describe("APP_UNINSTALLED", () => {
    it("purges all sessions for the uninstalled store and returns HTTP 200", async () => {
      vi.mocked(authenticate.webhook).mockResolvedValueOnce({
        topic: "APP_UNINSTALLED",
        shop: "uninstalled-store.myshopify.com",
        session: { id: "offline_uninstalled-store.myshopify.com" } as any,
        payload: {},
        apiVersion: "2026-07",
        webhookId: "wh-5",
        subTopic: undefined,
      } as any);

      vi.mocked(sessionStorage.findSessionsByShop).mockResolvedValueOnce([
        { id: "offline_uninstalled-store.myshopify.com", shop: "uninstalled-store.myshopify.com" } as any,
      ]);

      const request = new Request("https://thermoslip-order-printer.fly.dev/webhooks", {
        method: "POST",
      });

      const response = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(response.status).toBe(200);
      expect(sessionStorage.findSessionsByShop).toHaveBeenCalledWith("uninstalled-store.myshopify.com");
      expect(sessionStorage.deleteSessions).toHaveBeenCalledWith(["offline_uninstalled-store.myshopify.com"]);
    });
  });

  describe("APP_SCOPES_UPDATE", () => {
    it("updates and saves session scope when scopes change", async () => {
      const mockSession = {
        id: "offline_store.myshopify.com",
        scope: "read_orders",
      };

      vi.mocked(authenticate.webhook).mockResolvedValueOnce({
        topic: "APP_SCOPES_UPDATE",
        shop: "store.myshopify.com",
        session: mockSession as any,
        payload: { current: ["write_orders", "read_orders"] },
        apiVersion: "2026-07",
        webhookId: "wh-6",
        subTopic: undefined,
      } as any);

      const request = new Request("https://thermoslip-order-printer.fly.dev/webhooks", {
        method: "POST",
      });

      const response = await action({
        request,
        params: {},
        context: {},
      } as any);

      expect(response.status).toBe(200);
      expect(mockSession.scope).toBe("write_orders,read_orders");
      expect(sessionStorage.storeSession).toHaveBeenCalledWith(mockSession);
    });
  });

  describe("HMAC Signature Verification (Security)", () => {
    it("rejects invalid webhook requests with 401 Unauthorized", async () => {
      // authenticate.webhook throws an unauthorized 401 Response on invalid/missing HMAC
      vi.mocked(authenticate.webhook).mockRejectedValueOnce(
        new Response("Unauthorized: Invalid HMAC signature", { status: 401 })
      );

      const request = new Request("https://thermoslip-order-printer.fly.dev/webhooks", {
        method: "POST",
        headers: {
          "x-shopify-hmac-sha256": "invalid_signature",
        },
      });

      await expect(
        action({
          request,
          params: {},
          context: {},
        } as any)
      ).rejects.toMatchObject({ status: 401 });
    });
  });
});
