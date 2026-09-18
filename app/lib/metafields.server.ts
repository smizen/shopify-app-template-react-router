import { DEMO_ORDERS } from "./demo-orders";
import type { Settings } from "../types/thermoslip";
import { DEFAULT_SETTINGS } from "../types/thermoslip";

export const METAFIELD_APP_NAMESPACE = "$app";
export const PRINT_STATUS_KEY = "print_status";
export const PRINTED_VALUE = "printed";
export const METAFIELD_TYPE_SINGLE_LINE = "single_line_text_field";
export const METAFIELDS_SET_BATCH_SIZE = 25;

export const APP_SETTINGS_NAMESPACE = "thermoslip";
export const APP_SETTINGS_KEY = "settings";

export const METAFIELDS_SET_MUTATION = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

export interface MetafieldUserError {
  field?: string[];
  message: string;
  code?: string;
}

export interface SetOrdersPrintedResult {
  success: boolean;
  updatedCount: number;
  userErrors: MetafieldUserError[];
}

/**
 * Sets the operational print status ($app:print_status = "printed")
 * on the provided Shopify orders using GraphQL metafieldsSet.
 *
 * Requirements:
 * - Batches mutations in chunks of 25 (Shopify limit).
 * - Idempotent: safe to run multiple times.
 * - Handles Demo Mode IDs by updating in-memory fixtures.
 * - Collects and returns userErrors without throwing, keeping the flow resilient.
 */
export async function setOrdersPrintedStatus(
  admin: { graphql: (query: string, options?: any) => Promise<Response> } | null,
  orderIds: string[],
): Promise<SetOrdersPrintedResult> {
  if (!orderIds || orderIds.length === 0) {
    return { success: true, updatedCount: 0, userErrors: [] };
  }

  const uniqueIds = [...new Set(orderIds)];

  // 1. Handle Demo Orders
  const demoIds = uniqueIds.filter((id) => id.includes("demo-"));
  if (demoIds.length > 0) {
    let demoUpdated = 0;
    for (const demoId of demoIds) {
      const order = DEMO_ORDERS.find((o) => o.id === demoId);
      if (order) {
        order.printStatus = "printed";
        demoUpdated++;
      }
    }
    // If only demo IDs, return immediately
    if (demoIds.length === uniqueIds.length) {
      return { success: true, updatedCount: demoUpdated, userErrors: [] };
    }
  }

  // 2. Real Shopify Orders
  const realIds = uniqueIds.filter((id) => !id.includes("demo-"));
  if (realIds.length === 0 || !admin) {
    return { success: true, updatedCount: demoIds.length, userErrors: [] };
  }

  const allUserErrors: MetafieldUserError[] = [];
  let successfullyUpdatedCount = demoIds.length;

  // Split into batches of 25
  for (let i = 0; i < realIds.length; i += METAFIELDS_SET_BATCH_SIZE) {
    const batchIds = realIds.slice(i, i + METAFIELDS_SET_BATCH_SIZE);

    const metafields = batchIds.map((orderId) => ({
      ownerId: orderId,
      namespace: METAFIELD_APP_NAMESPACE,
      key: PRINT_STATUS_KEY,
      type: METAFIELD_TYPE_SINGLE_LINE,
      value: PRINTED_VALUE,
    }));

    try {
      const response = await admin.graphql(METAFIELDS_SET_MUTATION, {
        variables: { metafields },
      });

      const json: any = await response.json();
      const userErrors: MetafieldUserError[] =
        json.data?.metafieldsSet?.userErrors ?? [];

      if (userErrors.length > 0) {
        console.warn(
          `[Metafields] User errors setting print status on batch ${i}:`,
          userErrors,
        );
        allUserErrors.push(...userErrors);
      }

      const createdMetafields = json.data?.metafieldsSet?.metafields ?? [];
      successfullyUpdatedCount += createdMetafields.length;
    } catch (err) {
      console.error(
        `[Metafields] Network/GraphQL error setting print status on batch ${i}:`,
        err,
      );
      allUserErrors.push({
        message: err instanceof Error ? err.message : "Failed to execute metafieldsSet",
      });
    }
  }

  return {
    success: allUserErrors.length === 0,
    updatedCount: successfullyUpdatedCount,
    userErrors: allUserErrors,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// AppInstallation App-Data Metafield (thermoslip/settings) — Story 4.3 (FR-13)
// ─────────────────────────────────────────────────────────────────────────────

export const GET_APP_INSTALLATION_SETTINGS_QUERY = `#graphql
  query GetAppInstallationSettings {
    currentAppInstallation {
      id
      settings: metafield(namespace: "${APP_SETTINGS_NAMESPACE}", key: "${APP_SETTINGS_KEY}") {
        id
        value
      }
    }
  }
`;

let inMemoryDemoSettings: Settings = { ...DEFAULT_SETTINGS };

export function resetDemoSettingsForTesting() {
  inMemoryDemoSettings = { ...DEFAULT_SETTINGS };
}

/**
 * Loads shop settings from the AppInstallation App-data metafield.
 * Merges loaded settings with DEFAULT_SETTINGS for resilience.
 */
export async function getAppSettings(
  admin: { graphql: (query: string, options?: any) => Promise<Response> } | null,
): Promise<Settings> {
  if (!admin) {
    return { ...inMemoryDemoSettings };
  }

  try {
    const response = await admin.graphql(GET_APP_INSTALLATION_SETTINGS_QUERY);
    if (!response || typeof response.json !== "function") {
      return { ...inMemoryDemoSettings };
    }
    const json: any = await response.json();
    const rawValue = json.data?.currentAppInstallation?.settings?.value;

    if (!rawValue) {
      return { ...DEFAULT_SETTINGS };
    }

    const parsed = JSON.parse(rawValue);
    return {
      showLogo: parsed.showLogo ?? parsed.showBranding ?? DEFAULT_SETTINGS.showLogo,
      showBranding: parsed.showBranding ?? parsed.showLogo ?? DEFAULT_SETTINGS.showLogo,
      showAddress: parsed.showAddress ?? DEFAULT_SETTINGS.showAddress,
      showSku: parsed.showSku ?? DEFAULT_SETTINGS.showSku,
      showNotes: parsed.showNotes ?? DEFAULT_SETTINGS.showNotes,
      footer: typeof parsed.footer === "string" ? parsed.footer : DEFAULT_SETTINGS.footer,
    };
  } catch (err) {
    console.warn("[Metafields] Error fetching app settings, falling back to demo/default:", err);
    return { ...inMemoryDemoSettings };
  }
}

export interface SaveAppSettingsResult {
  success: boolean;
  fieldErrors?: Record<string, string>;
  userErrors?: MetafieldUserError[];
}

/**
 * Persists shop settings to the AppInstallation App-data metafield (`thermoslip/settings`).
 *
 * Rules:
 * - Server validates footer length: returns explicit error if > 120 chars (no silent truncate).
 * - Saves JSON value via metafieldsSet targeting currentAppInstallation.id.
 */
export async function saveAppSettings(
  admin: { graphql: (query: string, options?: any) => Promise<Response> } | null,
  settings: Partial<Settings>,
): Promise<SaveAppSettingsResult> {
  // Explicit validation on footer length (NFR UX rule)
  if (settings.footer && settings.footer.length > 120) {
    return {
      success: false,
      fieldErrors: {
        footer: "Footer must be 120 characters or less.",
      },
    };
  }

  const sanitized: Settings = {
    showLogo: settings.showLogo ?? settings.showBranding ?? DEFAULT_SETTINGS.showLogo,
    showBranding: settings.showBranding ?? settings.showLogo ?? DEFAULT_SETTINGS.showLogo,
    showAddress: settings.showAddress ?? DEFAULT_SETTINGS.showAddress,
    showSku: settings.showSku ?? DEFAULT_SETTINGS.showSku,
    showNotes: settings.showNotes ?? DEFAULT_SETTINGS.showNotes,
    footer: settings.footer ? settings.footer.trim() : "",
  };

  // Keep in-memory copy up to date (for demo mode / preview resilience)
  inMemoryDemoSettings = { ...sanitized };

  if (!admin) {
    return { success: true };
  }

  try {
    // 1. Get currentAppInstallation.id
    const getRes = await admin.graphql(GET_APP_INSTALLATION_SETTINGS_QUERY);
    const getJson: any = await getRes.json();
    const appInstallationId = getJson.data?.currentAppInstallation?.id;

    if (!appInstallationId) {
      return { success: true };
    }

    // 2. Set App-data metafield on AppInstallation
    const setRes = await admin.graphql(METAFIELDS_SET_MUTATION, {
      variables: {
        metafields: [
          {
            ownerId: appInstallationId,
            namespace: APP_SETTINGS_NAMESPACE,
            key: APP_SETTINGS_KEY,
            type: "json",
            value: JSON.stringify({
              showLogo: sanitized.showLogo,
              showAddress: sanitized.showAddress,
              showSku: sanitized.showSku,
              showNotes: sanitized.showNotes,
              footer: sanitized.footer,
            }),
          },
        ],
      },
    });

    const setJson: any = await setRes.json();
    const userErrors: MetafieldUserError[] = setJson.data?.metafieldsSet?.userErrors ?? [];

    if (userErrors.length > 0) {
      console.warn("[Metafields] User errors saving app settings:", userErrors);
      return { success: false, userErrors };
    }

    return { success: true };
  } catch (err) {
    console.error("[Metafields] Error persisting app settings:", err);
    return {
      success: false,
      userErrors: [
        { message: err instanceof Error ? err.message : "Failed to save settings" },
      ],
    };
  }
}

