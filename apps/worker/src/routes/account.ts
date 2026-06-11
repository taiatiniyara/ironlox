import { Hono } from "hono";
import type { Env, Variables } from "../index.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.js";
import { AuthError, ValidationError } from "../middleware/error.js";
import { ChangePasswordRequestSchema, ChangeEmailRequestSchema } from "@ironlox/schemas";
import { hashAuthForStorage } from "../routes/auth.js";
import { constantTimeEqual } from "@ironlox/crypto";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * GET /account
 * Returns account info, tier, quota, and login history.
 */
app.get("/", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;

  const user = await c.env.DB.prepare(
    "SELECT id, email, tier, vault_version, attachment_used, created_at FROM users WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(userId)
    .first<{
      id: string;
      email: string;
      tier: string;
      vault_version: number;
      attachment_used: number;
      created_at: string;
    }>();

  if (!user) {
    throw new AuthError("User not found");
  }

  const quota = user.tier === "premium" ? 2 * 1024 * 1024 * 1024 : 250 * 1024 * 1024;

  const loginEvents = await c.env.DB.prepare(
    "SELECT created_at as timestamp, ip_hash, user_agent, city_country FROM login_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
  )
    .bind(userId)
    .all<{
      timestamp: string;
      ip_hash: string;
      user_agent: string;
      city_country: string;
    }>();

  return c.json({
    email: user.email,
    tier: user.tier,
    vaultVersion: user.vault_version,
    attachmentQuota: quota,
    attachmentUsed: user.attachment_used,
    createdAt: user.created_at,
    loginEvents: loginEvents.results,
  });
});

/**
 * DELETE /account
 * Initiate account deletion (7-day grace period). Invalidates all active tokens.
 */
app.delete("/", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const deletedAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE users SET deleted_at = ? WHERE id = ?").bind(deletedAt, userId),
    c.env.DB.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").bind(userId),
  ]);

  return c.json({ message: "Account deletion initiated. Data will be permanently deleted in 7 days." });
});

/**
 * POST /account/undelete
 * Cancel account deletion during grace period.
 */
app.post("/undelete", optionalAuthMiddleware, async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    throw new AuthError("Authentication required to cancel deletion");
  }

  await c.env.DB.prepare(
    "UPDATE users SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL",
  )
    .bind(userId)
    .run();

  return c.json({ message: "Account deletion cancelled." });
});

/**
 * PUT /account/password
 * Change master password. Verifies current password via auth hash.
 * Requires old auth hash to prevent account takeover with stolen JWT.
 */
app.put("/password", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;

  const body = await c.req.json();
  const parsed = ChangePasswordRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid password change data");
  }

  const { newEncryptionSalt, newWrappedVaultKey, newAuthHash, newAuthSalt } = parsed.data;

  // For password change, we need the current auth hash too. The client should send this.
  // We verify they know the current password by having them include the current authHash in addition.
  // Accept it from the body (added to schema would be ideal, but for now we use an additional field).
  const currentAuthHash = (body as Record<string, unknown>).currentAuthHash as string | undefined;
  if (!currentAuthHash) {
    throw new ValidationError("Current auth hash required to change password");
  }

  const user = await c.env.DB.prepare(
    "SELECT auth_hash FROM users WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(userId)
    .first<{ auth_hash: string }>();

  if (!user) {
    throw new AuthError("User not found");
  }

  const serverCurrentHash = await hashAuthForStorage(currentAuthHash, c.env.JWT_SECRET);
  if (user.auth_hash !== serverCurrentHash) {
    throw new AuthError("Invalid current password");
  }

  const serverAuthHash = await hashAuthForStorage(newAuthHash, c.env.JWT_SECRET);

  await c.env.DB.prepare(
    "UPDATE users SET auth_hash = ?, auth_salt = ?, encryption_salt = ?, wrapped_vault_key = ?, updated_at = ? WHERE id = ?",
  )
    .bind(serverAuthHash, newAuthSalt, newEncryptionSalt, newWrappedVaultKey, new Date().toISOString(), userId)
    .run();

  await c.env.DB.prepare("DELETE FROM refresh_tokens WHERE user_id = ?")
    .bind(userId)
    .run();

  return c.json({ message: "Password changed successfully" });
});

/**
 * POST /account/email
 * Change account email address with OTP verification.
 */
app.post("/email", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;

  const body = await c.req.json();
  const parsed = ChangeEmailRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid email change data");
  }

  const { newEmail, otp } = parsed.data;

  const existing = await c.env.DB.prepare(
    "SELECT id FROM users WHERE email = ? AND deleted_at IS NULL",
  )
    .bind(newEmail)
    .first();

  if (existing) {
    throw new ValidationError("Email already in use");
  }

  const otpKey = `email-change:otp:${userId}`;
  const otpTimestamp = await c.env.KV.get(`${otpKey}:ts`);
  const storedOtp = await c.env.KV.get(otpKey);

  if (otpTimestamp) {
    const age = Date.now() - parseInt(otpTimestamp);
    if (age > 10 * 60 * 1000) {
      await c.env.KV.delete(otpKey);
      await c.env.KV.delete(`${otpKey}:ts`);
      throw new ValidationError("OTP has expired");
    }
  }

  if (!storedOtp || !constantTimeEqual(otp, storedOtp)) {
    throw new ValidationError("Invalid or expired OTP");
  }

  await c.env.DB.prepare(
    "UPDATE users SET email = ?, updated_at = ? WHERE id = ?",
  )
    .bind(newEmail, new Date().toISOString(), userId)
    .run();

  await c.env.KV.delete(otpKey);
  await c.env.KV.delete(`${otpKey}:ts`);

  return c.json({ message: "Email changed successfully" });
});

export const accountRoutes = app;
