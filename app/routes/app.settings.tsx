import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs, LinksFunction } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Checkbox,
  TextField,
  Button,
  InlineStack,
  Banner,
  Box,
  Divider,
} from "@shopify/polaris";
import { ExternalIcon, CheckIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getAppSettings, saveAppSettings } from "../lib/metafields.server";
import { getShopName } from "../lib/orders.server";
import { PackingSlipPage } from "../components/PackingSlip/PackingSlipPage";
import { DEMO_ORDERS } from "../lib/demo-orders";
import type { Settings } from "../types/thermoslip";
import { DEFAULT_SETTINGS } from "../types/thermoslip";
import printStyles from "../components/PackingSlip/print.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: printStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const [settings, shopName] = await Promise.all([
    getAppSettings(admin),
    getShopName(admin),
  ]);

  return {
    settings,
    shopName,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const showLogo = formData.get("showLogo") === "true";
  const showAddress = formData.get("showAddress") === "true";
  const showSku = formData.get("showSku") === "true";
  const showNotes = formData.get("showNotes") === "true";
  const rawFooter = formData.get("footer");
  const footer = typeof rawFooter === "string" ? rawFooter : "";

  // Server-side validation: footer max 120 chars (explicit error, no silent truncation)
  if (footer.length > 120) {
    return {
      success: false,
      fieldErrors: {
        footer: "Footer message must be 120 characters or less.",
      },
    };
  }

  const result = await saveAppSettings(admin, {
    showLogo,
    showAddress,
    showSku,
    showNotes,
    footer,
  });

  if (!result.success) {
    return {
      success: false,
      fieldErrors: result.fieldErrors,
      userErrors: result.userErrors,
    };
  }

  return {
    success: true,
    savedAt: Date.now(),
  };
};

export default function SettingsRoute() {
  const { settings: initialSettings, shopName } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();

  const [formState, setFormState] = useState<Settings>({
    ...DEFAULT_SETTINGS,
    ...initialSettings,
  });

  const isSubmitting = fetcher.state === "submitting";
  const actionData = fetcher.data;
  const isSuccess = actionData?.success === true;
  const fieldErrors = actionData?.success === false ? actionData.fieldErrors : undefined;

  const sampleOrder = DEMO_ORDERS[1] || DEMO_ORDERS[0];

  const handleSave = () => {
    const formData = new FormData();
    formData.set("showLogo", String(formState.showLogo));
    formData.set("showAddress", String(formState.showAddress));
    formData.set("showSku", String(formState.showSku));
    formData.set("showNotes", String(formState.showNotes));
    formData.set("footer", formState.footer);

    fetcher.submit(formData, { method: "post" });
  };

  const handlePreviewNewTab = () => {
    window.open("/app/print?sample=true", "_blank");
  };

  return (
    <Page
      title="Packing Slip Settings"
      subtitle="Customize what appears on your 4×6 thermal packing slips without writing code."
      primaryAction={{
        content: "Save Settings",
        onAction: handleSave,
        loading: isSubmitting,
        disabled: isSubmitting,
      }}
      secondaryActions={[
        {
          content: "Preview Sample",
          icon: ExternalIcon,
          onAction: handlePreviewNewTab,
        },
      ]}
    >
      <BlockStack gap="500">
        {isSuccess && (
          <Banner tone="success" title="Settings saved successfully">
            <p>
              Your packing slip customizations have been saved and will apply to
              all future print batches.
            </p>
          </Banner>
        )}

        {fieldErrors?.footer && (
          <Banner tone="critical" title="Cannot save settings">
            <p>{fieldErrors.footer}</p>
          </Banner>
        )}

        <Layout>
          {/* ── Left Column: Settings Form ─────────────────────────────── */}
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Header & Information
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Choose which metadata sections to display on your thermal slips.
                  </Text>

                  <Divider />

                  <Checkbox
                    label="Show store branding"
                    helpText="Prints your store name in the header of each slip."
                    checked={formState.showLogo}
                    onChange={(val) => setFormState((prev) => ({ ...prev, showLogo: val }))}
                  />

                  <Checkbox
                    label="Show customer shipping address"
                    helpText="Prints the recipient name, address, city, and country on page 1."
                    checked={formState.showAddress}
                    onChange={(val) => setFormState((prev) => ({ ...prev, showAddress: val }))}
                  />

                  <Checkbox
                    label="Show SKU"
                    helpText="Displays product SKU numbers underneath item titles to assist picking."
                    checked={formState.showSku}
                    onChange={(val) => setFormState((prev) => ({ ...prev, showSku: val }))}
                  />

                  <Checkbox
                    label="Show order notes"
                    helpText="Prints customer delivery instructions and order notes on page 1."
                    checked={formState.showNotes}
                    onChange={(val) => setFormState((prev) => ({ ...prev, showNotes: val }))}
                  />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Footer & Branding
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Add an optional custom message at the bottom of each slip (returns info, support URL, or thank-you note).
                  </Text>

                  <TextField
                    label="Custom footer message"
                    value={formState.footer}
                    onChange={(val) => setFormState((prev) => ({ ...prev, footer: val }))}
                    maxLength={120}
                    showCharacterCount
                    autoComplete="off"
                    helpText="Leave empty to display default branding ('ThermoSlip · Order Printer'). Max 120 characters."
                    error={fieldErrors?.footer}
                  />
                </BlockStack>
              </Card>

              <InlineStack align="end" gap="300">
                <Button onClick={handlePreviewNewTab} icon={ExternalIcon}>
                  Preview Sample
                </Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  icon={CheckIcon}
                >
                  Save Settings
                </Button>
              </InlineStack>
            </BlockStack>
          </Layout.Section>

          {/* ── Right Column: Live Interactive 4×6 Preview ────────────── */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingSm">
                    Live Sample Preview
                  </Text>
                  <Text as="span" variant="bodyXs" tone="subdued">
                    4×6 in (203 DPI)
                  </Text>
                </InlineStack>
                <Text as="p" variant="bodyXs" tone="subdued">
                  Updates in real time as you adjust settings.
                </Text>

                <Box
                  background="bg-surface-secondary"
                  padding="400"
                  borderRadius="200"
                >
                  <div
                    style={{
                      width: "100%",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      padding: "12px 0",
                    }}
                  >
                    <div
                      style={{
                        width: "calc(4in * 0.60)",
                        height: "calc(6in * 0.60)",
                        position: "relative",
                        flexShrink: 0,
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "4in",
                          height: "6in",
                          transformOrigin: "top left",
                          transform: "scale(0.60)",
                          pointerEvents: "none",
                        }}
                      >
                        <PackingSlipPage
                          order={sampleOrder}
                          settings={formState}
                          shopName={shopName || "My Store"}
                        />
                      </div>
                    </div>
                  </div>
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
