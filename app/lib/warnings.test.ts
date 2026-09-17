import { describe, it, expect } from "vitest";
import { computePackingWarnings, EXPRESS_KEYWORDS } from "./warnings";
import type { PackingWarningInput } from "./warnings";

describe("computePackingWarnings", () => {
  describe("MULTI_QTY warning", () => {
    it("does not trigger when lineItems is empty", () => {
      const input: PackingWarningInput = {
        lineItems: [],
      };
      const warnings = computePackingWarnings(input);
      expect(warnings.find((w) => w.code === "MULTI_QTY")).toBeUndefined();
    });

    it("does not trigger when all items have quantity = 1", () => {
      const input: PackingWarningInput = {
        lineItems: [
          { unfulfilledQuantity: 1, quantityToPack: 1 },
          { unfulfilledQuantity: 1, quantityToPack: 1 },
        ],
      };
      const warnings = computePackingWarnings(input);
      expect(warnings.find((w) => w.code === "MULTI_QTY")).toBeUndefined();
    });

    it("does not trigger when quantities are 0 or null", () => {
      const input: PackingWarningInput = {
        lineItems: [
          { unfulfilledQuantity: 0, quantityToPack: 0 },
          { unfulfilledQuantity: null, quantityToPack: null },
        ],
      };
      const warnings = computePackingWarnings(input);
      expect(warnings.find((w) => w.code === "MULTI_QTY")).toBeUndefined();
    });

    it("triggers when unfulfilledQuantity > 1 and quantityToPack is not provided", () => {
      const input: PackingWarningInput = {
        lineItems: [
          { unfulfilledQuantity: 1 },
          { unfulfilledQuantity: 3 },
        ],
      };
      const warnings = computePackingWarnings(input);
      expect(warnings).toEqual([{ code: "MULTI_QTY" }]);
    });

    it("triggers when quantityToPack > 1 even if unfulfilledQuantity is null or fallback", () => {
      const input: PackingWarningInput = {
        lineItems: [
          { unfulfilledQuantity: null, quantityToPack: 2 },
        ],
      };
      const warnings = computePackingWarnings(input);
      expect(warnings).toEqual([{ code: "MULTI_QTY" }]);
    });

    it("uses quantityToPack as priority over unfulfilledQuantity", () => {
      const input: PackingWarningInput = {
        lineItems: [
          // If unfulfilled was 3, but quantityToPack is adjusted to 1 (e.g. refundable/non-physical bounds)
          { unfulfilledQuantity: 3, quantityToPack: 1 },
        ],
      };
      // As defined in spec: quantityToPack = item.quantityToPack ?? item.unfulfilledQuantity ?? 0
      // quantityToPack is 1 -> <= 1, so should NOT trigger
      const warnings = computePackingWarnings(input);
      expect(warnings.find((w) => w.code === "MULTI_QTY")).toBeUndefined();
    });

    it("does not trigger when quantityToPack = 0 even if unfulfilledQuantity = 5", () => {
      // 0 is defined and must have priority over unfulfilledQuantity fallback
      const input: PackingWarningInput = {
        lineItems: [
          { quantityToPack: 0, unfulfilledQuantity: 5 },
        ],
      };
      const warnings = computePackingWarnings(input);
      expect(warnings.find((w) => w.code === "MULTI_QTY")).toBeUndefined();
    });
  });

  describe("CUSTOMER_NOTE warning", () => {
    it("does not trigger when note is null or undefined", () => {
      expect(computePackingWarnings({ lineItems: [], note: null })).toEqual([]);
      expect(computePackingWarnings({ lineItems: [], note: undefined })).toEqual([]);
    });

    it("does not trigger when note is empty or whitespace only", () => {
      expect(computePackingWarnings({ lineItems: [], note: "" })).toEqual([]);
      expect(computePackingWarnings({ lineItems: [], note: "   " })).toEqual([]);
      expect(computePackingWarnings({ lineItems: [], note: "\t\n  " })).toEqual([]);
    });

    it("triggers when note contains actual characters", () => {
      const warnings = computePackingWarnings({
        lineItems: [],
        note: "Please leave package at the side door.",
      });
      expect(warnings).toEqual([{ code: "CUSTOMER_NOTE" }]);
    });
  });

  describe("EXPRESS warning", () => {
    it("does not trigger when shippingMethod is null, undefined, or empty", () => {
      expect(computePackingWarnings({ lineItems: [], shippingMethod: null })).toEqual([]);
      expect(computePackingWarnings({ lineItems: [], shippingMethod: undefined })).toEqual([]);
      expect(computePackingWarnings({ lineItems: [], shippingMethod: "" })).toEqual([]);
      expect(computePackingWarnings({ lineItems: [], shippingMethod: "   " })).toEqual([]);
    });

    it("does not trigger for regular shipping methods", () => {
      expect(computePackingWarnings({ lineItems: [], shippingMethod: "Standard Shipping" })).toEqual([]);
      expect(computePackingWarnings({ lineItems: [], shippingMethod: "Colissimo Domicile" })).toEqual([]);
      expect(computePackingWarnings({ lineItems: [], shippingMethod: "Mondial Relay" })).toEqual([]);
    });

    it("handles uppercase 'EXPRESS'", () => {
      const warnings = computePackingWarnings({
        lineItems: [],
        shippingMethod: "EXPRESS",
      });
      expect(warnings).toEqual([{ code: "EXPRESS" }]);
    });

    it("handles trimmed shipping with leading/trailing spaces e.g. '  DHL Express  '", () => {
      const warnings = computePackingWarnings({
        lineItems: [],
        shippingMethod: "  DHL Express  ",
      });
      expect(warnings).toEqual([{ code: "EXPRESS" }]);
    });

    it("triggers for shippingMethod = 'Priority'", () => {
      const warnings = computePackingWarnings({
        lineItems: [],
        shippingMethod: "Priority",
      });
      expect(warnings).toEqual([{ code: "EXPRESS" }]);
    });

    it("triggers for shippingMethod = 'Non-priority' via heuristic substring match", () => {
      // Documented operational heuristic: includes('priority') matches
      const warnings = computePackingWarnings({
        lineItems: [],
        shippingMethod: "Non-priority",
      });
      expect(warnings).toEqual([{ code: "EXPRESS" }]);
    });

    it("triggers for shippingMethod = '24 hours'", () => {
      const warnings = computePackingWarnings({
        lineItems: [],
        shippingMethod: "24 hours",
      });
      expect(warnings).toEqual([{ code: "EXPRESS" }]);
    });

    it.each([
      ["express", "FedEx Express"],
      ["chrono", "Chronopost 13 Relais"],
      ["next day", "UPS Next Day Air"],
      ["priority", "USPS Priority Mail 2-Day"],
      ["24h", "Livraison Express 24h"],
      ["24 hours", "Delivered in 24 hours"],
      ["urgent", "Urgent Courier Service"],
    ])("triggers for keyword '%s' in '%s'", (_kw, methodName) => {
      const warnings = computePackingWarnings({
        lineItems: [],
        shippingMethod: methodName,
      });
      expect(warnings).toEqual([{ code: "EXPRESS" }]);
    });
  });

  describe("Combinations and full orders", () => {
    it("returns empty array when order has no warnings", () => {
      const warnings = computePackingWarnings({
        lineItems: [{ quantityToPack: 1 }],
        note: null,
        shippingMethod: "Standard",
      });
      expect(warnings).toEqual([]);
    });

    it("triggers all three warnings simultaneously in deterministic order", () => {
      const warnings = computePackingWarnings({
        lineItems: [
          { quantityToPack: 1 },
          { quantityToPack: 3 },
        ],
        note: "Fragile - handle with care",
        shippingMethod: "DHL Express Delivery",
      });

      expect(warnings).toEqual([
        { code: "MULTI_QTY" },
        { code: "CUSTOMER_NOTE" },
        { code: "EXPRESS" },
      ]);
    });
  });

  describe("EXPRESS_KEYWORDS constant", () => {
    it("exports the required readonly keywords array", () => {
      expect(EXPRESS_KEYWORDS).toEqual([
        "express",
        "chrono",
        "next day",
        "priority",
        "24h",
        "24 hours",
        "urgent",
      ]);
    });
  });
});
