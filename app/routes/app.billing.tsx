import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Page, Layout, Card, Text, Button, BlockStack, InlineStack, Badge, Box } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { billingService } from "../lib/plan.server";
import { AppIcon } from "../components/AppIcon";

/**
 * Story 5.2 — Billing route via Shopify App Pricing (FR-15)
 * Displays Plan status and upgrade to Pro ($4.99/mo or $49/yr).
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const [plan, isPro, upgradeUrl] = await Promise.all([
    billingService.getPlan({ admin, session }),
    billingService.isPro({ admin, session }),
    billingService.getUpgradeUrl({ admin, session }),
  ]);
  return { plan, isPro, upgradeUrl };
};

export default function BillingPage() {
  const { plan, isPro, upgradeUrl } = useLoaderData<typeof loader>();

  return (
    <Page
      title="Plan & Billing"
      titleMetadata={<AppIcon size={28} />}
      subtitle="Manage your ThermoSlip printing subscription"
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text variant="headingMd" as="h2">
                    Current Plan
                  </Text>
                  <Badge tone={isPro ? "success" : "info"}>
                    {isPro ? "Pro Plan (Active)" : "Free Plan"}
                  </Badge>
                </InlineStack>
                <Text as="p" tone="subdued">
                  {isPro
                    ? "You have unlimited packing slip printing each month."
                    : "You are currently on the Free plan, which includes 50 printed orders per month."}
                </Text>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h3">
                  Available Plans
                </Text>

                <InlineStack gap="400" wrap={false}>
                  <Box
                    background="bg-surface-secondary"
                    padding="400"
                    borderRadius="200"
                    minWidth="48%"
                  >
                    <BlockStack gap="200">
                      <Text variant="headingSm" as="h4">
                        Free Tier
                      </Text>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        $0 / month
                      </Text>
                      <Text as="p" variant="bodySm">
                        • 50 orders printed per month
                      </Text>
                      <Text as="p" variant="bodySm">
                        • Complete 4×6 thermal packing slips
                      </Text>
                      <Text as="p" variant="bodySm">
                        • Code 128 barcode scanning
                      </Text>
                      {!isPro && (
                        <Box paddingBlockStart="200">
                          <Badge tone="info">Active Plan</Badge>
                        </Box>
                      )}
                    </BlockStack>
                  </Box>

                  <Box
                    background="bg-surface-secondary"
                    padding="400"
                    borderRadius="200"
                    minWidth="48%"
                  >
                    <BlockStack gap="200">
                      <InlineStack align="space-between">
                        <Text variant="headingSm" as="h4">
                          Pro Plan
                        </Text>
                        <Badge tone="success">Recommended</Badge>
                      </InlineStack>
                      <Text variant="bodyMd" as="p" tone="subdued">
                        $4.99 / month or $49 / year
                      </Text>
                      <Text as="p" variant="bodySm">
                        • <strong>Unlimited</strong> packing slip prints
                      </Text>
                      <Text as="p" variant="bodySm">
                        • Full atelier packing warnings
                      </Text>
                      <Text as="p" variant="bodySm">
                        • Priority support & updates
                      </Text>
                      <Box paddingBlockStart="200">
                        {isPro ? (
                          <Badge tone="success">Current Plan</Badge>
                        ) : (
                          <Button
                            variant="primary"
                            url={upgradeUrl}
                            target="_top"
                            onClick={() => {
                              if (typeof window !== "undefined" && window.top) {
                                window.top.location.href = upgradeUrl;
                              }
                            }}
                          >
                            Upgrade to Pro
                          </Button>
                        )}
                      </Box>
                    </BlockStack>
                  </Box>
                </InlineStack>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
