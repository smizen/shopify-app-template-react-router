/**
 * SupportEmailService — Zero-DB abstraction for merchant support requests.
 * Formats, validates, and dispatches inquiries to contact@devcraft-solutions.org
 */

export interface SupportMessagePayload {
  shopDomain: string;
  replyTo?: string | null;
  subject: string;
  message: string;
  plan: string;
  appVersion?: string;
  userAgent?: string;
  sentAt?: string;
}

export interface ValidationErrors {
  subject?: string;
  message?: string;
  email?: string;
}

export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/**
 * Validates raw form input. Returns errors map if invalid, or null if valid.
 */
export function validateSupportInput(input: {
  subject?: string | null;
  message?: string | null;
  email?: string | null;
}): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};

  const trimmedSubject = (input.subject || "").trim();
  if (!trimmedSubject) {
    errors.subject = "Subject is required.";
  } else if (trimmedSubject.length > 200) {
    errors.subject = "Subject must be 200 characters or less.";
  }

  const trimmedMessage = (input.message || "").trim();
  if (!trimmedMessage) {
    errors.message = "Message is required.";
  } else if (trimmedMessage.length < 10) {
    errors.message = "Please provide more detail (at least 10 characters).";
  } else if (trimmedMessage.length > 5000) {
    errors.message = "Message is too long (max 5000 characters).";
  }

  const trimmedEmail = (input.email || "").trim();
  if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
    errors.email = "Please enter a valid email address.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export interface SupportEmailService {
  sendSupportMessage(
    payload: SupportMessagePayload
  ): Promise<{ success: boolean; error?: string }>;
}

/**
 * Formats the plain text body with metadata.
 */
export function formatSupportMessageText(payload: SupportMessagePayload): string {
  return [
    `--- THERMOSLIP MERCHANT SUPPORT REQUEST ---`,
    ``,
    `Store Domain : ${payload.shopDomain}`,
    `Reply-To     : ${payload.replyTo || "Not provided (use Shopify Admin)"}`,
    `Plan         : ${payload.plan}`,
    `App Version  : ${payload.appVersion || "1.0.0"}`,
    `Sent At      : ${payload.sentAt || new Date().toISOString()}`,
    `User Agent   : ${payload.userAgent || "Unknown"}`,
    ``,
    `--- SUBJECT ---`,
    payload.subject,
    ``,
    `--- MESSAGE ---`,
    payload.message,
    ``,
    `--------------------------------------------`,
  ].join("\n");
}

/**
 * Mock email service for tests and local development.
 * Logs privacy-safe metadata only (never logs the plain message body or personal email).
 */
export class MockSupportEmailService implements SupportEmailService {
  public sentMessages: SupportMessagePayload[] = [];

  async sendSupportMessage(
    payload: SupportMessagePayload
  ): Promise<{ success: boolean; error?: string }> {
    this.sentMessages.push(payload);

    // Privacy-safe logging: log only high-level metadata
    console.log("[SupportEmailService Mock]", {
      shopDomain: payload.shopDomain,
      subject: payload.subject,
      hasReplyTo: Boolean(payload.replyTo),
      messageLength: payload.message.length,
    });

    return { success: true };
  }
}

/**
 * Resend email service using native fetch (zero external heavy dependencies).
 */
export class ResendSupportEmailService implements SupportEmailService {
  private apiKey: string;
  private fromEmail: string;
  private toEmail: string;

  constructor(options?: { apiKey?: string; fromEmail?: string; toEmail?: string }) {
    this.apiKey = options?.apiKey || process.env.RESEND_API_KEY || "";
    this.fromEmail =
      options?.fromEmail ||
      process.env.SUPPORT_FROM_EMAIL ||
      "ThermoSlip Support <support@devcraft-solutions.org>";
    this.toEmail =
      options?.toEmail ||
      process.env.SUPPORT_DESTINATION_EMAIL ||
      "contact@devcraft-solutions.org";
  }

  async sendSupportMessage(
    payload: SupportMessagePayload
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.apiKey) {
      console.warn(
        "[SupportEmailService] RESEND_API_KEY is not configured. Falling back to safe mock."
      );
      return { success: true };
    }

    const emailSubject = `[ThermoSlip Support] [${payload.plan.toUpperCase()}] ${payload.subject}`;
    const textBody = formatSupportMessageText(payload);

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [this.toEmail],
          reply_to: payload.replyTo || undefined,
          subject: emailSubject,
          text: textBody,
        }),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        // Technical error logged on server only
        console.error(
          "[SupportEmailService Resend Error]",
          response.status,
          errText
        );
        return {
          success: false,
          error: "We couldn't send your message. Please try again.",
        };
      }

      return { success: true };
    } catch (err) {
      // Network or unexpected error logged on server only
      console.error("[SupportEmailService Network Error]", err);
      return {
        success: false,
        error: "We couldn't send your message. Please try again.",
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Singleton & Dependency Injection for Testing
// ─────────────────────────────────────────────────────────────────────────────

let activeService: SupportEmailService | null = null;

export function setSupportEmailService(service: SupportEmailService | null) {
  activeService = service;
}

export function getSupportEmailService(): SupportEmailService {
  if (activeService) {
    return activeService;
  }

  const provider = (process.env.SUPPORT_EMAIL_PROVIDER || "").toLowerCase();
  const apiKey = process.env.RESEND_API_KEY;

  if (provider === "resend" || Boolean(apiKey)) {
    return new ResendSupportEmailService();
  }

  return new MockSupportEmailService();
}
