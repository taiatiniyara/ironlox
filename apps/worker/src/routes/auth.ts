import { Hono } from "hono";
import type { Context } from "hono";
import { sign } from "hono/jwt";
import type { Env, Variables } from "../index.js";
import { RegisterRequestSchema, LoginRequestSchema } from "@ironlox/schemas";
import { AuthError, ValidationError, RateLimitError } from "../middleware/error.js";

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * POST /auth/register
 * Create a new account. Stores auth hash, wrapped vault key, and salts in D1.
 * Initializes an empty vault blob in R2.
 */
app.post("/register", async (c) => {
  const body = await c.req.json();
  const parsed = RegisterRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid registration data");
  }

  const { email, authHash, authSalt, encryptionSalt, wrappedVaultKey } = parsed.data;

  const existing = await c.env.DB.prepare(
    "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL",
  )
    .bind(email)
    .first();

  if (existing) {
    throw new ValidationError("Email already registered");
  }

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO users (id, email, auth_hash, auth_salt, encryption_salt, wrapped_vault_key, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'free', ?, ?)",
    ).bind(userId, email, authHash, authSalt, encryptionSalt, wrappedVaultKey, now, now),
  ]);

  // Create empty vault blob in R2
  const vaultBlob = JSON.stringify({ version: 1, items: [] });
  await c.env.VAULT.put(`${userId}/vault`, vaultBlob);

  const accessToken = await signJwt(c.env, userId, "free");
  const refreshToken = crypto.randomUUID();

  await c.env.DB.prepare(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
  )
    .bind(userId, refreshToken, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
    .run();

  return c.json({
    accessToken,
    refreshToken,
    vaultVersion: 1,
    wrappedVaultKey,
    encryptionSalt,
  });
});

/**
 * POST /auth/login
 * Verify auth hash (Argon2id of email + master password).
 * Returns JWT + refresh token + vault info.
 */
app.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid login data");
  }

  const { email, authHash } = parsed.data;

  const user = await c.env.DB.prepare(
    "SELECT id, auth_hash, auth_salt, encryption_salt, wrapped_vault_key, tier FROM users WHERE email = ? AND deleted_at IS NULL",
  )
    .bind(email)
    .first<{
      id: string;
      auth_hash: string;
      auth_salt: string;
      encryption_salt: string;
      wrapped_vault_key: string;
      tier: string;
    }>();

  if (!user) {
    throw new AuthError("Invalid email or password");
  }

  // Note: We compare the pre-computed Argon2id hash sent by client
  // The client runs Argon2id locally and sends the resulting hash
  if (user.auth_hash !== authHash) {
    // Rate limit check
    await checkRateLimit(c, email);
    throw new AuthError("Invalid email or password");
  }

  const accessToken = await signJwt(c.env, user.id, user.tier);
  const refreshToken = crypto.randomUUID();

  await c.env.DB.prepare(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
  )
    .bind(user.id, refreshToken, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
    .run();

  // Log login event
  const ipHash = await hashIp(c.req.header("CF-Connecting-IP") ?? "unknown");
  await c.env.DB.prepare(
    "INSERT INTO login_events (user_id, ip_hash, user_agent, city_country, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(
      user.id,
      ipHash,
      c.req.header("User-Agent") ?? "unknown",
      c.req.header("CF-IPCountry") ?? "unknown",
      new Date().toISOString(),
    )
    .run();

  return c.json({
    accessToken,
    refreshToken,
    vaultVersion: 1, // TODO: track actual version
    wrappedVaultKey: user.wrapped_vault_key,
    encryptionSalt: user.encryption_salt,
  });
});

/**
 * POST /auth/refresh
 * Rotate refresh token. Returns new access + refresh tokens.
 */
app.post("/refresh", async (c) => {
  const body = await c.req.json();
  const refreshToken = body.refreshToken;

  if (!refreshToken) {
    throw new AuthError("Missing refresh token");
  }

  const stored = await c.env.DB.prepare(
    "SELECT user_id, expires_at FROM refresh_tokens WHERE token = ?",
  )
    .bind(refreshToken)
    .first<{ user_id: string; expires_at: string }>();

  if (!stored || new Date(stored.expires_at) < new Date()) {
    throw new AuthError("Invalid or expired refresh token");
  }

  const user = await c.env.DB.prepare("SELECT tier FROM users WHERE id = ?")
    .bind(stored.user_id)
    .first<{ tier: string }>();

  if (!user) {
    throw new AuthError("User not found");
  }

  // Rotate: delete old, create new
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM refresh_tokens WHERE token = ?").bind(refreshToken),
    c.env.DB.prepare(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
    ).bind(
      stored.user_id,
      crypto.randomUUID(),
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ),
  ]);

  const newRefreshToken = crypto.randomUUID();
  const accessToken = await signJwt(c.env, stored.user_id, user.tier);

  return c.json({ accessToken, refreshToken: newRefreshToken });
});

async function signJwt(env: Env, userId: string, tier: string): Promise<string> {
  return sign(
    {
      sub: userId,
      tier,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
    },
    env.JWT_SECRET,
  );
}

async function checkRateLimit(c: AppContext, email: string): Promise<void> {
  const key = `rate:login:${email}`;
  const count = await c.env.KV.get(key);
  const attempts = count ? parseInt(count) : 0;

  if (attempts >= 3) {
    throw new RateLimitError("Too many login attempts. Please solve the CAPTCHA.");
  }

  await c.env.KV.put(key, String(attempts + 1), { expirationTtl: 900 }); // 15 min window
}

async function hashIp(ip: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const authRoutes = app;
