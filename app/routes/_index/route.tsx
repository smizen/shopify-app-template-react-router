import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const meta: MetaFunction = () => {
  return [
    { title: "ThermoSlip Order Print — Thermal Packing Slips for Shopify" },
    {
      name: "description",
      content:
        "High-speed 4×6 thermal packing slips and pick lists for Shopify merchants. Batch print up to 50 orders instantly with zero ink and zero PII storage.",
    },
  ];
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <img
            src="/app-icon.svg"
            alt="ThermoSlip Logo"
            className={styles.brandLogo}
          />
          <div className={styles.brandText}>
            <span className={styles.brandName}>ThermoSlip</span>
            <span className={styles.brandTag}>Order Print</span>
          </div>
        </div>
        <div className={styles.badge}>
          <span>●</span> Built for Shopify
        </div>
      </header>

      {/* Main Content */}
      <main className={styles.main}>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroPill}>
            <span>⚡</span> High-Speed Thermal Order Fulfillment
          </div>
          <h1 className={styles.heroTitle}>
            Lightning-Fast <span className={styles.heroTitleGradient}>4×6 Thermal</span> Packing Slips
          </h1>
          <p className={styles.heroSubtitle}>
            Cut packing and shipping time in half. Format and print crystal-clear packing slips and workshop pick lists natively on thermal label printers with zero ink wasted.
          </p>
        </section>

        {/* Connect Store Card */}
        <section className={styles.installCard}>
          <h2 className={styles.installCardTitle}>Connect Your Shopify Store</h2>
          <p className={styles.installCardDescription}>
            Enter your .myshopify.com domain to launch the app inside your Shopify Admin.
          </p>
          {showForm && (
            <Form className={styles.form} method="post" action="/auth/login">
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel} htmlFor="shop-domain">
                  Store domain
                </label>
                <div className={styles.inputWrapper}>
                  <input
                    id="shop-domain"
                    className={styles.input}
                    type="text"
                    name="shop"
                    placeholder="my-store-name.myshopify.com"
                    required
                    autoComplete="off"
                  />
                </div>
                <span className={styles.inputHelper}>
                  Example: dev-store-pbuw21v9.myshopify.com
                </span>
              </div>
              <button className={styles.button} type="submit">
                <span>Open in Shopify Admin</span>
                <span>→</span>
              </button>
            </Form>
          )}
        </section>

        {/* Features Highlights */}
        <section className={styles.featuresGrid}>
          <div className={styles.featureCard}>
            <div className={`${styles.featureIconWrap} ${styles.iconThermal}`}>
              🏷️
            </div>
            <h3 className={styles.featureTitle}>4×6 Thermal Precision</h3>
            <p className={styles.featureText}>
              Pre-calibrated for thermal printers (Munbyn, Rollo, Zebra, Brother). High contrast, crisp barcodes, and zero ink required.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.featureIconWrap} ${styles.iconSpeed}`}>
              🚀
            </div>
            <h3 className={styles.featureTitle}>50-Order Batch Printing</h3>
            <p className={styles.featureText}>
              Print multiple orders in a single click directly from your Shopify Admin Orders list with automatic multi-page splitting.
            </p>
          </div>

          <div className={styles.featureCard}>
            <div className={`${styles.featureIconWrap} ${styles.iconShield}`}>
              🛡️
            </div>
            <h3 className={styles.featureTitle}>Zero-PII Privacy Pledge</h3>
            <p className={styles.featureText}>
              GDPR & Shopify compliant. Customer details exist strictly in-memory during generation and are never stored on external databases.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>
          © 2026 Devcraft Solutions. All rights reserved.
        </p>
        <div className={styles.footerLinks}>
          <a href="/privacy" className={styles.footerLink}>
            Privacy Policy
          </a>
          <span>•</span>
          <a href="mailto:contact@devcraft-solutions.org" className={styles.footerLink}>
            contact@devcraft-solutions.org
          </a>
        </div>
      </footer>
    </div>
  );
}
