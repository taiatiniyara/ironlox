import { Hono } from "hono";
import type { Context } from "hono";
import { sign } from "hono/jwt";
import type { Env, Variables } from "../index.js";
import { RegisterRequestSchema, LoginRequestSchema } from "@ironlox/schemas";
import { AuthError, ValidationError, RateLimitError } from "../middleware/error.js";
import { verifyTurnstile } from "../middleware/rate-limit.js";
import { sendEmail, getVerificationEmail, getLoginAlertEmail } from "../services/email.js";

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

function htmlEncode(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function generateVerificationCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => (b % 10).toString()).join("").slice(0, 6).padStart(6, "0");
}

/**
 * POST /auth/register
 * Create a new account.
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

  const serverAuthHash = await hashAuthForStorage(authHash, c.env.JWT_SECRET);

  await c.env.DB.batch([
    c.env.DB.prepare(
      "INSERT INTO users (id, email, auth_hash, auth_salt, encryption_salt, wrapped_vault_key, tier, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'free', ?, ?)",
    ).bind(userId, email, serverAuthHash, authSalt, encryptionSalt, wrappedVaultKey, now, now),
  ]);

  const vaultBlob = JSON.stringify({ version: 1, items: [] });
  await c.env.VAULT.put(`${userId}/vault`, vaultBlob);

  const code = generateVerificationCode();
  await c.env.KV.put(`verify:${userId}`, code, { expirationTtl: 600 });

  const { subject, htmlBody, textBody } = getVerificationEmail(email, code);
  await sendEmail(c.env, { to: email, subject, htmlBody, textBody });

  const jti = crypto.randomUUID();
  const accessToken = await signJwt(c.env, userId, "free", jti);
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
 * Verify auth hash and return tokens.
 */
app.post("/login", async (c) => {
  const body = await c.req.json();
  const parsed = LoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid login data");
  }

  const { email, authHash } = parsed.data;
  const turnstileToken = (body as Record<string, unknown>).turnstileToken as string | undefined;

  const user = await c.env.DB.prepare(
      "SELECT id, auth_hash, auth_salt, encryption_salt, wrapped_vault_key, vault_version, tier FROM users WHERE email = ? AND deleted_at IS NULL",
  )
    .bind(email)
    .first<{
      id: string;
      auth_hash: string;
      auth_salt: string;
      encryption_salt: string;
      wrapped_vault_key: string;
      vault_version: number;
      tier: string;
    }>();

  if (!user) {
    throw new AuthError("Invalid email or password");
  }

  const serverAuthHash = await hashAuthForStorage(authHash, c.env.JWT_SECRET);
  if (user.auth_hash !== serverAuthHash) {
    const exceeded = await checkRateLimit(c, email);
    if (exceeded) {
      if (!turnstileToken) {
        throw new RateLimitError("Too many login attempts. Please solve the CAPTCHA.");
      }
      const turnstileValid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY);
      if (!turnstileValid) {
        throw new RateLimitError("CAPTCHA verification failed.");
      }
    }
    throw new AuthError("Invalid email or password");
  }

  const jti = crypto.randomUUID();
  const accessToken = await signJwt(c.env, user.id, user.tier, jti);
  const refreshToken = crypto.randomUUID();

  await c.env.DB.prepare(
    "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
  )
    .bind(user.id, refreshToken, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString())
    .run();

  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  const ipHash = await hashIp(ip);
  const userAgent = (c.req.header("User-Agent") ?? "unknown").slice(0, 500);
  const country = (c.req.header("CF-IPCountry") ?? "unknown").slice(0, 10);

  await c.env.DB.prepare(
    "INSERT INTO login_events (user_id, ip_hash, user_agent, city_country, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(user.id, ipHash, userAgent, country, new Date().toISOString())
    .run();

  const previousIps = await c.env.DB.prepare(
    "SELECT DISTINCT ip_hash FROM login_events WHERE user_id = ? AND ip_hash != ? LIMIT 1",
  )
    .bind(user.id, ipHash)
    .first();

  if (!previousIps) {
    const { subject, htmlBody, textBody } = getLoginAlertEmail(email, {
      ipCountry: htmlEncode(country),
      userAgent: htmlEncode(userAgent),
      timestamp: new Date().toISOString(),
    });
    await sendEmail(c.env, { to: email, subject, htmlBody, textBody });
  }

  return c.json({
    accessToken,
    refreshToken,
    vaultVersion: user.vault_version,
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

  const user = await c.env.DB.prepare("SELECT tier FROM users WHERE id = ? AND deleted_at IS NULL")
    .bind(stored.user_id)
    .first<{ tier: string }>();

  if (!user) {
    throw new AuthError("User not found");
  }

  const newRefreshToken = crypto.randomUUID();

  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM refresh_tokens WHERE token = ?").bind(refreshToken),
    c.env.DB.prepare(
      "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
    ).bind(
      stored.user_id,
      newRefreshToken,
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    ),
  ]);

  const jti = crypto.randomUUID();
  const accessToken = await signJwt(c.env, stored.user_id, user.tier, jti);

  return c.json({ accessToken, refreshToken: newRefreshToken });
});

/**
 * POST /auth/revoke
 * Revoke all refresh tokens for the authenticated user.
 */
app.post("/revoke", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing authorization header");
  }

  const token = authHeader.slice(7);
  const { decode } = await import("hono/jwt");
  let userId: string | undefined;
  try {
    const decoded = decode(token);
    userId = decoded.payload.sub as string | undefined;
  } catch {
    throw new AuthError("Invalid token");
  }

  if (!userId) {
    throw new AuthError("Invalid token");
  }

  await c.env.DB.prepare("DELETE FROM refresh_tokens WHERE user_id = ?")
    .bind(userId)
    .run();

  return c.json({ message: "Tokens revoked" });
});

async function signJwt(env: Env, userId: string, tier: string, jti: string): Promise<string> {
  return sign(
    {
      sub: userId,
      tier,
      jti,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 15 * 60,
    },
    env.JWT_SECRET,
  );
}

async function checkRateLimit(c: AppContext, email: string): Promise<boolean> {
  const key = `rate:login:${email}`;
  const count = await c.env.KV.get(key);
  const attempts = count ? parseInt(count) : 0;

  if (attempts >= 3) {
    return true;
  }

  await c.env.KV.put(key, String(attempts + 1), { expirationTtl: 900 });
  return false;
}

async function hashIp(ip: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashAuthForStorage(authHash: string, pepper: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(authHash));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const authRoutes = app;
