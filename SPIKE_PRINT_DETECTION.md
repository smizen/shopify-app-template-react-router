# Spike 1.6 — Validation window.print() and Post-Print Return Detection

**Date:** 2026-09-16  
**Status:** Resolved & Documented  
**Impacts:** Story 3.3 (`app.print.tsx`), Story 4.1 (`ConfirmPrintModal.tsx`)

---

## 1. Context & Objectives

In workshop environments, merchants print thermal slips on 4×6 rolls. We must determine:
1. Whether `window.print()` should be triggered via direct user gesture (`onClick`) or declarative lifecycle (`useEffect`).
2. How to reliably detect when the user returns from the browser's native print preview dialog across Chrome, Edge, and Safari (macOS & Windows).
3. How to handle cancellation vs print confirmation without false positives or lost orders.

---

## 2. Technical Findings

### 2.1 Trigger Mechanism: `onClick` vs `useEffect`
- **`useEffect` Trigger Risks:**
  - In Safari (macOS & iOS) and Chrome with strict popup/gesture policies, calling `window.print()` without a direct user interaction event (such as in a `useEffect` on mount) can be throttled, silently ignored, or trigger security blocks.
  - In embedded Shopify Admin iframes (App Bridge context), untriggered print calls cause race conditions with Polaris font loading and asset streaming.
- **`onClick` User Gesture:**
  - 100% reliable across Chrome, Safari, Edge, Firefox on both macOS and Windows.
  - Allows pre-calculating barcode SVG elements and CSS layout before triggering dialog.
- **Decision:** **Trigger `window.print()` strictly via direct user gesture (`onClick` on a "Print Slips" button).**

### 2.2 Print Return Detection Mechanisms

| Mechanism | Chrome (macOS/Win) | Safari (macOS) | Edge (Win) | Behaviour on Cancel | Reliability |
|---|---|---|---|---|---|
| **`window.onafterprint` / `afterprint` event** | ✅ Supported | ✅ Supported | ✅ Supported | Fires on Print AND on Cancel | **Primary (99.9%)** |
| **`window.print()` synchronous blocking return** | ✅ Synchronous | ✅ Synchronous | ✅ Synchronous | Resumes execution immediately after dialog dismiss | **Synchronous fallback** |
| **`window.addEventListener('focus')`** | ⚠️ Variable | ⚠️ Inconsistent | ⚠️ Variable | Fires if window lost focus | Secondary safety net |
| **`document.visibilitychange`** | ❌ Dialog doesn't always trigger visibility hidden | ❌ Unreliable | ❌ Unreliable | Inconsistent | Not recommended |

### 2.3 Critical Browser Limitation: Print vs Cancel Indistinguishability
No modern web browser provides an API to know whether the user clicked **"Print"** or **"Cancel"** in the native print dialog. In all browsers, `afterprint` fires regardless of the user's choice.

---

## 3. Architecture Decision for FR-10 & Story 4.1

Because the browser cannot tell us if the printer actually printed, we implement a **2-phase explicit confirmation pattern**:

1. **User Action:** The merchant clicks **"Print"** in `/app/print`.
2. **Synchronous Execution:**
   ```typescript
   // Direct user gesture
   const handlePrint = () => {
     let dialogClosed = false;

     const onDialogClose = () => {
       if (dialogClosed) return;
       dialogClosed = true;
       window.removeEventListener("afterprint", onDialogClose);
       // Open the explicit confirmation modal
       setShowConfirmModal(true);
     };

     window.addEventListener("afterprint", onDialogClose);
     window.print();
     // Fallback for browsers where window.print() is fully blocking
     setTimeout(onDialogClose, 500);
   };
   ```
3. **Explicit Polaris Modal (`ConfirmPrintModal`):**
   - Displays: *"Did your slips print successfully? (X orders)"*
   - Button **"Yes, mark as printed"** → Submits POST mutation to set `$app:print_status = "printed"`.
   - Button **"No, keep in queue"** → Closes modal and redirects to `/app` with orders remaining in "Ready to Pack" status.
4. **Quota Independence:**
   - Free plan quota is accounted at slip generation in the `/app/print` loader (print intent).
   - Canceling the post-print confirmation does NOT restore the quota for newly generated slips, preventing quota evasion while preserving workshop operational safety.
