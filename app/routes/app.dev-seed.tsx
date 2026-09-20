import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData, useNavigation, Form } from "react-router";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  Banner,
  DataTable,
  Badge,
  InlineStack,
  Box,
  Divider,
  List,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { setOrdersPrintedStatus } from "../lib/metafields.server";

export const DEMO_TAG = "thermoslip-demo";

export interface DemoOrderSpec {
  name: string;
  scenario: string;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    name: string;
    address1: string;
    city: string;
    province?: string;
    zip: string;
    country: string;
    phone?: string;
  };
  shippingTitle: string;
  shippingPrice: string;
  note?: string;
  isPrePrinted?: boolean;
  lineItems: Array<{
    title: string;
    quantity: number;
    price: string;
    sku: string;
    requiresShipping?: boolean;
  }>;
}

export const SEED_ORDER_SPECS: DemoOrderSpec[] = [
  // 1. Simple order — 1 item
  {
    name: "Simple Order (1 item)",
    scenario: "Single item, standard ground",
    customer: {
      firstName: "Marcus",
      lastName: "Vance",
      email: "marcus.vance.demo@example.com",
      phone: "+1 512-555-0143",
    },
    shippingAddress: {
      name: "Marcus Vance",
      address1: "452 Oak Ridge Lane",
      city: "Austin",
      province: "Texas",
      zip: "78701",
      country: "United States",
      phone: "+1 512-555-0143",
    },
    shippingTitle: "Standard Ground Shipping",
    shippingPrice: "5.00",
    lineItems: [
      {
        title: "Artisan Stoneware Coffee Mug - Sandstone",
        quantity: 1,
        price: "24.00",
        sku: "MUG-ART-SND",
        requiresShipping: true,
      },
    ],
  },
  // 2. Multi quantity — 3x same item
  {
    name: "Multi-Quantity (3x)",
    scenario: "Quantity badge showcase",
    customer: {
      firstName: "Elena",
      lastName: "Rostova",
      email: "elena.rostova.demo@example.com",
      phone: "+1 716-555-0182",
    },
    shippingAddress: {
      name: "Elena Rostova",
      address1: "1280 Elmwood Ave",
      city: "Buffalo",
      province: "New York",
      zip: "14222",
      country: "United States",
      phone: "+1 716-555-0182",
    },
    shippingTitle: "Standard Shipping",
    shippingPrice: "6.50",
    lineItems: [
      {
        title: "Linen Kitchen Hand Towel - Slate Grey",
        quantity: 3,
        price: "16.00",
        sku: "TOW-LIN-SLT",
        requiresShipping: true,
      },
    ],
  },
  // 3. Customer note
  {
    name: "Customer Note",
    scenario: "Customer packing instructions on slip",
    customer: {
      firstName: "David",
      lastName: "Miller",
      email: "david.miller.demo@example.com",
      phone: "+1 206-555-0199",
    },
    shippingAddress: {
      name: "David K. Miller",
      address1: "88 Pine Street, Suite 400",
      city: "Seattle",
      province: "Washington",
      zip: "98101",
      country: "United States",
      phone: "+1 206-555-0199",
    },
    shippingTitle: "Standard Delivery",
    shippingPrice: "5.50",
    note: "Please do not include price receipt in the box - this is a birthday gift for my sister.",
    lineItems: [
      {
        title: "Organic Soy Wax Candle - Amber & Moss (8oz)",
        quantity: 1,
        price: "22.00",
        sku: "CNDL-AMB-08",
        requiresShipping: true,
      },
    ],
  },
  // 4. Express shipping
  {
    name: "Express Delivery",
    scenario: "Express badge indicator",
    customer: {
      firstName: "Chloe",
      lastName: "Tremblay",
      email: "chloe.tremblay.demo@example.com",
      phone: "+1 514-555-0112",
    },
    shippingAddress: {
      name: "Chloe Tremblay",
      address1: "3400 Boulevard de Maisonneuve",
      city: "Montreal",
      province: "Quebec",
      zip: "H3Z 3C1",
      country: "Canada",
      phone: "+1 514-555-0112",
    },
    shippingTitle: "Express Air Delivery (Next Day)",
    shippingPrice: "18.00",
    lineItems: [
      {
        title: "Handcrafted Leather Passport Wallet - Cognac",
        quantity: 1,
        price: "48.00",
        sku: "WAL-LTH-COG",
        requiresShipping: true,
      },
    ],
  },
  // 5. Multi Qty + Note + Express
  {
    name: "Express + Note + Multi-Qty",
    scenario: "High priority workshop packing",
    customer: {
      firstName: "James",
      lastName: "Thornton",
      email: "james.thornton.demo@example.com",
      phone: "+44 20 7946 0912",
    },
    shippingAddress: {
      name: "James Thornton",
      address1: "15 Oxford Gardens",
      city: "London",
      province: "Greater London",
      zip: "W10 5UU",
      country: "United Kingdom",
      phone: "+44 20 7946 0912",
    },
    shippingTitle: "DHL Express Worldwide",
    shippingPrice: "24.00",
    note: "URGENT for workshop event on Monday morning. Handle with care - fragile glass dropper bottles.",
    lineItems: [
      {
        title: "Cedarwood Essential Oil Diffuser (100ml)",
        quantity: 4,
        price: "28.00",
        sku: "OIL-CDR-100",
        requiresShipping: true,
      },
    ],
  },
  // 6. Multiple different products with SKUs
  {
    name: "Multiple Products & SKUs",
    scenario: "Multi-line picking list",
    customer: {
      firstName: "Amina",
      lastName: "Al-Mansoor",
      email: "amina.almansoor.demo@example.com",
      phone: "+1 213-555-0177",
    },
    shippingAddress: {
      name: "Amina Al-Mansoor",
      address1: "712 Sunset Boulevard",
      city: "Los Angeles",
      province: "California",
      zip: "90028",
      country: "United States",
      phone: "+1 213-555-0177",
    },
    shippingTitle: "Standard Parcel",
    shippingPrice: "8.00",
    lineItems: [
      {
        title: "Ceramic Pour-Over Coffee Dripper - Matte Black",
        quantity: 1,
        price: "32.00",
        sku: "DRP-CRM-BLK",
        requiresShipping: true,
      },
      {
        title: "Bleached Cone Paper Coffee Filters (100pk)",
        quantity: 2,
        price: "9.50",
        sku: "FLT-PPR-100",
        requiresShipping: true,
      },
      {
        title: "Precision Coffee Measuring Scoop - Walnut",
        quantity: 1,
        price: "14.00",
        sku: "SPN-WLN-01",
        requiresShipping: true,
      },
    ],
  },
  // 7. Large order with 14 line items to test pagination
  {
    name: "Large Multi-Page Order (14 items)",
    scenario: "Thermal slip 2-page pagination",
    customer: {
      firstName: "Lars",
      lastName: "Lindqvist",
      email: "lars.nordic.demo@example.com",
      phone: "+46 8 123 4567",
    },
    shippingAddress: {
      name: "Nordic Living Boutique (Attn: Lars Lindqvist)",
      address1: "Stortorget 14",
      city: "Stockholm",
      zip: "111 29",
      country: "Sweden",
      phone: "+46 8 123 4567",
    },
    shippingTitle: "Heavy Freight Courier Service",
    shippingPrice: "45.00",
    note: "Stock replenishment for Autumn boutique display. Ensure all ceramic items are individually wrapped.",
    lineItems: [
      { title: "Pure Wool Throw Blanket - Oatmeal", quantity: 2, price: "95.00", sku: "BLN-WOL-OAT", requiresShipping: true },
      { title: "Solid Brass Candle Snuffer", quantity: 1, price: "24.00", sku: "ACC-BRS-SNF", requiresShipping: true },
      { title: "Ribbed Glass Tumbler - Forest Green", quantity: 3, price: "18.00", sku: "GLS-TMB-GRN", requiresShipping: true },
      { title: "Cast Iron Japanese Teapot - 800ml", quantity: 1, price: "68.00", sku: "TEA-IRN-800", requiresShipping: true },
      { title: "Ceramic Japanese Tea Cup - Speckled White", quantity: 4, price: "15.00", sku: "CUP-TEA-WHT", requiresShipping: true },
      { title: "Handmade Bamboo Tea Serving Tray", quantity: 1, price: "38.00", sku: "TRY-BMB-01", requiresShipping: true },
      { title: "Ceremonial Grade Organic Matcha (50g)", quantity: 2, price: "29.00", sku: "MTC-CER-050", requiresShipping: true },
      { title: "Raw Wildflower Honeycomb Jar (250g)", quantity: 2, price: "19.50", sku: "HNY-ACA-250", requiresShipping: true },
      { title: "Stoneware Covered Butter Dish - Cream", quantity: 1, price: "28.00", sku: "DSH-BTR-CRM", requiresShipping: true },
      { title: "Woven Slub Cotton Napkin Set (Set of 4)", quantity: 3, price: "22.00", sku: "NPK-WVN-04", requiresShipping: true },
      { title: "End-Grain Walnut Wood Cutting Board (Large)", quantity: 1, price: "85.00", sku: "BRD-CUT-WLN", requiresShipping: true },
      { title: "Hand-Dipped Taper Candle Pair - Moss Olive", quantity: 2, price: "14.00", sku: "CND-TPR-OLV", requiresShipping: true },
      { title: "Ceramic Oil Cruet with Brass Spout", quantity: 1, price: "34.00", sku: "CRU-OIL-CRM", requiresShipping: true },
      { title: "Heavy Duty Kitchen Cooking Tongs", quantity: 1, price: "16.00", sku: "UTN-TNG-SS", requiresShipping: true },
    ],
  },
  // 8. Order already marked as Printed
  {
    name: "Pre-Printed Status Order",
    scenario: "Printed status badge check",
    isPrePrinted: true,
    customer: {
      firstName: "Claire",
      lastName: "Beauchamp",
      email: "claire.beauchamp.demo@example.com",
      phone: "+44 131 555 0192",
    },
    shippingAddress: {
      name: "Claire Beauchamp",
      address1: "22 Castle Wynd",
      city: "Edinburgh",
      zip: "EH1 2NE",
      country: "United Kingdom",
      phone: "+44 131 555 0192",
    },
    shippingTitle: "Royal Mail Tracked 48",
    shippingPrice: "4.50",
    lineItems: [
      {
        title: "Merino Wool Ribbed Beanie - Heather Charcoal",
        quantity: 1,
        price: "36.00",
        sku: "BN-WOL-CHR",
        requiresShipping: true,
      },
    ],
  },
  // 9. Mixed order for Reprint demo
  {
    name: "Reprint Demo Order",
    scenario: "Reprint quota exclusion demo",
    isPrePrinted: true,
    customer: {
      firstName: "Benjamin",
      lastName: "Hayes",
      email: "benjamin.hayes.demo@example.com",
      phone: "+1 404-555-0164",
    },
    shippingAddress: {
      name: "Benjamin Hayes",
      address1: "504 Peachtree St NE",
      city: "Atlanta",
      province: "Georgia",
      zip: "30308",
      country: "United States",
      phone: "+1 404-555-0164",
    },
    shippingTitle: "Priority Overnight Courier",
    shippingPrice: "19.00",
    note: "Customer requested duplicate packing slip reprint for customs documentation.",
    lineItems: [
      {
        title: "Top-Grain Leather Refillable Journal - Saddle Brown",
        quantity: 1,
        price: "42.00",
        sku: "JRN-LTH-SAD",
        requiresShipping: true,
      },
      {
        title: "Heavyweight Brass Rollerball Pen (Black Ink)",
        quantity: 2,
        price: "26.00",
        sku: "PEN-BRS-BLK",
        requiresShipping: true,
      },
    ],
  },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Safety check: Dev store validation
  const shop = session.shop || "";
  const isDevStore = shop.includes("dev-") || shop.includes("test") || shop.includes("myshopify.com");

  // Query existing orders tagged with DEMO_TAG
  const res = await admin.graphql(
    `#graphql
      query GetDemoOrders {
        orders(first: 50, query: "tag:${DEMO_TAG}") {
          nodes {
            id
            name
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            lineItems(first: 5) {
              nodes {
                title
                quantity
              }
            }
            printStatus: metafield(namespace: "$app", key: "print_status") {
              value
            }
          }
        }
      }
    `,
  );

  const json: any = await res.json();
  const demoOrders = json.data?.orders?.nodes || [];

  return {
    shop,
    isDevStore,
    demoOrderCount: demoOrders.length,
    demoOrders,
    specsCount: SEED_ORDER_SPECS.length,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shop = session.shop || "";
  // Safety guard: reject if somehow executed against a live custom domain in production
  if (process.env.NODE_ENV === "production" && !shop.includes("myshopify.com")) {
    return {
      success: false,
      message: "Safety Block: Dev seed scripts cannot be executed on custom production domains.",
    };
  }

  if (intent === "seed") {
    const createdOrders: Array<{ id: string; name: string; scenario: string }> = [];
    const errors: string[] = [];

    for (const spec of SEED_ORDER_SPECS) {
      try {
        // Calculate subtotal
        const subtotal = spec.lineItems.reduce(
          (sum, item) => sum + parseFloat(item.price) * item.quantity,
          0,
        );
        const total = (subtotal + parseFloat(spec.shippingPrice)).toFixed(2);

        const orderMutation = `#graphql
          mutation OrderCreate($order: OrderCreateOrderInput!) {
            orderCreate(order: $order) {
              order {
                id
                name
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const variables = {
          order: {
            note: spec.note || undefined,
            tags: [DEMO_TAG, "dev-seed"],
            financialStatus: "PAID",
            shippingAddress: {
              name: spec.shippingAddress.name,
              address1: spec.shippingAddress.address1,
              city: spec.shippingAddress.city,
              province: spec.shippingAddress.province || undefined,
              zip: spec.shippingAddress.zip,
              country: spec.shippingAddress.country,
              phone: spec.shippingAddress.phone || undefined,
            },
            shippingLines: [
              {
                title: spec.shippingTitle,
                price: spec.shippingPrice,
              },
            ],
            lineItems: spec.lineItems.map((item) => ({
              title: item.title,
              quantity: item.quantity,
              price: item.price,
              sku: item.sku,
              requiresShipping: item.requiresShipping ?? true,
            })),
            transactions: [
              {
                amount: total,
                kind: "SALE",
                status: "SUCCESS",
              },
            ],
          },
        };

        const res = await admin.graphql(orderMutation, { variables });
        const json: any = await res.json();
        const data = json.data?.orderCreate;

        if (data?.userErrors && data.userErrors.length > 0) {
          const errMsg = data.userErrors.map((e: any) => e.message).join(", ");
          errors.push(`Order "${spec.name}": ${errMsg}`);
          continue;
        }

        const newOrder = data?.order;
        if (newOrder?.id) {
          // If pre-printed (Scenario 8 & 9), set the $app:print_status metafield
          if (spec.isPrePrinted) {
            await setOrdersPrintedStatus(admin, [newOrder.id]);
          }

          createdOrders.push({
            id: newOrder.id,
            name: newOrder.name,
            scenario: spec.scenario,
          });
        }
      } catch (err: any) {
        errors.push(`Order "${spec.name}": ${err?.message || err}`);
      }
    }

    return {
      success: createdOrders.length > 0,
      intent: "seed",
      createdCount: createdOrders.length,
      createdOrders,
      errors,
    };
  }

  if (intent === "cleanup") {
    // 1. Fetch all orders tagged DEMO_TAG
    const findRes = await admin.graphql(
      `#graphql
        query FindDemoOrders {
          orders(first: 100, query: "tag:${DEMO_TAG}") {
            nodes {
              id
              name
            }
          }
        }
      `,
    );

    const findJson: any = await findRes.json();
    const ordersToDelete = findJson.data?.orders?.nodes || [];

    let deletedCount = 0;
    const errors: string[] = [];

    for (const order of ordersToDelete) {
      try {
        const delRes = await admin.graphql(
          `#graphql
            mutation OrderDelete($orderId: ID!) {
              orderDelete(orderId: $orderId) {
                deletedId
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          { variables: { orderId: order.id } },
        );

        const delJson: any = await delRes.json();
        const userErrors = delJson.data?.orderDelete?.userErrors || [];

        if (userErrors.length > 0) {
          // If permanent delete is restricted by store settings, cancel and archive the order
          await admin.graphql(
            `#graphql
              mutation OrderCancel($orderId: ID!) {
                orderCancel(orderId: $orderId, reason: OTHER, restock: false) {
                  job {
                    id
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }
            `,
            { variables: { orderId: order.id } },
          );
        }
        deletedCount++;
      } catch (err: any) {
        errors.push(`Delete ${order.name}: ${err?.message || err}`);
      }
    }

    return {
      success: true,
      intent: "cleanup",
      deletedCount,
      errors,
    };
  }

  return { success: false, message: "Unknown intent" };
};

export default function DevSeedPage() {
  const { shop, demoOrderCount, demoOrders, specsCount } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const rows = demoOrders.map((o: any) => [
    o.name,
    o.createdAt ? new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-",
    o.printStatus?.value === "printed" ? "Printed" : "Ready to Pack",
    o.lineItems?.nodes?.map((l: any) => `${l.quantity}x ${l.title}`).join(", ") || "-",
  ]);

  return (
    <Page
      title="Development Store Order Generator"
      subtitle={`Target Store: ${shop}`}
      backAction={{ content: "App Home", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            <Banner tone="info" title="Screenshots & Demo Video Preparation Tool">
              <p>
                This tool populates your development store with <strong>{specsCount} realistic test orders</strong> covering
                single item, quantity badges, customer gift notes, express delivery, multiple SKUs, 14-item multi-page
                slips, and reprint scenarios.
              </p>
              <Box paddingBlockStart="200">
                <Text as="p" variant="bodySm" tone="subdued">
                  All created orders are automatically tagged with <code>{DEMO_TAG}</code> for safe, one-click cleanup.
                </Text>
              </Box>
            </Banner>

            {actionData?.success && actionData.intent === "seed" && (
              <Banner tone="success" title={`Successfully created ${actionData.createdCount} demo orders!`}>
                <p>You can now navigate back to the main app to take screenshots or record your demo screencast.</p>
                {actionData.errors && actionData.errors.length > 0 && (
                  <Box paddingBlockStart="200">
                    <Text as="p" tone="caution">Warnings/Notice:</Text>
                    <List>
                      {actionData.errors.map((e, idx) => (
                        <List.Item key={idx}>{e}</List.Item>
                      ))}
                    </List>
                  </Box>
                )}
              </Banner>
            )}

            {actionData?.success && actionData.intent === "cleanup" && (
              <Banner tone="success" title={`Cleaned up ${actionData.deletedCount} demo orders`}>
                <p>All orders tagged with {DEMO_TAG} have been deleted/canceled from your development store.</p>
              </Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Order Management Actions
                </Text>
                <Text as="p" tone="subdued">
                  Current demo orders in store: <strong>{demoOrderCount}</strong>
                </Text>

                <InlineStack gap="300">
                  <Form method="post">
                    <input type="hidden" name="intent" value="seed" />
                    <Button
                      variant="primary"
                      submit
                      loading={isSubmitting && navigation.formData?.get("intent") === "seed"}
                      disabled={isSubmitting}
                    >
                      Seed 9 Demo Orders
                    </Button>
                  </Form>

                  <Form method="post">
                    <input type="hidden" name="intent" value="cleanup" />
                    <Button
                      tone="critical"
                      submit
                      loading={isSubmitting && navigation.formData?.get("intent") === "cleanup"}
                      disabled={isSubmitting || demoOrderCount === 0}
                    >
                      Delete All Demo Orders
                    </Button>
                  </Form>

                  <Button url="/app" variant="secondary">
                    Go to Ready to Pack Queue
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            {demoOrderCount > 0 && (
              <Card>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <Text as="h3" variant="headingMd">
                      Seeded Orders in Development Store
                    </Text>
                    <Badge tone="info">{`${demoOrderCount} orders`}</Badge>
                  </InlineStack>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text"]}
                    headings={["Order", "Time", "ThermoSlip Status", "Summary"]}
                    rows={rows}
                  />
                </BlockStack>
              </Card>
            )}

            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingMd">
                  Seeded Scenarios Breakdown
                </Text>
                <Divider />
                <List type="number">
                  {SEED_ORDER_SPECS.map((spec, index) => (
                    <List.Item key={index}>
                      <strong>{spec.name}</strong> — {spec.scenario} ({spec.customer.firstName} {spec.customer.lastName},{" "}
                      {spec.shippingAddress.city}, {spec.shippingAddress.country})
                    </List.Item>
                  ))}
                </List>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
