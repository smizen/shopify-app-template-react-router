import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Page, Layout, Card, Text, Banner } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getReadyToPackOrders } from "../lib/orders.server";

/**
 * Story 2.1 — Query GraphQL Commandes + Metafield printStatus (FR-1)
 *
 * Loader fetches the active order queue with:
 * - Status: open
 * - Fulfillment status: unfulfilled OR partial
 * - Financial status: paid OR partially_refunded
 * - Respects FIFO (created_at asc)
 * - Safe GraphQL cost: orders(first: 50) + lineItems(first: 15)
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const cursor = url.searchParams.get("cursor");

  const { orders, pageInfo, cost } = await getReadyToPackOrders(admin, cursor);

  return {
    orders,
    pageInfo,
    cost,
  };
};

export default function Index() {
  const { orders, pageInfo, cost } = useLoaderData<typeof loader>();

  return (
    <Page title="Ready to Pack" subtitle={`${orders.length} order(s) in queue`}>
      <Layout>
        {cost && (
          <Layout.Section>
            <Banner title="GraphQL Query Cost (Debug)" tone="info">
              <p>
                Requested Cost: <strong>{cost.requestedQueryCost}</strong> | Actual Cost: <strong>{cost.actualQueryCost ?? "N/A"}</strong> | Restore Rate: <strong>{cost.throttleStatus?.restoreRate ?? 50}/s</strong>
              </p>
            </Banner>
          </Layout.Section>
        )}
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              Ready to Pack Queue ({orders.length} loaded)
            </Text>
            {orders.length === 0 ? (
              <div style={{ padding: "16px 0" }}>
                <Text as="p" tone="subdued">
                  No orders currently waiting to pack.
                </Text>
              </div>
            ) : (
              <ul style={{ paddingLeft: "20px", marginTop: "12px" }}>
                {orders.map((order) => (
                  <li key={order.id} style={{ marginBottom: "8px" }}>
                    <strong>{order.name}</strong> — {order.lineItems.length} packable line(s)
                    {order.hasMoreItems && " (has more items > 15)"}
                    {order.printStatus && " [Printed]"}
                  </li>
                ))}
              </ul>
            )}
            {pageInfo.hasNextPage && (
              <div style={{ marginTop: "12px" }}>
                <Text as="p" tone="subdued">
                  More orders available on next page.
                </Text>
              </div>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
