import { describe, it, expect, vi, beforeEach } from "vitest";
import { action } from "../routes/app.print";
import * as shopifyServer from "../shopify.server";
import * as metafieldsServer from "./metafields.server";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("./metafields.server", () => ({
  setOrdersPrintedStatus: vi.fn().mockResolvedValue({
    success: true,
    updatedCount: 1,
    userErrors: [],
  }),
}));

describe("app.print action (Story 4.1, FR-11)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shopifyServer.authenticate.admin).mockResolvedValue({
      admin: {
        graphql: vi.fn(),
      } as any,
      session: {} as any,
      cors: vi.fn((res) => res),
    } as any);
  });

  it("calls setOrdersPrintedStatus with parsed IDs and redirects with printed=true", async () => {
    const formData = new FormData();
    formData.set("intent", "mark_printed");
    formData.set(
      "orderIds",
      JSON.stringify(["gid://shopify/Order/1001", "gid://shopify/Order/1002"]),
    );

    const request = new Request("https://myshop.myshopify.com/app/print", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);

    expect(metafieldsServer.setOrdersPrintedStatus).toHaveBeenCalledWith(
      expect.anything(),
      ["gid://shopify/Order/1001", "gid://shopify/Order/1002"],
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/app?printed=true");
  });

  it("skips setOrdersPrintedStatus if no orderIds provided", async () => {
    const formData = new FormData();
    formData.set("intent", "mark_printed");
    formData.set("orderIds", JSON.stringify([]));

    const request = new Request("https://myshop.myshopify.com/app/print", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);

    expect(metafieldsServer.setOrdersPrintedStatus).not.toHaveBeenCalled();
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/app?printed=true");
  });

  it("redirects to /app on unknown intent", async () => {
    const formData = new FormData();
    formData.set("intent", "cancel");

    const request = new Request("https://myshop.myshopify.com/app/print", {
      method: "POST",
      body: formData,
    });

    const response = await action({ request, params: {}, context: {} } as any);

    expect(metafieldsServer.setOrdersPrintedStatus).not.toHaveBeenCalled();
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/app");
  });
});
