import { describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppProvider } from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";
import { setMockPlanForTesting, resetMockPlanForTesting, billingService } from "../lib/plan.server";

describe("BillingService & Route Integration (Story 5.2, FR-15)", () => {
  beforeEach(() => {
    resetMockPlanForTesting();
  });

  it("identifies Free plan correctly and returns Free state", async () => {
    setMockPlanForTesting("free");
    const plan = await billingService.getPlan();
    const isPro = await billingService.isPro();

    expect(plan).toBe("free");
    expect(isPro).toBe(false);
  });

  it("identifies Pro plan correctly and returns Pro state", async () => {
    setMockPlanForTesting("pro");
    const plan = await billingService.getPlan();
    const isPro = await billingService.isPro();

    expect(plan).toBe("pro");
    expect(isPro).toBe(true);
  });
});
