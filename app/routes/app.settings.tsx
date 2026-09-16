import type { LoaderFunctionArgs } from "react-router";
import { Page, Layout, Card, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";

/**
 * Story 4.3 — Page Paramètres Boutique (FR-13)
 * Persists settings via App-data metafields on AppInstallation (thermoslip/settings).
 * TODO: Implement in Epic 4, Story 4.3
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  void admin;
  return {};
};

export default function SettingsRoute() {
  return (
    <Page title="ThermoSlip — Settings">
      <Layout>
        <Layout.Section>
          <Card>
            <Text as="p" variant="bodyMd">
              Story 4.3 will render the 5 slip settings (branding, address,
              SKU, notes, footer) + Preview Sample button here.
            </Text>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
