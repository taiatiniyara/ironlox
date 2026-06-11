import { Hono } from "hono";
import type { Env, Variables } from "../index.js";
import { authMiddleware, optionalAuthMiddleware } from "../middleware/auth.js";
import { AuthError, ValidationError } from "../middleware/error.js";
import { ChangePasswordRequestSchema } from "@ironlox/schemas";

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

  // Get last 20 login events
  const loginEvents = await c.env.DB.prepare(
    "SELECT timestamp, ip_hash, user_agent, city_country FROM login_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
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
 * Initiate account deletion (7-day grace period).
 */
app.delete("/", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;
  const deletedAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await c.env.DB.prepare(
    "UPDATE users SET deleted_at = ? WHERE id = ?",
  )
    .bind(deletedAt, userId)
    .run();

  return c.json({ message: "Account deletion initiated. Data will be permanently deleted in 7 days." });
});

/**
 * POST /account/undelete
 * Cancel account deletion during grace period.
 */
app.post("/undelete", optionalAuthMiddleware, async (c) => {
  // This endpoint needs the user ID from an optional token or email
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
 * Change master password: re-wrap vault key without re-encrypting vault contents.
 */
app.put("/password", authMiddleware, async (c) => {
  const userId = c.get("userId") as string;

  const body = await c.req.json();
  const parsed = ChangePasswordRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid password change data");
  }

  const { newEncryptionSalt, newWrappedVaultKey, newAuthHash, newAuthSalt } = parsed.data;

  await c.env.DB.prepare(
    "UPDATE users SET auth_hash = ?, auth_salt = ?, encryption_salt = ?, wrapped_vault_key = ?, updated_at = ? WHERE id = ?",
  )
    .bind(newAuthHash, newAuthSalt, newEncryptionSalt, newWrappedVaultKey, new Date().toISOString(), userId)
    .run();

  // Invalidate all refresh tokens for this user (force re-login on other devices)
  await c.env.DB.prepare("DELETE FROM refresh_tokens WHERE user_id = ?")
    .bind(userId)
    .run();

  return c.json({ message: "Password changed successfully" });
});

export const accountRoutes = app;
