import type { LoaderFunctionArgs } from "react-router";
import { Page, Layout, Card, Text, Button } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

/**
 * Story 5.1 & 5.2 — Billing route (FR-14, FR-15)
 * Displays Plan status and upgrade to Pro ($4.99/mo).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function BillingPage() {
  return (
    <Page title="Plan & Billing">
      <Layout>
        <Layout.Section>
          <Card>
            <Text variant="headingMd" as="h2">
              ThermoSlip Plans
            </Text>
            <Text as="p" tone="subdued">
              Free plan includes 50 printed orders per month. Upgrade to Pro for unlimited printing.
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
