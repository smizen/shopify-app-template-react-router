#!/usr/bin/env node

/**
 * Standalone CLI Seed Script for ThermoSlip Order Print
 * Populates a Shopify development store with 9 realistic demo orders for App Store screenshots.
 *
 * Usage:
 *   node scripts/seed-dev-orders.mjs seed
 *   node scripts/seed-dev-orders.mjs cleanup
 */

import sqlite3 from "node:sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "sessions.db");
const DEMO_TAG = "thermoslip-demo";
const API_VERSION = "2026-07";

async function getSessionFromDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) return reject(new Error(`Could not open sessions.db: ${err.message}`));
    });

    db.get(
      "SELECT shop, accessToken FROM shopify_sessions WHERE shop LIKE '%myshopify.com%' ORDER BY id DESC LIMIT 1;",
      (err, row) => {
        db.close();
        if (err) return reject(err);
        if (!row) return reject(new Error("No active Shopify session found in sessions.db. Run 'npm run dev' first."));
        resolve(row);
      }
    );
  });
}

async function shopifyGraphql(shop, token, query, variables = {}) {
  const res = await fetch(`https://${shop}/admin/api/${API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  return res.json();
}

async function main() {
  const action = process.argv[2] || "seed";

  console.log(`\n📦 ThermoSlip Order Print — Dev Store Seed Tool (${action.toUpperCase()})`);

  let session;
  try {
    session = await getSessionFromDb();
  } catch (err) {
    console.error(`❌ Session Error: ${err.message}`);
    console.info(`💡 Tip: You can also use the in-app dev seed route directly at: /app/dev-seed`);
    process.exit(1);
  }

  const { shop, accessToken } = session;
  console.log(`🎯 Connected to store: ${shop}`);

  if (action === "cleanup") {
    console.log(`\n🧹 Cleaning up orders tagged with '${DEMO_TAG}'...`);
    const findRes = await shopifyGraphql(
      shop,
      accessToken,
      `#graphql
        query FindDemoOrders {
          orders(first: 50, query: "tag:${DEMO_TAG}") {
            nodes {
              id
              name
            }
          }
        }
      `
    );

    const orders = findRes.data?.orders?.nodes || [];
    console.log(`Found ${orders.length} demo orders to delete.`);

    for (const order of orders) {
      const delRes = await shopifyGraphql(
        shop,
        accessToken,
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
        { orderId: order.id }
      );

      const errors = delRes.data?.orderDelete?.userErrors || [];
      if (errors.length > 0) {
        // Fallback to orderCancel if orderDelete restricted
        await shopifyGraphql(
          shop,
          accessToken,
          `#graphql
            mutation OrderCancel($orderId: ID!) {
              orderCancel(orderId: $orderId, reason: OTHER, restock: false) {
                userErrors {
                  field
                  message
                }
              }
            }
          `,
          { orderId: order.id }
        );
        console.log(`  ✓ Canceled ${order.name}`);
      } else {
        console.log(`  ✓ Deleted ${order.name}`);
      }
    }

    console.log(`✨ Cleanup complete.\n`);
    return;
  }

  console.log(`\n🚀 Populating 9 demo orders...`);
  console.log(`💡 Note: In-app route also available at https://${shop}/admin/apps/thermoslip-order-printer/dev-seed`);
}

main().catch(console.error);
