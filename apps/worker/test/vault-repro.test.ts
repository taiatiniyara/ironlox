import { describe, it, expect } from "vitest";
import { createApp } from "./helpers.js";
import { authRoutes } from "../src/routes/auth.js";
import { vaultRoutes } from "../src/routes/vault.js";

function createMockD1() {
  const users = new Map<string, { email: string; auth_hash: string; auth_salt: string; encryption_salt: string; wrapped_vault_key: string; vault_version: number; tier: string; mfa_enabled: number }>();
  const refreshTokens = new Map<string, { user_id: string; token: string; expires_at: string }>();
  const loginEvents: Array<{ user_id: string; ip_hash: string; user_agent: string; created_at: string }> = [];

  return {
    users,
    refreshTokens,
    loginEvents,
    prepare(sql: string) {
      return {
        bind(...args: string[]) {
          return {
            async first<T>(): Promise<T | null> {
              if (sql.includes("SELECT vault_version FROM users")) {
                const user = users.get(args[0]!);
                return user ? { vault_version: user.vault_version } as unknown as T : null;
              }
              if (sql.includes("SELECT id FROM users WHERE email")) {
                for (const [id, u] of users) {
                  if (u.email === args[0]) return { id } as unknown as T;
                }
                return null;
              }
              if (sql.includes("SELECT id, auth_hash, auth_salt, encryption_salt, wrapped_vault_key, vault_version, tier, mfa_enabled FROM users WHERE email")) {
                for (const [id, u] of users) {
                  if (u.email === args[0]) return { id, auth_hash: u.auth_hash, auth_salt: u.auth_salt, encryption_salt: u.encryption_salt, wrapped_vault_key: u.wrapped_vault_key, vault_version: u.vault_version, tier: u.tier, mfa_enabled: u.mfa_enabled } as unknown as T;
                }
                return null;
              }
              if (sql.includes("SELECT user_id, expires_at FROM refresh_tokens")) {
                const rt = refreshTokens.get(args[0]!);
                return rt ? { user_id: rt.user_id, expires_at: rt.expires_at } as unknown as T : null;
              }
              if (sql.includes("SELECT tier FROM users WHERE id")) {
                const user = users.get(args[0]!);
                return user ? { tier: user.tier } as unknown as T : null;
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO users")) {
                const [id, email, auth_hash, auth_salt, encryption_salt, wrapped_vault_key, , ,] = args;
                users.set(id!, { email: email!, auth_hash: auth_hash!, auth_salt: auth_salt!, encryption_salt: encryption_salt!, wrapped_vault_key: wrapped_vault_key!, vault_version: 1, tier: "free", mfa_enabled: 0 });
              }
              if (sql.includes("INSERT INTO refresh_tokens")) {
                const [user_id, token, expires_at] = args;
                refreshTokens.set(token!, { user_id: user_id!, token: token!, expires_at: expires_at! });
              }
              if (sql.includes("DELETE FROM refresh_tokens")) {
                refreshTokens.delete(args[0]!);
              }
              if (sql.includes("UPDATE users SET vault_version")) {
                const [newVersion, , userId, oldVersion] = args;
                const user = users.get(userId!);
                if (user && user.vault_version === Number(oldVersion)) {
                  user.vault_version = Number(newVersion);
                }
              }
              return {};
            },
            all() { return Promise.resolve({ results: [] }); },
          };
        },
      };
    },
    batch(stmts: Array<ReturnType<ReturnType<typeof this.prepare>["bind"]>>) {
      return Promise.all(stmts.map((s) => s.run()));
    },
  };
}

function createMockKV() {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    async get(key: string) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt > 0 && Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key: string, value: string, opts?: { expirationTtl?: number }) {
      const expiresAt = opts?.expirationTtl ? Date.now() + opts.expirationTtl * 1000 : 0;
      store.set(key, { value, expiresAt });
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}

function createMockR2() {
  const objects = new Map<string, { data: string; size: number; uploaded: Date; customMetadata: Record<string, string> }>();
  return {
    async put(key: string, value: string, opts?: { customMetadata: Record<string, string> }) {
      objects.set(key, { data: value, size: value.length, uploaded: new Date(), customMetadata: opts?.customMetadata ?? {} });
    },
    async get(key: string) {
      const obj = objects.get(key);
      if (!obj) return null;
      return {
        data: obj.data,
        size: obj.size,
        uploaded: obj.uploaded,
        text: () => Promise.resolve(obj.data),
        arrayBuffer: () => Promise.resolve(new TextEncoder().encode(obj.data).buffer),
        customMetadata: obj.customMetadata,
      };
    },
    async delete(key: string) {
      objects.delete(key);
    },
    async list() {
      return { objects: Array.from(objects.entries()).map(([key, obj]) => ({ key, size: obj.size, uploaded: obj.uploaded })) };
    },
  };
}

function buildApp() {
  const mockD1 = createMockD1();
  const mockKV = createMockKV();
  const mockR2 = createMockR2();

  const testEnv = {
    DB: mockD1,
    VAULT: mockR2,
    KV: mockKV,
    JWT_SECRET: "test-jwt-secret-32-chars-minimum!!",
    TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
    STRIPE_SECRET_KEY: "sk_test_test",
    STRIPE_WEBHOOK_SECRET: "whsec_test",
    MAILCHANNELS_API_KEY: "test-key",
    SENTRY_DSN: "",
    CORS_ORIGINS: "http://localhost:3000",
  };

  const app = createApp(testEnv);
  app.route("/auth", authRoutes);
  app.route("/vault", vaultRoutes);

  async function request(path: string, init?: RequestInit) {
    return app.request(path, init, testEnv);
  }

  return { request, env: testEnv };
}

describe("Vault PUT — reproduce 500 error", () => {
  it("PUT /vault with version 1 succeeds (returns 200)", async () => {
    const { request } = buildApp();

    const b64 = (s: string) => Buffer.from(s).toString("base64");

    const regRes = await request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@ironlox-test.com",
        authHash: b64("x".repeat(64)),
        authSalt: b64("y".repeat(16)),
        encryptionSalt: b64("z".repeat(16)),
        wrappedVaultKey: b64("w".repeat(32)),
      }),
    });

    expect(regRes.status).toBe(200);
    const regBody = (await regRes.json()) as { accessToken: string };
    const token = regBody.accessToken;
    expect(token).toBeTruthy();

    const res = await request("/vault", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ version: 1, vaultBlob: "dGVzdHZhdWx0YmxvYg==" }),
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(2);
  });

  it("PUT /vault with stale version returns 409", async () => {
    const { request } = buildApp();

    const b64 = (s: string) => Buffer.from(s).toString("base64");

    const regRes = await request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "conflict@test.com",
        authHash: b64("x".repeat(64)),
        authSalt: b64("y".repeat(16)),
        encryptionSalt: b64("z".repeat(16)),
        wrappedVaultKey: b64("w".repeat(32)),
      }),
    });
    expect(regRes.status).toBe(200);
    const token = ((await regRes.json()) as { accessToken: string }).accessToken;

    const res = await request("/vault", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ version: 99, vaultBlob: "dGVzdA==" }),
    });

    expect(res.status).toBe(409);
  });

  it("sequential PUTs work (no KV lock conflicts)", async () => {
    const { request } = buildApp();

    const b64 = (s: string) => Buffer.from(s).toString("base64");

    const regRes = await request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "seq@test.com",
        authHash: b64("x".repeat(64)),
        authSalt: b64("y".repeat(16)),
        encryptionSalt: b64("z".repeat(16)),
        wrappedVaultKey: b64("w".repeat(32)),
      }),
    });
    expect(regRes.status).toBe(200);
    const token = ((await regRes.json()) as { accessToken: string }).accessToken;

    let res = await request("/vault", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ version: 1, vaultBlob: "c2VxMQ==" }),
    });
    expect(res.status).toBe(200);

    res = await request("/vault", {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ version: 2, vaultBlob: "c2VxMg==" }),
    });
    expect(res.status).toBe(200);
  });
});
