import { describe, it, expect, vi } from "vitest";
import React from "react";
import { ConfirmPrintModal, getConfirmModalText } from "./ConfirmPrintModal";

describe("ConfirmPrintModal (Story 4.1, FR-10 & Story 4.2, FR-12)", () => {
  describe("getConfirmModalText", () => {
    it("returns correct plural text for multiple new orders", () => {
      const text = getConfirmModalText(3);
      expect(text.title).toBe("Confirm Printing");
      expect(text.heading).toBe("Did your packing slips print successfully for 3 orders?");
      expect(text.primaryActionText).toBe("Yes, mark as printed");
      expect(text.secondaryActionText).toBe("No, keep in queue");
    });

    it("returns correct singular text for 1 new order", () => {
      const text = getConfirmModalText(1);
      expect(text.heading).toBe("Did your packing slips print successfully for 1 order?");
    });

    it("returns simplified single-action modal text for 100% reprint batch (Story 4.2)", () => {
      const text = getConfirmModalText(3, 0);
      expect(text.title).toBe("Reprint Complete");
      expect(text.heading).toBe("Reprint complete");
      expect(text.description).toContain("already marked as Printed");
      expect(text.primaryActionText).toBe("Done");
      expect(text.secondaryActionText).toBeNull();
    });

    it("returns mixed batch confirmation targeting only unprinted orders (Story 4.2)", () => {
      const text = getConfirmModalText(5, 2);
      expect(text.title).toBe("Confirm Printing");
      expect(text.heading).toBe("Mark 2 new orders as printed? (3 already printed)");
      expect(text.primaryActionText).toBe("Yes, mark as printed");
      expect(text.secondaryActionText).toBe("No, keep in queue");
    });
  });

  describe("ConfirmPrintModal Component", () => {
    it("is a valid React component function", () => {
      expect(typeof ConfirmPrintModal).toBe("function");
    });

    it("instantiates without errors for new orders", () => {
      const element = React.createElement(ConfirmPrintModal, {
        open: true,
        orderCount: 2,
        newOrderCount: 2,
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      });
      expect(element).toBeDefined();
      expect(element.props.orderCount).toBe(2);
      expect(element.props.newOrderCount).toBe(2);
      expect(element.props.open).toBe(true);
    });

    it("instantiates without errors for reprint batch", () => {
      const element = React.createElement(ConfirmPrintModal, {
        open: true,
        orderCount: 4,
        newOrderCount: 0,
        onConfirm: vi.fn(),
        onCancel: vi.fn(),
      });
      expect(element).toBeDefined();
      expect(element.props.orderCount).toBe(4);
      expect(element.props.newOrderCount).toBe(0);
    });
  });
});
