import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader, action } from "../routes/app.settings";
import * as shopifyServer from "../shopify.server";
import * as metafieldsServer from "./metafields.server";
import * as ordersServer from "./orders.server";
import { DEFAULT_SETTINGS } from "../types/thermoslip";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("./metafields.server", () => ({
  getAppSettings: vi.fn(),
  saveAppSettings: vi.fn(),
}));

vi.mock("./orders.server", () => ({
  getShopName: vi.fn(),
}));

describe("app.settings route (Story 4.3, FR-13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shopifyServer.authenticate.admin).mockResolvedValue({
      admin: { graphql: vi.fn() } as any,
    } as any);
  });

  describe("loader", () => {
    it("returns shop settings and shopName", async () => {
      vi.mocked(metafieldsServer.getAppSettings).mockResolvedValue({
        ...DEFAULT_SETTINGS,
        showSku: false,
        footer: "Custom Return Policy",
      });
      vi.mocked(ordersServer.getShopName).mockResolvedValue("Acme Workshop");

      const request = new Request("https://myshop.myshopify.com/app/settings");
      const data = await loader({ request, params: {}, context: {} } as any);

      expect(data.settings.showSku).toBe(false);
      expect(data.settings.footer).toBe("Custom Return Policy");
      expect(data.shopName).toBe("Acme Workshop");
    });
  });

  describe("action", () => {
    it("rejects footer exceeding 120 characters with explicit field error", async () => {
      const formData = new FormData();
      formData.set("showLogo", "true");
      formData.set("showAddress", "true");
      formData.set("showSku", "true");
      formData.set("showNotes", "true");
      formData.set("footer", "x".repeat(121));

      const request = new Request("https://myshop.myshopify.com/app/settings", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.success).toBe(false);
      expect(response.fieldErrors?.footer).toBe(
        "Footer message must be 120 characters or less.",
      );
      expect(metafieldsServer.saveAppSettings).not.toHaveBeenCalled();
    });

    it("parses form data and persists settings when valid", async () => {
      vi.mocked(metafieldsServer.saveAppSettings).mockResolvedValue({
        success: true,
      });

      const formData = new FormData();
      formData.set("showLogo", "false");
      formData.set("showAddress", "true");
      formData.set("showSku", "false");
      formData.set("showNotes", "true");
      formData.set("footer", "Thank you for supporting small business!");

      const request = new Request("https://myshop.myshopify.com/app/settings", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.success).toBe(true);
      expect(metafieldsServer.saveAppSettings).toHaveBeenCalledWith(
        expect.anything(),
        {
          showLogo: false,
          showAddress: true,
          showSku: false,
          showNotes: true,
          footer: "Thank you for supporting small business!",
        },
      );
    });

    it("returns error details if saveAppSettings fails", async () => {
      vi.mocked(metafieldsServer.saveAppSettings).mockResolvedValue({
        success: false,
        userErrors: [{ message: "Owner record does not exist", field: ["metafields"] }],
      });

      const formData = new FormData();
      formData.set("showLogo", "true");
      formData.set("footer", "Test");

      const request = new Request("https://myshop.myshopify.com/app/settings", {
        method: "POST",
        body: formData,
      });

      const response = await action({ request, params: {}, context: {} } as any);

      expect(response.success).toBe(false);
      expect(response.userErrors?.[0].message).toBe("Owner record does not exist");
    });
  });
});
