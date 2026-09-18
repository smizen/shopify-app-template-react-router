import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { SQLiteSessionStorage } from "@shopify/shopify-app-session-storage-sqlite";
import path from "node:path";

// SQLite path: /data/sessions.db in production (Fly.io volume), local in dev
const dbPath =
  process.env.NODE_ENV === "production"
    ? "/data/sessions.db"
    : path.join(process.cwd(), "sessions.db");

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  // Architecture §2 — API version 2026-07; update each stable quarterly release
  apiVersion: ApiVersion.July25,
  scopes: ["write_orders"],
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new SQLiteSessionStorage(dbPath) as any,
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.July25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
