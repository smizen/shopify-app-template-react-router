import type { LoaderFunctionArgs } from "react-router";
import { Page, Layout, Card, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

/**
 * Story 3.1–3.3 — Print route
 * Accepts ?orders=gid1,gid2,... and renders packing slips for printing.
 * TODO: Implement in Epic 3
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  void admin;
  return {};
};

export default function PrintRoute() {
  return (
    <Page title="ThermoSlip — Print Packing Slips">
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="p" variant="bodyMd">
              Stories 3.1–3.3 will render packing slips here (4×6 thermal
              layout with CSS @page).
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
