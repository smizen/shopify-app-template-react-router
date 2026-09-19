import type { ActionFunctionArgs } from "react-router";
import { authenticate, sessionStorage } from "../shopify.server";

/**
 * Story 1.4 — Mandatory GDPR Compliance Webhooks (FR-16) + App lifecycle
 * - CUSTOMERS_DATA_REQUEST
 * - CUSTOMERS_REDACT
 * - SHOP_REDACT
 * - APP_UNINSTALLED
 * - APP_SCOPES_UPDATE
 *
 * All GDPR webhooks respond HTTP 200 immediately because ThermoSlip stores no PII
 * on external servers (Protected Customer Data architecture §4.3).
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  console.log(`[Webhook] Received topic ${topic} for shop ${shop}`);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // ThermoSlip does NOT store or persist customer or order PII on any server or database.
      // Order details exist strictly in-memory during browser print sessions.
      // Responding HTTP 200 confirms the request was received and acknowledged.
      return new Response(null, { status: 200 });

    case "CUSTOMERS_REDACT":
      // ThermoSlip does NOT persist customer data. There is no customer-specific record to delete.
      // Responding HTTP 200 confirms compliance.
      return new Response(null, { status: 200 });

    case "SHOP_REDACT": {
      // Purge all SQLite sessions associated with this shop (e.g. offline and online tokens).
      // Note: AppInstallation metafields (settings, usage) are Shopify-owned and automatically
      // deleted by Shopify when the app is uninstalled.
      if (shop) {
        const sessions = await sessionStorage.findSessionsByShop(shop);
        if (sessions.length > 0) {
          await sessionStorage.deleteSessions(sessions.map((s: { id: string }) => s.id));
        }
      } else if (session) {
        await sessionStorage.deleteSession(session.id);
      }
      return new Response(null, { status: 200 });
    }

    case "APP_UNINSTALLED": {
      // Purge all SQLite sessions associated with the uninstalled shop
      if (shop) {
        const sessions = await sessionStorage.findSessionsByShop(shop);
        if (sessions.length > 0) {
          await sessionStorage.deleteSessions(sessions.map((s: { id: string }) => s.id));
        }
      } else if (session) {
        await sessionStorage.deleteSession(session.id);
      }
      return new Response(null, { status: 200 });
    }

    case "APP_SCOPES_UPDATE": {
      const current = payload?.current as string[] | undefined;
      if (session && current) {
        session.scope = current.toString();
        await sessionStorage.storeSession(session);
      }
      return new Response(null, { status: 200 });
    }

    default:
      return new Response(null, { status: 200 });
  }
};
