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
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      // ThermoSlip stores no customer PII on persistent external servers.
      // 200 OK confirms request was processed without action required.
      return new Response(null, { status: 200 });

    case "APP_UNINSTALLED":
      if (session) {
        await sessionStorage.deleteSession(session.id);
      }
      return new Response(null, { status: 200 });

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
