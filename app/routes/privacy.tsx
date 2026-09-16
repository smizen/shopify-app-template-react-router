import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "ThermoSlip ‑ Order Printer — Privacy Policy" },
    { name: "description", content: "Privacy Policy for ThermoSlip ‑ Order Printer Shopify App" },
  ];
};

export default function PrivacyPolicy() {
  return (
    <div style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif", maxWidth: 800, margin: "40px auto", padding: "0 20px", color: "#202223", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>Privacy Policy — ThermoSlip ‑ Order Printer</h1>
      <p style={{ color: "#6d7175", marginBottom: "32px" }}>Last updated: September 16, 2026</p>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>1. Introduction & Overview</h2>
        <p>
          ThermoSlip ‑ Order Printer (&ldquo;ThermoSlip&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;) is an application built for Shopify merchants to format and print workshop packing slips directly to thermal printers (4x6 format). We are committed to protecting merchant and customer privacy through a <strong>Zero-PII Storage</strong> architecture.
        </p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>2. Data We Process (Protected Customer Data)</h2>
        <p>To render packing slips, ThermoSlip temporarily reads the following order data via Shopify GraphQL Admin API:</p>
        <ul>
          <li><strong>Customer name</strong> &amp; <strong>shipping address</strong> (recipient address printed on packing slip)</li>
          <li><strong>Order line items</strong> (product titles, SKU, quantities, variant names)</li>
          <li><strong>Order notes and attributes</strong> (packing instructions)</li>
          <li><strong>Order tracking &amp; fulfillment status</strong></li>
        </ul>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>3. Data Retention &amp; Storage (Zero-PII Guarantee)</h2>
        <p>
          <strong>ThermoSlip does NOT store, persist, or database any personal identifiable information (PII).</strong>
        </p>
        <p>
          Customer and order details exist strictly in-memory during the browser session and are rendered directly to the client screen / print document. No order or customer details are stored on our servers or external databases. Operational print statuses are stored directly inside Shopify as app-owned Order metafields.
        </p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>4. GDPR &amp; Privacy Law Compliance</h2>
        <p>
          ThermoSlip supports and complies with all mandatory Shopify GDPR webhooks:
        </p>
        <ul>
          <li><strong>customers/data_request</strong>: Responds immediately confirming zero PII is stored.</li>
          <li><strong>customers/redact</strong>: Responds immediately confirming zero PII is retained.</li>
          <li><strong>shop/redact</strong>: Cleans up merchant installation data.</li>
        </ul>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>5. Contact Information</h2>
        <p>
          For privacy inquiries or technical questions regarding ThermoSlip, please contact our privacy officer at: <a href="mailto:privacy@thermoslip.app">privacy@thermoslip.app</a>.
        </p>
      </section>
    </div>
  );
}
