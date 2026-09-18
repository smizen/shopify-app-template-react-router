import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { QuotaBanner } from "./QuotaBanner";

describe("QuotaBanner Component (Story 5.1, FR-14)", () => {
  it("renders nothing if quota is unlimited (Pro plan)", () => {
    const html = renderToStaticMarkup(
      <QuotaBanner quotaState={{ isUnlimited: true, remaining: null }} />,
    );
    expect(html).toBe("");
  });

  it("renders remaining prints banner when quota is available", () => {
    const html = renderToStaticMarkup(
      <AppProvider i18n={enTranslations}>
        <QuotaBanner quotaState={{ isUnlimited: false, remaining: 50 }} />
      </AppProvider>,
    );
    expect(html).toContain("50 prints");
    expect(html).toContain("remaining this month");
  });

  it("handles singular print correctly", () => {
    const html = renderToStaticMarkup(
      <AppProvider i18n={enTranslations}>
        <QuotaBanner quotaState={{ isUnlimited: false, remaining: 1 }} />
      </AppProvider>,
    );
    expect(html).toContain("1 print");
    expect(html).toContain("remaining this month");
  });

  it("renders warning and upgrade action when remaining is 0", () => {
    const html = renderToStaticMarkup(
      <AppProvider i18n={enTranslations}>
        <QuotaBanner quotaState={{ isUnlimited: false, remaining: 0 }} />
      </AppProvider>,
    );
    expect(html).toContain("Monthly free quota reached. Upgrade to Pro for unlimited printing.");
    expect(html).toContain("Upgrade to Pro");
  });
});
