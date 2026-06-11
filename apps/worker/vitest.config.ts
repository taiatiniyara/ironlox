import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "miniflare",
    environmentOptions: {
      modules: true,
      d1Databases: ["DB"],
      r2Buckets: ["VAULT"],
      kvNamespaces: ["KV"],
      bindings: {
        JWT_SECRET: "test-jwt-secret-for-integration-tests",
        TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
        STRIPE_SECRET_KEY: "sk_test_test",
        STRIPE_WEBHOOK_SECRET: "whsec_test",
        MAILCHANNELS_API_KEY: "test-mailchannels-key",
        SENTRY_DSN: "",
      },
    },
  },
});
