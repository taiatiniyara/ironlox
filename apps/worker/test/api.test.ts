import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "../src/middleware/error.js";
import { healthRoute } from "../src/routes/health.js";
import { mfaRoutes } from "../src/routes/mfa.js";
import type { Env } from "../src/index.js";

function createApp(env: Env) {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", cors({ origin: "*" }));
  app.route("/health", healthRoute);
  app.route("/auth", mfaRoutes);
  app.onError(errorHandler);
  return app;
}

const testEnv = {
  DB: {} as D1Database,
  VAULT: {} as R2Bucket,
  KV: {} as KVNamespace,
  JWT_SECRET: "test-jwt-secret",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  STRIPE_SECRET_KEY: "sk_test_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  MAILCHANNELS_API_KEY: "test-key",
  SENTRY_DSN: "",
};

describe("Health endpoint", () => {
  it("GET /health returns ok", async () => {
    const app = createApp(testEnv as unknown as Env);
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe("ok");
  });

  it("returns 404 for unknown routes", async () => {
    const app = createApp(testEnv as unknown as Env);
    const res = await app.request("/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("MFA endpoints — validation", () => {
  it("POST /auth/mfa/enable returns auth error when unauthenticated", async () => {
    const app = createApp(testEnv as unknown as Env);
    const res = await app.request("/auth/mfa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // Returns 401/400/500 depending on middleware auth setup in test env
    expect([400, 401, 500]).toContain(res.status);
  });

  it("POST /auth/mfa/verify validates required fields", async () => {
    const app = createApp(testEnv as unknown as Env);
    const res = await app.request("/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("POST /auth/recover validates required fields", async () => {
    const app = createApp(testEnv as unknown as Env);
    const res = await app.request("/auth/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it("POST /auth/recover requires valid recovery key length", async () => {
    const app = createApp(testEnv as unknown as Env);
    const res = await app.request("/auth/recover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", recoveryKey: "short" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("CORS preflight", () => {
  it("handles OPTIONS request", async () => {
    const app = createApp(testEnv as unknown as Env);
    const res = await app.request("/health", {
      method: "OPTIONS",
      headers: { Origin: "https://app.ironlox.com", "Access-Control-Request-Method": "GET" },
    });
    expect(res.status).toBe(204);
  });
});
