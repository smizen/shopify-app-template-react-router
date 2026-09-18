import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader } from "../routes/app.print-document";
import * as shopifyServer from "../shopify.server";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

describe("app.print-document route loader", () => {
  const mockCors = vi.fn((res: Response) => {
    res.headers.set("Access-Control-Allow-Origin", "*");
    return res;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(shopifyServer.authenticate.admin).mockResolvedValue({
      admin: {
        graphql: vi.fn(),
      } as any,
      session: {} as any,
      cors: mockCors,
    } as any);
  });

  it("authenticates with authenticate.admin and applies cors wrapper", async () => {
    const request = new Request(
      "https://myshop.myshopify.com/app/print-document?orders=gid://shopify/Order/demo-1001",
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(shopifyServer.authenticate.admin).toHaveBeenCalledWith(request);
    expect(mockCors).toHaveBeenCalled();
    expect(response.headers.get("Content-Type")).toContain("text/html");

    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("ThermoSlip");
  });

  it("handles empty orders gracefully with empty slips document", async () => {
    const request = new Request("https://myshop.myshopify.com/app/print-document");
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(mockCors).toHaveBeenCalled();
    const html = await response.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<div id="print-root" class="print-preview-wrapper">');
  });

  it("handles demo order IDs and renders packing slip", async () => {
    const request = new Request(
      "https://myshop.myshopify.com/app/print-document?orders=gid://shopify/Order/demo-1001",
    );
    const response = await loader({ request, params: {}, context: {} } as any);

    const html = await response.text();
    expect(html).toContain("#1001");
    expect(html).toContain("Demo Store");
    expect(html).toContain("Items to Pack");
  });

  it("rejects selections exceeding 50 orders with status 400", async () => {
    const manyIds = Array.from({ length: 55 }, (_, i) => `gid://shopify/Order/${i + 1}`).join(",");
    const request = new Request(`https://myshop.myshopify.com/app/print-document?orders=${manyIds}`);
    const response = await loader({ request, params: {}, context: {} } as any);

    expect(response.status).toBe(400);
    const text = await response.text();
    expect(text).toContain("Too many orders selected (max 50, got 55)");
  });
});
