import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateSupportInput,
  formatSupportMessageText,
  MockSupportEmailService,
  ResendSupportEmailService,
  getSupportEmailService,
  setSupportEmailService,
  type SupportMessagePayload,
} from "./support-email.server";

describe("SupportEmailService & Validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSupportEmailService(null);
  });

  afterEach(() => {
    setSupportEmailService(null);
  });

  describe("validateSupportInput", () => {
    it("accepts valid input with all fields", () => {
      const result = validateSupportInput({
        subject: "Printer alignment issue",
        message: "When printing with Munbyn, the bottom margin is slightly off.",
        email: "merchant@example.com",
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it("accepts valid input without optional email", () => {
      const result = validateSupportInput({
        subject: "Question about Pro quota",
        message: "Can I increase my quota mid-month without changing plans?",
        email: "",
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual({});
    });

    it("rejects empty or whitespace-only subject", () => {
      const result = validateSupportInput({
        subject: "   ",
        message: "Detailed description of the problem encountered.",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.subject).toBe("Subject is required.");
    });

    it("rejects subject exceeding 200 characters", () => {
      const result = validateSupportInput({
        subject: "a".repeat(201),
        message: "Detailed description of the problem encountered.",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.subject).toContain("200 characters or less");
    });

    it("rejects empty message", () => {
      const result = validateSupportInput({
        subject: "Valid subject",
        message: "",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.message).toBe("Message is required.");
    });

    it("rejects message with fewer than 10 characters", () => {
      const result = validateSupportInput({
        subject: "Valid subject",
        message: "Help plz",
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.message).toContain("at least 10 characters");
    });

    it("rejects invalid email formats", () => {
      const invalidEmails = [
        "plainaddress",
        "@missingusername.com",
        "username@.com",
        "username@domain..com",
        "username@domain",
      ];

      for (const email of invalidEmails) {
        const result = validateSupportInput({
          subject: "Valid subject",
          message: "Valid message with more than ten characters.",
          email,
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.email).toBe("Please enter a valid email address.");
      }
    });
  });

  describe("formatSupportMessageText", () => {
    it("formats text email body with all metadata correctly", () => {
      const payload: SupportMessagePayload = {
        shopDomain: "my-store.myshopify.com",
        replyTo: "merchant@example.com",
        subject: "Thermal barcode blurry",
        message: "The Code 128 barcode is not scanning on Zebra ZD420.",
        plan: "Pro",
        appVersion: "1.0.0",
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        sentAt: "2026-09-19T10:00:00.000Z",
      };

      const formatted = formatSupportMessageText(payload);

      expect(formatted).toContain("Store Domain : my-store.myshopify.com");
      expect(formatted).toContain("Reply-To     : merchant@example.com");
      expect(formatted).toContain("Plan         : Pro");
      expect(formatted).toContain("App Version  : 1.0.0");
      expect(formatted).toContain("Sent At      : 2026-09-19T10:00:00.000Z");
      expect(formatted).toContain("User Agent   : Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
      expect(formatted).toContain("Thermal barcode blurry");
      expect(formatted).toContain("The Code 128 barcode is not scanning on Zebra ZD420.");
    });

    it("handles missing optional metadata cleanly", () => {
      const payload: SupportMessagePayload = {
        shopDomain: "my-store.myshopify.com",
        subject: "Simple question",
        message: "How do I print multiple orders at once?",
        plan: "Free",
      };

      const formatted = formatSupportMessageText(payload);

      expect(formatted).toContain("Store Domain : my-store.myshopify.com");
      expect(formatted).toContain("Reply-To     : Not provided (use Shopify Admin)");
      expect(formatted).toContain("Plan         : Free");
    });
  });

  describe("MockSupportEmailService", () => {
    it("records sent messages and returns success", async () => {
      const service = new MockSupportEmailService();
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const payload: SupportMessagePayload = {
        shopDomain: "dev-store.myshopify.com",
        replyTo: "dev@example.com",
        subject: "Test subject",
        message: "Secret customer details that should not be logged in clear text.",
        plan: "Free",
      };

      const result = await service.sendSupportMessage(payload);

      expect(result.success).toBe(true);
      expect(service.sentMessages).toHaveLength(1);
      expect(service.sentMessages[0]).toEqual(payload);

      // Verify privacy-safe logging: message text and email must NOT be logged in full
      expect(consoleLogSpy).toHaveBeenCalledWith("[SupportEmailService Mock]", {
        shopDomain: "dev-store.myshopify.com",
        subject: "Test subject",
        hasReplyTo: true,
        messageLength: payload.message.length,
      });

      consoleLogSpy.mockRestore();
    });
  });

  describe("ResendSupportEmailService", () => {
    it("successfully sends email via fetch to Resend API", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "email-123" }),
      });
      global.fetch = mockFetch;

      const service = new ResendSupportEmailService({
        apiKey: "re_test_key_123",
        fromEmail: "support@devcraft-solutions.org",
        toEmail: "contact@devcraft-solutions.org",
      });

      const payload: SupportMessagePayload = {
        shopDomain: "dev-store.myshopify.com",
        replyTo: "merchant@example.com",
        subject: "Can't print barcode",
        message: "My thermal printer skips barcodes.",
        plan: "Pro",
      };

      const result = await service.sendSupportMessage(payload);

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer re_test_key_123",
          "Content-Type": "application/json",
        },
        body: expect.stringContaining("contact@devcraft-solutions.org"),
      });

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.from).toBe("support@devcraft-solutions.org");
      expect(body.to).toEqual(["contact@devcraft-solutions.org"]);
      expect(body.reply_to).toBe("merchant@example.com");
      expect(body.subject).toBe("[ThermoSlip Support] [PRO] Can't print barcode");
      expect(body.text).toContain("My thermal printer skips barcodes.");
    });

    it("handles Resend API error gracefully without leaking secrets to the caller", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "Forbidden: invalid api key re_test_key_123",
      });
      global.fetch = mockFetch;

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const service = new ResendSupportEmailService({
        apiKey: "re_invalid_key",
      });

      const payload: SupportMessagePayload = {
        shopDomain: "dev-store.myshopify.com",
        subject: "Error test",
        message: "Testing error handling.",
        plan: "Free",
      };

      const result = await service.sendSupportMessage(payload);

      expect(result.success).toBe(false);
      // Friendly message without leaking raw API details
      expect(result.error).toBe("We couldn't send your message. Please try again.");
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("handles network failure gracefully", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("Network offline"));
      global.fetch = mockFetch;

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const service = new ResendSupportEmailService({
        apiKey: "re_test_key",
      });

      const payload: SupportMessagePayload = {
        shopDomain: "dev-store.myshopify.com",
        subject: "Network test",
        message: "Testing network disconnect.",
        plan: "Free",
      };

      const result = await service.sendSupportMessage(payload);

      expect(result.success).toBe(false);
      expect(result.error).toBe("We couldn't send your message. Please try again.");

      consoleErrorSpy.mockRestore();
    });
  });

  describe("getSupportEmailService factory", () => {
    it("returns MockSupportEmailService by default when no API key is present", () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.SUPPORT_EMAIL_PROVIDER;

      const service = getSupportEmailService();
      expect(service).toBeInstanceOf(MockSupportEmailService);
    });

    it("allows dependency injection via setSupportEmailService", () => {
      const customMock = new MockSupportEmailService();
      setSupportEmailService(customMock);

      expect(getSupportEmailService()).toBe(customMock);
    });
  });
});
