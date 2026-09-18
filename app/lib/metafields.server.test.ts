import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  setOrdersPrintedStatus,
  getAppSettings,
  saveAppSettings,
  METAFIELDS_SET_MUTATION,
  METAFIELD_APP_NAMESPACE,
  PRINT_STATUS_KEY,
  PRINTED_VALUE,
} from "./metafields.server";
import { DEMO_ORDERS } from "./demo-orders";
import { DEFAULT_SETTINGS } from "../types/thermoslip";

describe("metafields.server — setOrdersPrintedStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles empty order IDs array without calling GraphQL", async () => {
    const mockAdmin = { graphql: vi.fn() };
    const result = await setOrdersPrintedStatus(mockAdmin as any, []);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(0);
    expect(mockAdmin.graphql).not.toHaveBeenCalled();
  });

  it("updates demo orders in memory without calling GraphQL", async () => {
    const mockAdmin = { graphql: vi.fn() };
    const demoId = "gid://shopify/Order/demo-1001";
    const demoOrder = DEMO_ORDERS.find((o) => o.id === demoId)!;
    demoOrder.printStatus = null;

    const result = await setOrdersPrintedStatus(mockAdmin as any, [demoId]);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(demoOrder.printStatus).toBe("printed");
    expect(mockAdmin.graphql).not.toHaveBeenCalled();
  });

  it("calls metafieldsSet mutation with correct namespace and key for real orders", async () => {
    const mockAdmin = {
      graphql: vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            metafieldsSet: {
              metafields: [
                {
                  id: "gid://shopify/Metafield/1",
                  namespace: METAFIELD_APP_NAMESPACE,
                  key: PRINT_STATUS_KEY,
                  value: PRINTED_VALUE,
                },
              ],
              userErrors: [],
            },
          },
        }),
      }),
    };

    const orderId = "gid://shopify/Order/123456";
    const result = await setOrdersPrintedStatus(mockAdmin as any, [orderId]);

    expect(result.success).toBe(true);
    expect(result.updatedCount).toBe(1);
    expect(result.userErrors).toEqual([]);
    expect(mockAdmin.graphql).toHaveBeenCalledTimes(1);

    const callArgs = mockAdmin.graphql.mock.calls[0];
    expect(callArgs[0]).toBe(METAFIELDS_SET_MUTATION);
    expect(callArgs[1].variables.metafields).toEqual([
      {
        ownerId: orderId,
        namespace: "$app",
        key: "print_status",
        type: "single_line_text_field",
        value: "printed",
      },
    ]);
  });

  it("batches orders into chunks of 25 when order count exceeds 25", async () => {
    const mockAdmin = {
      graphql: vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            metafieldsSet: {
              metafields: Array.from({ length: 25 }, (_, i) => ({
                id: `gid://shopify/Metafield/${i}`,
                namespace: "$app",
                key: "print_status",
                value: "printed",
              })),
              userErrors: [],
            },
          },
        }),
      }),
    };

    const orderIds = Array.from(
      { length: 30 },
      (_, i) => `gid://shopify/Order/${i + 100}`,
    );

    const result = await setOrdersPrintedStatus(mockAdmin as any, orderIds);

    // 30 items split into 25 + 5 -> 2 GraphQL calls
    expect(mockAdmin.graphql).toHaveBeenCalledTimes(2);
    expect(mockAdmin.graphql.mock.calls[0][1].variables.metafields.length).toBe(25);
    expect(mockAdmin.graphql.mock.calls[1][1].variables.metafields.length).toBe(5);
    expect(result.success).toBe(true);
  });

  it("handles and captures userErrors gracefully without crashing", async () => {
    const mockAdmin = {
      graphql: vi.fn().mockResolvedValue({
        json: async () => ({
          data: {
            metafieldsSet: {
              metafields: [],
              userErrors: [
                {
                  field: ["metafields", "0"],
                  message: "Owner does not exist",
                  code: "INVALID",
                },
              ],
            },
          },
        }),
      }),
    };

    const orderId = "gid://shopify/Order/999999";
    const result = await setOrdersPrintedStatus(mockAdmin as any, [orderId]);

    expect(result.success).toBe(false);
    expect(result.updatedCount).toBe(0);
    expect(result.userErrors.length).toBe(1);
    expect(result.userErrors[0].message).toBe("Owner does not exist");
  });
});

describe("metafields.server — getAppSettings & saveAppSettings (Story 4.3, FR-13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAppSettings", () => {
    it("returns DEFAULT_SETTINGS if admin is null or undefined", async () => {
      const settings = await getAppSettings(null);
      expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it("parses stored JSON metafield and merges with defaults", async () => {
      const mockAdmin = {
        graphql: vi.fn().mockResolvedValue({
          json: async () => ({
            data: {
              currentAppInstallation: {
                id: "gid://shopify/AppInstallation/123",
                settings: {
                  id: "gid://shopify/Metafield/999",
                  value: JSON.stringify({
                    showSku: false,
                    footer: "Thanks for shopping!",
                  }),
                },
              },
            },
          }),
        }),
      };

      const settings = await getAppSettings(mockAdmin as any);
      expect(settings.showSku).toBe(false);
      expect(settings.showLogo).toBe(true); // default preserved
      expect(settings.showAddress).toBe(true); // default preserved
      expect(settings.footer).toBe("Thanks for shopping!");
    });

    it("falls back to default settings when query throws or returns null", async () => {
      const mockAdmin = {
        graphql: vi.fn().mockRejectedValue(new Error("GraphQL query error")),
      };

      const settings = await getAppSettings(mockAdmin as any);
      expect(settings).toBeDefined();
      expect(settings.showLogo).toBe(true);
    });
  });

  describe("saveAppSettings", () => {
    it("rejects footer longer than 120 chars with explicit validation error without calling GraphQL", async () => {
      const mockAdmin = { graphql: vi.fn() };
      const longFooter = "a".repeat(121);

      const result = await saveAppSettings(mockAdmin as any, {
        footer: longFooter,
      });

      expect(result.success).toBe(false);
      expect(result.fieldErrors?.footer).toBe("Footer must be 120 characters or less.");
      expect(mockAdmin.graphql).not.toHaveBeenCalled();
    });

    it("persists valid settings with metafieldsSet on currentAppInstallation.id", async () => {
      const mockAdmin = {
        graphql: vi
          .fn()
          // 1st call: query currentAppInstallation
          .mockResolvedValueOnce({
            json: async () => ({
              data: {
                currentAppInstallation: {
                  id: "gid://shopify/AppInstallation/456",
                },
              },
            }),
          })
          // 2nd call: mutation metafieldsSet
          .mockResolvedValueOnce({
            json: async () => ({
              data: {
                metafieldsSet: {
                  metafields: [{ id: "gid://shopify/Metafield/999" }],
                  userErrors: [],
                },
              },
            }),
          }),
      };

      const result = await saveAppSettings(mockAdmin as any, {
        showLogo: false,
        showSku: false,
        footer: "Fast Shipping Guaranteed",
      });

      expect(result.success).toBe(true);
      expect(mockAdmin.graphql).toHaveBeenCalledTimes(2);

      const setCallArgs = mockAdmin.graphql.mock.calls[1];
      expect(setCallArgs[1].variables.metafields[0]).toEqual({
        ownerId: "gid://shopify/AppInstallation/456",
        namespace: "thermoslip",
        key: "settings",
        type: "json",
        value: JSON.stringify({
          showLogo: false,
          showAddress: true,
          showSku: false,
          showNotes: true,
          footer: "Fast Shipping Guaranteed",
        }),
      });
    });
  });
});
