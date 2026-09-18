import type { Order, Settings } from "../../types/thermoslip";
import { WarningBanner } from "./WarningBanner";
import { Barcode } from "./Barcode";
import { PageIndicator } from "./PageIndicator";

export const ITEMS_PER_PAGE = 8;

export function calculateTotalPages(itemCount: number): number {
  return Math.max(1, Math.ceil(itemCount / ITEMS_PER_PAGE));
}

export function chunkLineItems<T>(items: T[], size = ITEMS_PER_PAGE): T[][] {
  if (!items || items.length === 0) {
    return [[]];
  }
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

interface PackingSlipPageProps {
  order: Order;
  settings: Settings;
  shopName: string;
}

/**
 * Renders the 4×6 thermal packing slip(s) for one order.
 * If order has > 8 line items, splits deterministically into multiple 4×6 pages
 * with page indicators (Page 1/2, Page 2/2) and continuation headers (Story 3.3, FR-8).
 */
export function PackingSlipPage({ order, settings, shopName }: PackingSlipPageProps) {
  const formattedDate = new Date(order.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const recipientName =
    order.shippingAddress?.name?.trim() || order.customerName?.trim();

  const itemChunks = chunkLineItems(order.lineItems);
  const totalPages = itemChunks.length;

  return (
    <>
      {itemChunks.map((chunk, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const currentPage = pageIndex + 1;

        return (
          <div
            key={`${order.id}-page-${currentPage}`}
            className="packing-slip print-preview-slip"
            data-order-id={order.id}
            data-page-number={currentPage}
            data-total-pages={totalPages}
          >
            {/* ── Header ─────────────────────────────────────────────────────── */}
            {isFirstPage ? (
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
            ) : (
              <div className="slip-header slip-header--continuation">
                <div className="slip-header-left">
                  <div className="slip-shop-name">
                    {settings.showLogo && shopName ? shopName : "ThermoSlip"}
                  </div>
                  <div className="slip-order-date">{formattedDate}</div>
                </div>
                <div className="slip-order-meta">
                  <div className="slip-order-name">{order.name} (Cont.)</div>
                  <Barcode
                    value={order.name}
                    width={1.4}
                    height={28}
                    displayValue={true}
                    fontSize={8}
                  />
                </div>
              </div>
            )}

            {/* ── Carrier / Shipping Bar (Top Third, Page 1 only) ────────────── */}
            {isFirstPage && order.shippingMethod && (
              <div className="slip-carrier-bar">
                <span className="slip-carrier-label">SHIP VIA:</span>
                <span className="slip-carrier-name">{order.shippingMethod}</span>
              </div>
            )}

            {/* ── Packing Warnings (Page 1 only) ────────────────────────────── */}
            {isFirstPage && <WarningBanner warnings={order.warnings} />}

            {/* ── Line Items (Chunk of up to 8 items) ────────────────────────── */}
            <div className="slip-items">
              <div className="slip-items-title">
                {isFirstPage ? "Items to Pack" : "Items to Pack (Continued)"}
              </div>
              {chunk.map((item) => {
                const itemTitle = item.variantTitle
                  ? `${item.title} / ${item.variantTitle}`
                  : item.title;

                return (
                  <div key={item.id} className="line-item-row">
                    <span className="line-item-qty">{item.quantityToPack}×</span>
                    <div className="line-item-details">
                      <div className="line-item-name" title={itemTitle}>
                        {itemTitle}
                      </div>
                      {settings.showSku && item.sku && (
                        <div className="line-item-sku">SKU: {item.sku}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Shipping Address (Page 1 only) ────────────────────────────── */}
            {isFirstPage &&
              settings.showAddress &&
              (order.shippingAddress || recipientName) && (
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

            {/* ── Customer Note (Page 1 only) ───────────────────────────────── */}
            {isFirstPage && settings.showNotes && order.note && (
              <div className="slip-note">
                <div className="slip-note-title">Note</div>
                {order.note}
              </div>
            )}

            {/* ── Page Indicator (Multi-page only) ─────────────────────────── */}
            <PageIndicator currentPage={currentPage} totalPages={totalPages} />

            {/* ── Footer ─────────────────────────────────────────────────────── */}
            <div className="slip-footer">
              {settings.footer ? settings.footer : "ThermoSlip · Order Printer"}
            </div>
          </div>
        );
      })}
    </>
  );
}
