import type { Order, Settings } from "../../types/thermoslip";
import { WarningBanner } from "./WarningBanner";
import { Barcode } from "./Barcode";

interface PackingSlipPageProps {
  order: Order;
  settings: Settings;
  shopName: string;
}

/**
 * Renders a single 4×6 thermal packing slip for one order.
 *
 * Uses plain CSS classes (not Polaris) for predictable thermal print output.
 * The outer .packing-slip div maps 1:1 to one physical 4×6 label.
 *
 * Settings applied:
 *   - showLogo / showAddress / showSku / showNotes / footer
 *
 * Story 3.1: defaults applied (all visible). Persistence via metafield → Story 4.3.
 * Story 3.2: Code 128 SVG barcode rendered in .slip-header.
 * Story 3.3: multi-page chunking wraps multiple <PackingSlipPage> instances.
 */
export function PackingSlipPage({ order, settings, shopName }: PackingSlipPageProps) {
  const formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const recipientName =
    order.shippingAddress?.name?.trim() || order.customerName?.trim();

  return (
    <div className="packing-slip print-preview-slip">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="slip-header">
        <div className="slip-header-left">
          <div className="slip-shop-name">
            {settings.showLogo && shopName ? shopName : "ThermoSlip"}
          </div>
          <div className="slip-order-date">{formattedDate}</div>
        </div>
        <div className="slip-order-meta">
          <div className="slip-order-name">{order.name}</div>
          <Barcode
            value={order.name}
            width={1.6}
            height={36}
            displayValue={true}
            fontSize={9}
          />
        </div>
      </div>

      {/* ── Carrier / Shipping Bar (Top Third) ─────────────────────────── */}
      {order.shippingMethod && (
        <div className="slip-carrier-bar">
          <span className="slip-carrier-label">SHIP VIA:</span>
          <span className="slip-carrier-name">{order.shippingMethod}</span>
        </div>
      )}

      {/* ── Packing Warnings ───────────────────────────────────────────── */}
      <WarningBanner warnings={order.warnings} />

      {/* ── Line Items ─────────────────────────────────────────────────── */}
      <div className="slip-items">
        <div className="slip-items-title">Items to Pack</div>
        {order.lineItems.map((item) => (
          <div key={item.id} className="line-item-row">
            <span className="line-item-qty">{item.quantityToPack}×</span>
            <div className="line-item-details">
              <div className="line-item-name">{item.title}</div>
              {item.variantTitle && (
                <div className="line-item-variant">{item.variantTitle}</div>
              )}
              {settings.showSku && item.sku && (
                <div className="line-item-sku">SKU: {item.sku}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Shipping Address ───────────────────────────────────────────── */}
      {settings.showAddress && (order.shippingAddress || recipientName) && (
        <div className="slip-address">
          <div className="slip-address-title">Ship To</div>
          {recipientName && (
            <div className="slip-recipient-name">{recipientName}</div>
          )}
          {order.shippingAddress?.formatted.map((line, i) => (
            <div key={i}>{line}</div>
          ))}
          {order.shippingAddress?.city &&
            !order.shippingAddress.formatted.some((l) =>
              l.includes(order.shippingAddress?.city || "")
            ) && (
              <div>
                {order.shippingAddress.city}
                {order.shippingAddress.country
                  ? `, ${order.shippingAddress.country}`
                  : ""}
              </div>
            )}
        </div>
      )}

      {/* ── Customer Note ──────────────────────────────────────────────── */}
      {settings.showNotes && order.note && (
        <div className="slip-note">
          <div className="slip-note-title">Note</div>
          {order.note}
        </div>
      )}

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div className="slip-footer">
        {settings.footer ? settings.footer : "ThermoSlip · Order Printer"}
      </div>
    </div>
  );
}
