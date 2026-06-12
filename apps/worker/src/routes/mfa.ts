import { Hono } from "hono";
import type { Context } from "hono";
import { sign } from "hono/jwt";
import type { Env, Variables } from "../index.js";
import { authMiddleware } from "../middleware/auth.js";
import { AuthError, ValidationError } from "../middleware/error.js";
import { verifyTotp, hexToBytes, toHex } from "@ironlox/crypto";

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

function generateExpires(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

app.post("/mfa/enable", authMiddleware, async (c: AppContext) => {
  const userId = c.get("userId");
  const body = await c.req.json();
  const secret = body.secret as string | undefined;
  const code = body.code as string | undefined;

  if (!secret || !code || typeof code !== "string" || code.length !== 6) {
    throw new ValidationError("Invalid request. Provide secret and 6-digit code.");
  }

  const valid = await verifyTotp(secret, code);
  if (!valid) {
    throw new ValidationError("Invalid TOTP code. Try again.");
  }

  await c.env.DB.prepare("UPDATE users SET mfa_secret = ?, mfa_enabled = 1 WHERE id = ?")
    .bind(secret, userId)
    .run();

  return c.json({ mfaEnabled: true });
});

app.post("/mfa/verify", async (c: AppContext) => {
  const body = await c.req.json();
  const email = body.email as string | undefined;
  const code = body.code as string | undefined;

  if (!email || !code || typeof code !== "string" || code.length !== 6) {
    throw new ValidationError("Invalid request. Provide email and 6-digit code.");
  }

  const user = await c.env.DB.prepare(
    "SELECT id, mfa_secret, mfa_enabled, tier FROM users WHERE email = ? AND deleted_at IS NULL",
  ).bind(email.toLowerCase().trim()).first<{
    id: string; mfa_secret: string | null; mfa_enabled: number; tier: string;
  }>();

  if (!user || !user.mfa_enabled || !user.mfa_secret) {
    throw new AuthError("MFA is not enabled for this account.");
  }

  const valid = await verifyTotp(user.mfa_secret, code);
  if (!valid) {
    throw new AuthError("Invalid verification code.");
  }

  const jti = crypto.randomUUID();
  const accessToken = await sign(
    { sub: user.id, tier: user.tier, jti, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 15 * 60 },
    c.env.JWT_SECRET,
  );

  const refreshToken = crypto.randomUUID();

  await c.env.DB.prepare("INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)")
    .bind(user.id, refreshToken, generateExpires(30 * 24 * 60))
    .run();

  await c.env.DB.prepare(
    "INSERT INTO login_events (user_id, ip_hash, user_agent) VALUES (?, ?, ?)",
  ).bind(user.id, "mfa-verify", "mfa").run();

  return c.json({ accessToken, refreshToken });
});

app.post("/recover", async (c: AppContext) => {
  const body = await c.req.json();
  const email = body.email as string | undefined;
  const recoveryKey = body.recoveryKey as string | undefined;

  if (!email || !recoveryKey || recoveryKey.length < 32) {
    throw new ValidationError("Invalid request. Provide email and recovery key.");
  }

  const user = await c.env.DB.prepare(
    "SELECT id, recovery_key_hash, recovery_key_salt, wrapped_vault_key, encryption_salt, vault_version, tier FROM users WHERE email = ? AND deleted_at IS NULL",
  ).bind(email.toLowerCase().trim()).first<{
    id: string; recovery_key_hash: string | null; recovery_key_salt: string | null;
    wrapped_vault_key: string; encryption_salt: string; vault_version: number; tier: string;
  }>();

  if (!user || !user.recovery_key_hash || !user.recovery_key_salt) {
    throw new AuthError("No recovery key set for this account.");
  }

  const encoder = new TextEncoder();
  const saltBytes = hexToBytes(user.recovery_key_salt);
  const combined = new Uint8Array(saltBytes.length + encoder.encode(recoveryKey).length);
  combined.set(saltBytes, 0);
  combined.set(encoder.encode(recoveryKey), saltBytes.length);
  const hash = await crypto.subtle.digest("SHA-256", combined);
  const hashHex = toHex(new Uint8Array(hash));

  if (hashHex !== user.recovery_key_hash) {
    throw new AuthError("Invalid recovery key.");
  }

  const jti = crypto.randomUUID();
  const accessToken = await sign(
    { sub: user.id, tier: user.tier, jti, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 15 * 60 },
    c.env.JWT_SECRET,
  );

  const refreshToken = crypto.randomUUID();

  await c.env.DB.prepare("INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)")
    .bind(user.id, refreshToken, generateExpires(30 * 24 * 60))
    .run();

  await c.env.DB.prepare(
    "INSERT INTO login_events (user_id, ip_hash, user_agent) VALUES (?, ?, ?)",
  ).bind(user.id, "recovery-key", "recovery").run();

  return c.json({
    accessToken,
    refreshToken,
    wrappedVaultKey: user.wrapped_vault_key,
    encryptionSalt: user.encryption_salt,
    vaultVersion: user.vault_version,
    vaultUrl: undefined,
  });
});

export const mfaRoutes = app;
