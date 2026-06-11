import { describe, it, expect, beforeAll } from "vitest";
import { Miniflare } from "miniflare";

let miniflare: Miniflare;

beforeAll(async () => {
  miniflare = new Miniflare({
    modules: true,
    scriptPath: "dist/index.js",
    d1Databases: { DB: "test-db" },
    r2Buckets: { VAULT: "test-vault" },
    kvNamespaces: { KV: "test-kv" },
    bindings: {
      JWT_SECRET: "test-secret-key-for-integration-tests",
      TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA", // test key
      STRIPE_SECRET_KEY: "sk_test_dummy",
      STRIPE_WEBHOOK_SECRET: "whsec_test_dummy",
      MAILCHANNELS_API_KEY: "test-api-key",
      SENTRY_DSN: "",
    },
  });
});

describe("Health endpoint", () => {
  it("GET /health returns ok", async () => {
    const response = await miniflare.dispatchFetch("http://localhost/health");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { status: string };
    expect(body.status).toBe("ok");
  });
});

describe("Auth endpoints", () => {
  it("POST /auth/register creates an account", async () => {
    const response = await miniflare.dispatchFetch("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        authHash: btoa("test-auth-hash"),
        authSalt: btoa("test-auth-salt"),
        encryptionSalt: btoa("test-encryption-salt"),
        wrappedVaultKey: btoa("test-wrapped-key"),
      }),
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      accessToken: string;
      refreshToken: string;
      vaultVersion: number;
    };
    expect(body.accessToken).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.vaultVersion).toBe(1);
  });

  it("POST /auth/login with wrong hash returns 401", async () => {
    const response = await miniflare.dispatchFetch("http://localhost/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        authHash: btoa("wrong-hash"),
      }),
    });

    expect(response.status).toBe(401);
  });

  it("POST /auth/register with duplicate email returns 400", async () => {
    const response = await miniflare.dispatchFetch("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        authHash: btoa("another-hash"),
        authSalt: btoa("another-salt"),
        encryptionSalt: btoa("another-enc-salt"),
        wrappedVaultKey: btoa("another-key"),
      }),
    });

    expect(response.status).toBe(400);
  });
});

describe("Vault endpoints", () => {
  let accessToken: string;

  beforeAll(async () => {
    // Register + login to get a token
    const res = await miniflare.dispatchFetch("http://localhost/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "vault-test@example.com",
        authHash: btoa("vault-auth-hash"),
        authSalt: btoa("vault-auth-salt"),
        encryptionSalt: btoa("vault-enc-salt"),
        wrappedVaultKey: btoa("vault-wrapped-key"),
      }),
    });
    const body = (await res.json()) as { accessToken: string };
    accessToken = body.accessToken;
  });

  it("GET /vault returns vault info", async () => {
    const response = await miniflare.dispatchFetch("http://localhost/vault", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { vaultVersion: number };
    expect(body.vaultVersion).toBe(1);
  });

  it("GET /vault without auth returns 401", async () => {
    const response = await miniflare.dispatchFetch("http://localhost/vault");
    expect(response.status).toBe(401);
  });

  it("GET /vault with invalid token returns 401", async () => {
    const response = await miniflare.dispatchFetch("http://localhost/vault", {
      headers: { Authorization: "Bearer invalid-token" },
    });
    expect(response.status).toBe(401);
  });
});
