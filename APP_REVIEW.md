# Shopify App Review — ThermoSlip ‑ Order Printer

**App Name:** ThermoSlip ‑ Order Printer  
**Technical Identifier / Slug:** `thermoslip-order-printer`  
**API Version:** `2026-07`  
**Architecture:** Zero-PII / In-Memory Client-Rendered Thermal Packing Slips  

---

## 1. Protected Customer Data (PCD) Justification

### Data Requested & Read
| Field | Purpose | Retention |
|---|---|---|
| `order.customer.name` | Printed on packing slip header for shipment recipient identification | In-memory during request only (0ms post-render retention) |
| `order.shippingAddress` | Printed on packing slip for warehouse destination verification | In-memory during request only |
| `order.lineItems` (title, SKU, quantity, variant) | Workshop picking list formatting & quantity badges | In-memory during request only |
| `order.note` | Printed as packing instructions / merchant note on packing slip | In-memory during request only |

### Architecture Guarantee: Zero PII Stored
- **No external database for customer data:** The application runs completely stateless regarding customer PII.
- **Session database:** Fly.io SQLite volume stores only Shopify OAuth access tokens and shop domain.
- **App configuration:** Stored inside Shopify on `AppInstallation` app-data metafields (`thermoslip/settings` and `thermoslip/usage`).
- **Operational print status:** Stored inside Shopify as app-owned Order metafield (`$app:print_status`).
- **Logging Policy:** Server loaders and webhook handlers strictly redact or omit any customer names, emails, addresses, or phone numbers.

---

## 2. Access Scopes Justification

### `write_orders`
- **Why write_orders is required:**
  ThermoSlip tracks the operational packing status of orders (`Printed` vs `Ready to Pack`). Shopify Admin API requires `write_orders` scope to execute the `metafieldsSet` mutation on an app-owned Order metafield (`$app:print_status`).
- **Minimal footprint pledge:**
  ThermoSlip **never** modifies core order fields (no changes to prices, line items, shipping addresses, fulfillment statuses, or customer accounts). Writing is strictly limited to the app-owned Order metafield namespace `$app`.
- **Read scope:**
  Under Shopify scope rules, `write_orders` implicitly grants `read_orders`, which is utilized to query the packing queue.

---

## 3. GDPR & Privacy Compliance Webhooks

Implemented in `/webhooks` and verified with HMAC authentication via `@shopify/shopify-app-react-router`:
1. `CUSTOMERS_DATA_REQUEST` → HTTP 200 (Zero PII stored)
2. `CUSTOMERS_REDACT` → HTTP 200 (Zero PII stored)
3. `SHOP_REDACT` → HTTP 200 (Deletes shop session from SQLite)

---

## 4. Merchant Experience & App Bridge v4

- Embedded inside Shopify Admin using `@shopify/app-bridge-react` v4 and Polaris v13 design tokens.
- Native admin action extension: `admin.order-index.selection-print-action.render` for batch printing from the Orders list.
- All merchant-facing copy is 100% in English (`NFR-LANG-01`).
- Public Privacy Policy URL: `https://thermoslip-order-printer.fly.dev/privacy`
- Developer / Support Contact: `contact@devcraft-solutions.org` (Devcraft Solutions)
