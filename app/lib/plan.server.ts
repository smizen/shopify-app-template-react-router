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
  getPlan(context: BillingContext): Promise<Plan>;
  isPro(context: BillingContext): Promise<boolean>;
  getUpgradeUrl(context: BillingContext): Promise<string>;
}

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
   * Evaluates the merchant's current plan via Partner API activeSubscription(appId, shopId).
   *
   * Architecture & Rules:
   * 1. Returns "free" when activeSubscription === null (no active App Pricing contract).
   * 2. Returns "pro" if activeSubscription maps to a recognized Pro handle or ID.
   * 3. Unknown active plan: safe default to "free" (explicit fallback).
   * 4. Partner API failure: fail-safe revenue protection — does NOT grant Pro arbitrarily.
   */
  async getPlan(context: BillingContext = {}): Promise<Plan> {
    if (inMemoryMockPlan !== null) {
      return inMemoryMockPlan;
    }

    if (simulatePartnerApiFailure) {
      console.warn("[BillingService] Simulated Partner API failure. Defaulting to free (fail-safe).");
      return "free";
    }

    const client = context.partnerClient;
    const appId = context.appId || process.env.SHOPIFY_API_KEY || "9d6f5f485f916ddef3fb6a57db87a3a7";
    const shopId = context.shopId || context.session?.shop || context.shopDomain;

    if (!client || !shopId) {
      // In local dev/demo mode without Partner API credentials, default to free
      return "free";
    }

    try {
      const response = await client.graphql(PARTNER_ACTIVE_SUBSCRIPTION_QUERY, {
        variables: {
          appId,
          shopId,
        },
      });

      if (!response || typeof response.json !== "function") {
        console.warn("[BillingService] Empty Partner API response. Defaulting to free.");
        return "free";
      }

      const json: any = await response.json();
      const subscription: ActiveSubscriptionPayload | null =
        json.data?.activeSubscription ?? null;

      if (!subscription) {
        // null active subscription = Free plan
        return "free";
      }

      if (isProPlan(subscription.plan)) {
        return "pro";
      }

      // Explicit behavior for unknown/custom future plans: fail-safe to free unless mapped
      console.info(
        `[BillingService] Active subscription found with unrecognized plan handle/id: ${subscription.plan?.handle} (${subscription.plan?.id}). Defaulting to free.`,
      );
      return "free";
    } catch (err) {
      console.error("[BillingService] Partner API network or query error. Defaulting to free (fail-safe):", err);
      return "free";
    }
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
    if (shop) {
      const cleanShop = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
      return `https://${cleanShop}/admin/charges/pricing_plans`;
    }

    return "/app/billing";
  }
}

export const billingService: BillingService = new ShopifyAppPricingBillingService();
