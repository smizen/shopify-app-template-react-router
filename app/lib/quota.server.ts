import type { Usage, QuotaState, Order } from "../types/thermoslip";
import { FREE_TIER_LIMIT, DEFAULT_USAGE } from "../types/thermoslip";

export const APP_USAGE_NAMESPACE = "thermoslip";
export const APP_USAGE_KEY = "usage";
export const MAX_RETRY_COUNT = 3;

export const GET_APP_INSTALLATION_USAGE_QUERY = `#graphql
  query GetAppInstallationUsage {
    currentAppInstallation {
      id
      usage: metafield(namespace: "${APP_USAGE_NAMESPACE}", key: "${APP_USAGE_KEY}") {
        id
        value
        compareDigest
      }
    }
  }
`;

export const METAFIELDS_SET_USAGE_MUTATION = `#graphql
  mutation MetafieldsSetUsage($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
        compareDigest
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export interface CanPrintResult {
  allowed: boolean;
  newIds: string[];
  remaining: number | null;
  isUnlimited: boolean;
  reason?: string;
}

export interface AdminGraphqlClient {
  graphql: (query: string, options?: any) => Promise<Response>;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Memory Demo / Testing State
// ─────────────────────────────────────────────────────────────────────────────

let inMemoryUsage: Usage = {
  period: getCurrentPeriod(),
  consumed: 0,
  countedOrderIds: [],
};
let inMemoryDigest: string | null = null;
let conflictSimulationCount = 0;

export function resetDemoUsageForTesting() {
  inMemoryUsage = {
    period: getCurrentPeriod(),
    consumed: 0,
    countedOrderIds: [],
  };
  inMemoryDigest = null;
  conflictSimulationCount = 0;
}

export function setDemoUsageForTesting(usage: Partial<Usage>, digest: string | null = null) {
  inMemoryUsage = {
    period: usage.period ?? getCurrentPeriod(),
    consumed: usage.consumed ?? 0,
    countedOrderIds: usage.countedOrderIds ?? [],
  };
  inMemoryDigest = digest;
}

export function simulateConcurrencyConflictNextCall(count: number = 1) {
  conflictSimulationCount = count;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure Business Logic Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the current calendar period as "YYYY-MM" (UTC based).
 */
export function getCurrentPeriod(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

/**
 * Normalizes usage for the current billing period.
 * If the period in the stored usage doesn't match the current period,
 * usage is reset to zero for the new month.
 */
export function resetUsageIfNewPeriod(
  usage: Usage,
  currentPeriod: string = getCurrentPeriod(),
): Usage {
  if (!usage || usage.period !== currentPeriod) {
    return {
      period: currentPeriod,
      consumed: 0,
      countedOrderIds: [],
    };
  }
  return usage;
}

/**
 * Computes the client-safe QuotaState without returning Infinity (which serializes badly in JSON).
 */
export function getQuotaState(
  usage: Usage,
  isPro: boolean = false,
  currentPeriod?: string,
): QuotaState {
  if (isPro) {
    return { isUnlimited: true, remaining: null };
  }
  const normalized = resetUsageIfNewPeriod(usage, currentPeriod);
  return {
    isUnlimited: false,
    remaining: Math.max(0, FREE_TIER_LIMIT - normalized.consumed),
  };
}

/**
 * Evaluates whether printing the selected orders is permitted under quota rules.
 *
 * Rules:
 * 1. Pro plan: always allowed, unlimited.
 * 2. Reprints (printStatus === "printed"): excluded from count across all months (NFR-REPRINT-CROSSMONTH).
 * 3. Already counted this month (id in countedOrderIds): excluded from count.
 * 4. Remaining quota check: allowed = isPro || newIds.length <= remaining.
 * 5. All-or-nothing: if allowed is false, the entire batch is rejected (no partial print).
 */
export function canPrint(
  usage: Usage,
  orders: Array<{ id: string; printStatus?: string | null }>,
  isPro: boolean = false,
  currentPeriod?: string,
): CanPrintResult {
  if (isPro) {
    return {
      allowed: true,
      newIds: [],
      remaining: null,
      isUnlimited: true,
    };
  }

  const normalized = resetUsageIfNewPeriod(usage, currentPeriod);
  const remaining = Math.max(0, FREE_TIER_LIMIT - normalized.consumed);

  const newIds = orders
    .filter((order) => order.printStatus !== "printed")
    .map((order) => order.id)
    .filter((id) => !normalized.countedOrderIds.includes(id));

  const allowed = newIds.length <= remaining;
  const reason = !allowed
    ? remaining === 0
      ? "Monthly free quota reached. Upgrade to Pro for unlimited printing."
      : `${newIds.length} new prints required, only ${remaining} remaining.`
    : undefined;

  return {
    allowed,
    newIds,
    remaining,
    isUnlimited: false,
    reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AppInstallation Metafield Persistence & CAS
// ─────────────────────────────────────────────────────────────────────────────

export interface GetAppUsageResult {
  usage: Usage;
  compareDigest: string | null;
  appInstallationId: string | null;
}

/**
 * Fetches current usage and compareDigest from the AppInstallation metafield.
 */
export async function getAppUsage(
  admin: AdminGraphqlClient | null,
): Promise<GetAppUsageResult> {
  if (!admin) {
    return {
      usage: resetUsageIfNewPeriod(inMemoryUsage),
      compareDigest: inMemoryDigest,
      appInstallationId: "gid://shopify/AppInstallation/demo",
    };
  }

  try {
    const response = await admin.graphql(GET_APP_INSTALLATION_USAGE_QUERY);
    if (!response || typeof response.json !== "function") {
      return {
        usage: resetUsageIfNewPeriod(inMemoryUsage),
        compareDigest: inMemoryDigest,
        appInstallationId: null,
      };
    }

    const json: any = await response.json();
    const appInstallation = json.data?.currentAppInstallation;
    const appInstallationId = appInstallation?.id ?? null;
    const metafield = appInstallation?.usage;

    // compareDigest: The digest to compare with. Pass null if the metafield does not exist yet.
    const compareDigest: string | null = metafield ? (metafield.compareDigest ?? null) : null;

    if (!metafield?.value) {
      return {
        usage: {
          period: getCurrentPeriod(),
          consumed: 0,
          countedOrderIds: [],
        },
        compareDigest,
        appInstallationId,
      };
    }

    const parsed = JSON.parse(metafield.value);
    const rawUsage: Usage = {
      period: typeof parsed.period === "string" ? parsed.period : getCurrentPeriod(),
      consumed: typeof parsed.consumed === "number" ? parsed.consumed : 0,
      countedOrderIds: Array.isArray(parsed.countedOrderIds) ? parsed.countedOrderIds : [],
    };

    return {
      usage: resetUsageIfNewPeriod(rawUsage),
      compareDigest,
      appInstallationId,
    };
  } catch (err) {
    console.warn("[Quota] Error loading usage metafield, falling back to default:", err);
    return {
      usage: resetUsageIfNewPeriod(inMemoryUsage),
      compareDigest: inMemoryDigest,
      appInstallationId: null,
    };
  }
}

export interface ReservePrintQuotaResult {
  allowed: boolean;
  usage: Usage;
  reason?: string;
}

/**
 * Centralized service to check and reserve print quota before generating packing slips.
 *
 * Requirements:
 * 1. Used by BOTH `/app/print` (in-app batch print) and `/app/print-document` (Shopify Admin Print Action)
 *    to guarantee no bypass of the Free Tier quota.
 * 2. Implements optimistic locking via Shopify `compareDigest` on `metafieldsSet`.
 * 3. Retries up to MAX_RETRY_COUNT (3) times on concurrency conflicts.
 * 4. NFR-NONBLOCKING: Non-concurrency technical errors log warnings without blocking the print workflow.
 * 5. Architectural note on `countedOrderIds` (V1 vs Backlog V2):
 *    On Free tier, `countedOrderIds` has at most 50 IDs (~1.5 KB JSON), far below Shopify's 10 KB metafield limit.
 *    If Pro users or very high print volumes require order tracking beyond ~200 items in future versions,
 *    a DB table migration (SQLite/PostgreSQL) is tracked in the architectural backlog.
 */
export async function reservePrintQuota(
  admin: AdminGraphqlClient | null,
  orders: Array<{ id: string; printStatus?: string | null }>,
  isPro: boolean = false,
): Promise<ReservePrintQuotaResult> {
  // Pro tier: unlimited, never consumes free quota
  if (isPro) {
    return {
      allowed: true,
      usage: {
        period: getCurrentPeriod(),
        consumed: 0,
        countedOrderIds: [],
      },
    };
  }

  for (let attempt = 1; attempt <= MAX_RETRY_COUNT; attempt++) {
    const { usage, compareDigest, appInstallationId } = await getAppUsage(admin);

    const check = canPrint(usage, orders, isPro);
    if (!check.allowed) {
      // Entire batch blocked (no partial deduction)
      return {
        allowed: false,
        usage,
        reason: check.reason,
      };
    }

    // If nothing new to count (all reprints or already counted this month), allow immediately
    if (check.newIds.length === 0) {
      return {
        allowed: true,
        usage,
      };
    }

    const nextUsage: Usage = {
      period: usage.period,
      consumed: usage.consumed + check.newIds.length,
      countedOrderIds: [...usage.countedOrderIds, ...check.newIds],
    };

    // Handle demo / test environment without live admin GraphQL
    if (!admin || !appInstallationId) {
      if (conflictSimulationCount > 0) {
        conflictSimulationCount--;
        console.warn(`[Quota Test] Simulated conflict on attempt ${attempt}`);
        continue;
      }
      inMemoryUsage = nextUsage;
      inMemoryDigest = `digest-${Date.now()}`;
      return {
        allowed: true,
        usage: nextUsage,
      };
    }

    try {
      const response = await admin.graphql(METAFIELDS_SET_USAGE_MUTATION, {
        variables: {
          metafields: [
            {
              ownerId: appInstallationId,
              namespace: APP_USAGE_NAMESPACE,
              key: APP_USAGE_KEY,
              type: "json",
              value: JSON.stringify(nextUsage),
              // If metafield does not exist, compareDigest MUST be null for safe creation
              compareDigest: compareDigest ?? null,
            },
          ],
        },
      });

      const json: any = await response.json();
      const userErrors: Array<{ field?: string[]; message: string; code?: string }> =
        json.data?.metafieldsSet?.userErrors ?? [];

      const hasConflict = userErrors.some(
        (err) =>
          err.code === "COMPARE_DIGEST_MISMATCH" ||
          err.message?.toLowerCase().includes("digest") ||
          err.message?.toLowerCase().includes("conflict"),
      );

      if (hasConflict) {
        console.warn(
          `[Quota] compareDigest concurrency collision on attempt ${attempt}/${MAX_RETRY_COUNT}. Retrying...`,
          userErrors,
        );
        continue; // Retry loop with re-fetched digest
      }

      if (userErrors.length > 0) {
        console.error("[Quota] MetafieldsSet userErrors while saving usage:", userErrors);
        // NFR-NONBLOCKING: Never block print generation on unexpected non-conflict metafield errors
        return {
          allowed: true,
          usage: nextUsage,
        };
      }

      return {
        allowed: true,
        usage: nextUsage,
      };
    } catch (err) {
      console.error(`[Quota] Network/GraphQL error on attempt ${attempt}:`, err);
      if (attempt === MAX_RETRY_COUNT) {
        // NFR-NONBLOCKING fallback
        return {
          allowed: true,
          usage: nextUsage,
        };
      }
    }
  }

  // If retries exhausted due to persistent collisions, allow with non-blocking grace
  console.warn("[Quota] Retries exhausted due to high concurrency. Allowing print under NFR-NONBLOCKING.");
  return {
    allowed: true,
    usage: inMemoryUsage,
  };
}
