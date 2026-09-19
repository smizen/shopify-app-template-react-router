import "@shopify/ui-extensions/preact";
import { render } from "preact";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const { data } = shopify;
  const selectedOrders =
    data?.selected && data.selected.length > 0
      ? data.selected
      : data?.order
        ? [data.order]
        : [];
  const count = selectedOrders.length;

  let banner = null;
  let src = null;

  if (count === 0) {
    banner = (
      <s-banner tone="info" heading="No orders selected">
        Please select at least one order to print packing slips.
      </s-banner>
    );
  } else if (count > 50) {
    // Architectural requirement: strict blocking without silent truncation
    banner = (
      <s-banner tone="critical" heading="Order limit exceeded">
        {`${count} orders selected. OrderJet supports up to 50 at once. Please select 50 or fewer.`}
      </s-banner>
    );
    src = null;
  } else {
    // Build query params safely via URLSearchParams
    const ids = selectedOrders.map((order) => order.id);
    const params = new URLSearchParams({ orders: ids.join(",") });
    src = `app:print-document?${params.toString()}`;

    banner = (
      <s-banner tone="success" heading="Ready to print">
        {`Generating 4×6 thermal packing slips for ${count} order${count > 1 ? "s" : ""}.`}
      </s-banner>
    );
  }

  return (
    <s-admin-print-action src={src}>
      <s-stack direction="block">
        {banner}
      </s-stack>
    </s-admin-print-action>
  );
}
