import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  TextField,
  Button,
  InlineStack,
  Banner,
  Badge,
  Divider,
  Box,
} from "@shopify/polaris";
import { SendIcon, EmailIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { billingService } from "../lib/plan.server";
import {
  validateSupportInput,
  getSupportEmailService,
  type ValidationErrors,
} from "../lib/support-email.server";

export const GET_SHOP_CONTACT_QUERY = `#graphql
query GetShopContactInfo {
  shop {
    name
    contactEmail
    email
  }
}
`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const [plan, shopInfoRes] = await Promise.all([
    billingService.getPlan({ admin, session }),
    admin.graphql(GET_SHOP_CONTACT_QUERY).catch(() => null),
  ]);

  let defaultEmail = "";
  if (shopInfoRes) {
    try {
      const json: any = await shopInfoRes.json();
      const shop = json.data?.shop;
      defaultEmail = shop?.contactEmail || shop?.email || "";
    } catch {
      defaultEmail = "";
    }
  }

  const planLabel = plan === "pro" ? "Pro" : "Free";

  return {
    shopDomain: session?.shop || "unknown.myshopify.com",
    defaultEmail,
    plan: planLabel,
    appVersion: "1.0.0",
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const subject = String(formData.get("subject") || "");
  const message = String(formData.get("message") || "");
  const email = String(formData.get("email") || "");

  const { isValid, errors } = validateSupportInput({ subject, message, email });

  if (!isValid) {
    return {
      success: false,
      fieldErrors: errors,
      values: { subject, message, email },
    };
  }

  const plan = (await billingService.getPlan({ admin, session })).toUpperCase();
  const userAgent = request.headers.get("user-agent") || undefined;

  const emailService = getSupportEmailService();
  const sendResult = await emailService.sendSupportMessage({
    shopDomain: session?.shop || "unknown.myshopify.com",
    replyTo: email.trim() || undefined,
    subject: subject.trim(),
    message: message.trim(),
    plan,
    appVersion: "1.0.0",
    userAgent,
    sentAt: new Date().toISOString(),
  });

  if (!sendResult.success) {
    return {
      success: false,
      error: sendResult.error || "We couldn't send your message. Please try again.",
      values: { subject, message, email },
    };
  }

  return {
    success: true,
    savedAt: Date.now(),
  };
};

export default function SupportRoute() {
  const { shopDomain, defaultEmail, plan, appVersion } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const navigate = useNavigate();

  const [subject, setSubject] = useState("");
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");

  const isSubmitting = fetcher.state === "submitting";
  const actionData = fetcher.data;
  const isSuccess = actionData?.success === true;
  const fieldErrors: ValidationErrors | undefined =
    actionData?.success === false ? actionData.fieldErrors : undefined;
  const generalError = actionData?.success === false ? actionData.error : undefined;

  // Reset form upon successful submission
  useEffect(() => {
    if (isSuccess) {
      setSubject("");
      setMessage("");
    }
  }, [isSuccess]);

  const handleSubmit = () => {
    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("email", email);
    formData.set("message", message);
    fetcher.submit(formData, { method: "post" });
  };

  return (
    <Page
      title="Support"
      subtitle="Need help with ThermoSlip? Send us a message and we’ll get back to you."
      backAction={{
        content: "Ready to Pack",
        onAction: () => navigate("/app"),
      }}
    >
      <BlockStack gap="500">
        {isSuccess && (
          <Banner tone="success" title="Message sent successfully.">
            <p>
              Thank you for contacting us. We have received your inquiry and will
              review it shortly.
            </p>
          </Banner>
        )}

        {generalError && (
          <Banner tone="critical" title="Unable to send message">
            <p>{generalError}</p>
          </Banner>
        )}

        <Layout>
          {/* ── Left Column: Contact Form ────────────────────────────── */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Contact the ThermoSlip Team
                </Text>

                <TextField
                  label="Subject"
                  value={subject}
                  onChange={setSubject}
                  maxLength={200}
                  showCharacterCount
                  autoComplete="off"
                  placeholder="e.g., Thermal printer formatting issue, Quota upgrade..."
                  error={fieldErrors?.subject}
                  requiredIndicator
                />

                <TextField
                  label="Reply-to Email (optional)"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  autoComplete="email"
                  helpText="We will send our reply to this address. Defaults to your store contact email."
                  error={fieldErrors?.email}
                />

                <TextField
                  label="Message"
                  value={message}
                  onChange={setMessage}
                  multiline={6}
                  maxLength={5000}
                  showCharacterCount
                  autoComplete="off"
                  placeholder="Describe what happened, your printer model (Munbyn, Rollo, Zebra...), or your question..."
                  error={fieldErrors?.message}
                  requiredIndicator
                />

                <InlineStack align="end">
                  <Button
                    variant="primary"
                    icon={SendIcon}
                    onClick={handleSubmit}
                    loading={isSubmitting}
                    disabled={isSubmitting}
                  >
                    Send message
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ── Right Column: Info & Context Card ────────────────────── */}
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingSm">
                  Inquiry Context
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  The following details will be automatically included with your message to help us assist you faster:
                </Text>

                <Box background="bg-surface-secondary" padding="300" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="span" variant="bodyXs" fontWeight="semibold">
                        Store:
                      </Text>
                      <Text as="span" variant="bodyXs" tone="subdued">
                        {shopDomain}
                      </Text>
                    </InlineStack>

                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="span" variant="bodyXs" fontWeight="semibold">
                        Current Plan:
                      </Text>
                      <Badge tone={plan === "Pro" ? "success" : "info"}>{plan}</Badge>
                    </InlineStack>

                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="span" variant="bodyXs" fontWeight="semibold">
                        App Version:
                      </Text>
                      <Text as="span" variant="bodyXs" tone="subdued">
                        v{appVersion}
                      </Text>
                    </InlineStack>
                  </BlockStack>
                </Box>

                <Divider />

                <BlockStack gap="200">
                  <InlineStack gap="200" blockAlign="center">
                    <EmailIcon />
                    <Text as="span" variant="bodySm" fontWeight="semibold">
                      Direct Email
                    </Text>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    You can also reach our engineering team directly at:
                  </Text>
                  <Text as="p" variant="bodySm" fontWeight="bold">
                    contact@devcraft-solutions.org
                  </Text>
                  <Text as="p" variant="bodyXs" tone="subdued">
                    We usually reply as soon as possible.
                  </Text>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
