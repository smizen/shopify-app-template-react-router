import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../routes/app.support";
import * as shopifyServer from "../shopify.server";
import { billingService } from "./plan.server";
import {
  setSupportEmailService,
  MockSupportEmailService,
} from "./support-email.server";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../lib/plan.server", () => ({
  billingService: {
    getPlan: vi.fn(),
  },
}));

describe("app.support route", () => {
  let mockService: MockSupportEmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = new MockSupportEmailService();
    setSupportEmailService(mockService);

    vi.mocked(shopifyServer.authenticate.admin).mockResolvedValue({
      admin: {
        graphql: vi.fn().mockResolvedValue({
          json: async () => ({
            data: {
              shop: {
                contactEmail: "owner@shop.com",
                email: "fallback@shop.com",
              },
            },
          }),
        }),
      } as any,
      session: {
        shop: "dev-store-pbuw21v9.myshopify.com",
      } as any,
    } as any);

    vi.mocked(billingService.getPlan).mockResolvedValue("free");
  });

  describe("loader", () => {
    it("authenticates and loads store info, plan, and contact email with priority contactEmail", async () => {
      const request = new Request("https://dev-store-pbuw21v9.myshopify.com/app/support");
      const data = await loader({ request, params: {}, context: {} } as any);

      expect(shopifyServer.authenticate.admin).toHaveBeenCalledWith(request);
      expect(data.shopDomain).toBe("dev-store-pbuw21v9.myshopify.com");
      expect(data.defaultEmail).toBe("owner@shop.com");
      expect(data.plan).toBe("Free");
      expect(data.appVersion).toBe("1.0.0");
    });

    it("falls back to shop.email if contactEmail is null", async () => {
      vi.mocked(shopifyServer.authenticate.admin).mockResolvedValue({
        admin: {
          graphql: vi.fn().mockResolvedValue({
            json: async () => ({
              data: {
                shop: {
                  contactEmail: null,
                  email: "backup@shop.com",
                },
              },
            }),
          }),
        } as any,
        session: { shop: "dev-store.myshopify.com" } as any,
      } as any);

      const request = new Request("https://dev-store.myshopify.com/app/support");
      const data = await loader({ request, params: {}, context: {} } as any);

      expect(data.defaultEmail).toBe("backup@shop.com");
    });
  });

  describe("action", () => {
    it("validates and rejects empty subject and message", async () => {
      const formData = new FormData();
      formData.set("subject", "");
      formData.set("message", "");

      const request = new Request("https://dev-store-pbuw21v9.myshopify.com/app/support", {
        method: "POST",
        body: formData,
      });

      const response: any = await action({ request, params: {}, context: {} } as any);

      expect(response.success).toBe(false);
      expect(response.fieldErrors.subject).toBe("Subject is required.");
      expect(response.fieldErrors.message).toBe("Message is required.");
      expect(mockService.sentMessages).toHaveLength(0);
    });

    it("validates and rejects invalid email format", async () => {
      const formData = new FormData();
      formData.set("subject", "Valid subject title");
      formData.set("message", "This is a valid detailed message for support.");
      formData.set("email", "not-an-email");

      const request = new Request("https://dev-store-pbuw21v9.myshopify.com/app/support", {
        method: "POST",
        body: formData,
      });

      const response: any = await action({ request, params: {}, context: {} } as any);

      expect(response.success).toBe(false);
      expect(response.fieldErrors.email).toBe("Please enter a valid email address.");
      expect(mockService.sentMessages).toHaveLength(0);
    });

    it("dispatches support message with enriched metadata on valid submission", async () => {
      vi.mocked(billingService.getPlan).mockResolvedValue("pro");

      const formData = new FormData();
      formData.set("subject", "Munbyn printer margins");
      formData.set("message", "The 4x6 labels are cutting off 2mm at the bottom.");
      formData.set("email", "warehouse@merchant.com");

      const request = new Request("https://dev-store-pbuw21v9.myshopify.com/app/support", {
        method: "POST",
        headers: {
          "user-agent": "Mozilla/5.0 (Macintosh; Mac OS X)",
        },
        body: formData,
      });

      const response: any = await action({ request, params: {}, context: {} } as any);

      expect(response.success).toBe(true);
      expect(mockService.sentMessages).toHaveLength(1);

      const sent = mockService.sentMessages[0];
      expect(sent.shopDomain).toBe("dev-store-pbuw21v9.myshopify.com");
      expect(sent.subject).toBe("Munbyn printer margins");
      expect(sent.message).toBe("The 4x6 labels are cutting off 2mm at the bottom.");
      expect(sent.replyTo).toBe("warehouse@merchant.com");
      expect(sent.plan).toBe("PRO");
      expect(sent.userAgent).toBe("Mozilla/5.0 (Macintosh; Mac OS X)");
      expect(sent.sentAt).toBeDefined();
    });

    it("returns friendly error without leaking secrets if email service fails", async () => {
      const failingService = {
        sendSupportMessage: vi.fn().mockResolvedValue({
          success: false,
          error: "We couldn't send your message. Please try again.",
        }),
      };
      setSupportEmailService(failingService);

      const formData = new FormData();
      formData.set("subject", "Valid subject title");
      formData.set("message", "This is a valid detailed message for support.");

      const request = new Request("https://dev-store-pbuw21v9.myshopify.com/app/support", {
        method: "POST",
        body: formData,
      });

      const response: any = await action({ request, params: {}, context: {} } as any);

      expect(response.success).toBe(false);
      expect(response.error).toBe("We couldn't send your message. Please try again.");
    });
  });
});
