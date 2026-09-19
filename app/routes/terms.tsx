import type { MetaFunction } from "react-router";

export const meta: MetaFunction = () => {
  return [
    { title: "ThermoSlip Order Print — Terms of Service" },
    { name: "description", content: "Terms of Service and Conditions of Use for ThermoSlip Order Print Shopify App" },
  ];
};

export default function TermsOfService() {
  return (
    <div style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif", maxWidth: 800, margin: "40px auto", padding: "0 20px", color: "#202223", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px" }}>Terms of Service — ThermoSlip Order Print</h1>
      <p style={{ color: "#6d7175", marginBottom: "32px" }}>Last updated: September 19, 2026</p>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>1. Acceptance of Terms</h2>
        <p>
          By installing, accessing, or using <strong>ThermoSlip Order Print</strong> (&ldquo;ThermoSlip&rdquo;, &ldquo;the App&rdquo;), operated by Devcraft Solutions (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), you (&ldquo;Merchant&rdquo;, &ldquo;you&rdquo;) agree to be bound by these Terms of Service. If you do not agree to these terms, please uninstall and discontinue using the App immediately.
        </p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>2. Description of Service</h2>
        <p>
          ThermoSlip is a Shopify application designed to streamline workshop logistics and package fulfillment by generating compact 4x6 inch thermal packing slips and pick lists. The service reads necessary order details directly from your Shopify store via official Shopify APIs and formats them for immediate printing on standard thermal label printers.
        </p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>3. Merchant Responsibilities</h2>
        <p>You agree that:</p>
        <ul>
          <li>You maintain an active and valid Shopify store account in good standing.</li>
          <li>You comply with all applicable local, national, and international laws, including consumer data protection and privacy regulations.</li>
          <li>You do not attempt to reverse engineer, disrupt, or bypass the App&rsquo;s security, billing limits, or API quotas.</li>
        </ul>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>4. Plans, Billing &amp; Subscriptions</h2>
        <p>
          ThermoSlip offers both a <strong>Free</strong> tier and paid <strong>Pro</strong> subscription options:
        </p>
        <ul>
          <li><strong>Free Tier</strong>: Allows printing a limited number of packing slips per rolling monthly period at no cost.</li>
          <li><strong>Pro Tier</strong>: Provides unlimited printing and premium customization options for a recurring monthly fee.</li>
        </ul>
        <p>
          All subscription charges and transactions are processed directly through <strong>Shopify App Billing</strong> and will appear on your regular Shopify invoice. We do not collect or store any credit card or payment credential information.
        </p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>5. Cancellation &amp; Termination Policy</h2>
        <p>
          You may cancel your subscription at any time without penalty or notice period simply by uninstalling the App from your Shopify Admin (<strong>Settings &gt; Apps and sales channels &gt; Uninstall</strong>).
        </p>
        <p>
          Upon uninstallation, Shopify automatically terminates any active recurring app subscription, ensuring no further charges are billed to your account.
        </p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>6. Refund Policy</h2>
        <p>
          Because billing is managed directly through Shopify, subscription fees are generally non-refundable once billed. However, if you experienced technical difficulties or were billed unexpectedly, please contact us at <a href="mailto:contact@devcraft-solutions.org" style={{ color: "#008060" }}>contact@devcraft-solutions.org</a> within 30 days of the charge. We review refund requests in good faith and can issue app credits or refunds in accordance with Shopify Partner billing policies.
        </p>
      </section>

      <section style={{ marginBottom: "24px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>7. Disclaimer of Warranties &amp; Limitation of Liability</h2>
        <p>
          ThermoSlip is provided on an &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE&rdquo; basis. While we strive for maximum uptime and printing reliability, we do not warrant that the service will be completely uninterrupted or error-free. To the maximum extent permitted by applicable law, Devcraft Solutions shall not be liable for any indirect, incidental, special, or consequential damages resulting from the use or inability to use the service.
        </p>
      </section>

      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>8. Support &amp; Contact</h2>
        <p>
          For technical support, billing inquiries, or general questions regarding ThermoSlip, please contact our team at:
        </p>
        <p>
          <strong>Email</strong>: <a href="mailto:contact@devcraft-solutions.org" style={{ color: "#008060" }}>contact@devcraft-solutions.org</a><br />
          <strong>Developer</strong>: Devcraft Solutions
        </p>
      </section>

      <footer style={{ borderTop: "1px solid #e1e3e5", paddingTop: "16px", fontSize: "14px", color: "#6d7175", display: "flex", gap: "16px" }}>
        <span>&copy; {new Date().getFullYear()} Devcraft Solutions</span>
        <a href="/privacy" style={{ color: "#008060", textDecoration: "none" }}>Privacy Policy</a>
      </footer>
    </div>
  );
}
