import type { Plan } from "../types/thermoslip";
import type { AdminGraphqlClient } from "./quota.server";

export const PRO_PLAN_HANDLES = ["pro", "pro-monthly", "pro-annual"] as const;
export const PRO_PLAN_IDS = [
  "gid://shopify/AppPricingPlan/pro",
  "gid://shopify/AppPricingPlan/pro-monthly",
  "gid://shopify/AppPricingPlan/pro-annual",
] as const;

export interface AppPricingPlanInfo {
  id: string;
  name?: string;
  handle?: string;
}

export interface ActiveSubscriptionPayload {
  id: string;
  status?: string;
  plan: AppPricingPlanInfo;
}

export interface BillingContext {
  admin?: AdminGraphqlClient | null;
  session?: { shop?: string; id?: string } | null;
  shopId?: string;
  appId?: string;
  shopDomain?: string;
  /** Custom client or fetcher for Partner API if injected */
  partnerClient?: {
    graphql: (query: string, options?: any) => Promise<Response>;
  };
}

export interface BillingService {
  getPlan(context?: BillingContext): Promise<Plan>;
  isPro(context?: BillingContext): Promise<boolean>;
  getUpgradeUrl(context?: BillingContext): Promise<string>;
}

export const GET_APP_ACTIVE_SUBSCRIPTIONS_QUERY = `#graphql
  query GetAppActiveSubscriptions {
    currentAppInstallation {
      id
      activeSubscriptions {
        id
        name
        status
        test
      }
    }
  }
`;

export const PARTNER_ACTIVE_SUBSCRIPTION_QUERY = `#graphql
  query ActiveSubscription($appId: ID!, $shopId: ID!) {
    activeSubscription(appId: $appId, shopId: $shopId) {
      id
      status
      plan {
        id
        name
        handle
      }
    }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Testing & Demo In-Memory State
// ─────────────────────────────────────────────────────────────────────────────

let inMemoryMockPlan: Plan | null = null;
let simulatePartnerApiFailure: boolean = false;

export function setMockPlanForTesting(plan: Plan | null) {
  inMemoryMockPlan = plan;
}

export function resetMockPlanForTesting() {
  inMemoryMockPlan = null;
  simulatePartnerApiFailure = false;
}

export function setSimulatePartnerApiFailureForTesting(fail: boolean) {
  simulatePartnerApiFailure = fail;
}

// ─────────────────────────────────────────────────────────────────────────────
// Plan Identification Logic (Stable Key Matching)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Checks whether an App Pricing plan is a recognized Pro plan.
 * Uses stable IDs and handles rather than fragile display name matching.
 */
export function isProPlan(plan?: AppPricingPlanInfo | null): boolean {
  if (!plan) return false;

  if (plan.handle && (PRO_PLAN_HANDLES as readonly string[]).includes(plan.handle.toLowerCase())) {
    return true;
  }

  if (plan.id && (PRO_PLAN_IDS as readonly string[]).includes(plan.id)) {
    return true;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shopify App Pricing 2026 BillingService Implementation
// ─────────────────────────────────────────────────────────────────────────────

class ShopifyAppPricingBillingService implements BillingService {
  /**
   * Evaluates the merchant's current plan:
   * 1. Via partnerClient if injected (unit testing / Partner API).
   * 2. Via Admin GraphQL currentAppInstallation.activeSubscriptions in live Shopify runtime.
   *
   * Architecture & Rules:
   * - Returns "free" when no active subscription exists.
   * - Returns "pro" if an active subscription with status ACTIVE is detected.
   * - API failure: fail-safe revenue protection — does NOT grant Pro arbitrarily.
   */
  async getPlan(context: BillingContext = {}): Promise<Plan> {
    if (inMemoryMockPlan !== null) {
      return inMemoryMockPlan;
    }

    if (simulatePartnerApiFailure) {
      console.warn("[BillingService] Simulated Partner API failure. Defaulting to free (fail-safe).");
      return "free";
    }

    // 1. Partner client pathway (unit testing / Partner API)
    if (context.partnerClient) {
      const client = context.partnerClient;
      const appId = context.appId || process.env.SHOPIFY_API_KEY || "9d6f5f485f916ddef3fb6a57db87a3a7";
      const shopId = context.shopId || context.session?.shop || context.shopDomain;

      if (!shopId) return "free";

      try {
        const response = await client.graphql(PARTNER_ACTIVE_SUBSCRIPTION_QUERY, {
          variables: { appId, shopId },
        });

        if (!response || typeof response.json !== "function") {
          console.warn("[BillingService] Empty Partner API response. Defaulting to free.");
          return "free";
        }

        const json: any = await response.json();
        const subscription: ActiveSubscriptionPayload | null =
          json.data?.activeSubscription ?? null;

        if (!subscription) {
          return "free";
        }

        if (isProPlan(subscription.plan)) {
          return "pro";
        }

        console.info(
          `[BillingService] Active subscription found with unrecognized plan handle/id: ${subscription.plan?.handle} (${subscription.plan?.id}). Defaulting to free.`,
        );
        return "free";
      } catch (err) {
        console.error("[BillingService] Partner API network or query error. Defaulting to free (fail-safe):", err);
        return "free";
      }
    }

    // 2. Admin GraphQL runtime pathway (live Shopify merchant session)
    if (context.admin) {
      try {
        const response = await context.admin.graphql(GET_APP_ACTIVE_SUBSCRIPTIONS_QUERY);
        if (!response || typeof response.json !== "function") {
          return "free";
        }

        const json: any = await response.json();
        const activeSubscriptions: Array<{ id: string; name?: string; status?: string }> =
          json.data?.currentAppInstallation?.activeSubscriptions ?? [];

        const hasActivePro = activeSubscriptions.some((sub) => {
          const status = (sub.status || "").toUpperCase();
          if (status !== "ACTIVE") return false;

          const name = (sub.name || "").toLowerCase();
          // Any active subscription that is Pro (or default paid subscription)
          return name.includes("pro") || !name.includes("free");
        });

        if (hasActivePro) {
          return "pro";
        }

        return "free";
      } catch (err) {
        console.error("[BillingService] Error checking active subscriptions via Admin API. Defaulting to free (fail-safe):", err);
        return "free";
      }
    }

    // In local dev/demo mode without admin client or Partner API credentials, default to free
    return "free";
  }

  /**
   * Returns true if the shop is currently on an active Pro plan (unlimited printing).
   */
  async isPro(context: BillingContext = {}): Promise<boolean> {
    const plan = await this.getPlan(context);
    return plan === "pro";
  }

  /**
   * Returns the official upgrade destination URL for Shopify App Pricing.
   * Leverages official environment / routing configuration without brittle hardcoding.
   */
  async getUpgradeUrl(context: BillingContext = {}): Promise<string> {
    if (process.env.SHOPIFY_APP_PRICING_URL) {
      return process.env.SHOPIFY_APP_PRICING_URL;
    }

    const shop = context.shopDomain || context.session?.shop;
    const appHandle = process.env.SHOPIFY_APP_HANDLE || "thermoslip-order-printer";

    if (shop) {
      const cleanShop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
      const storeHandle = cleanShop.replace(/\.myshopify\.com$/, "");
      return `https://admin.shopify.com/store/${storeHandle}/charges/${appHandle}/pricing_plans`;
    }

    return "/app/billing";
  }
}

export const billingService: BillingService = new ShopifyAppPricingBillingService();
