import { Hono } from "hono";
import type { Context } from "hono";
import { sign } from "hono/jwt";
import type { Env, Variables } from "../index.js";
import {
  AdminLoginRequestSchema,
  AdminUpdateTierRequestSchema,
  AdminFeatureFlagUpdateRequestSchema,
} from "@ironlox/schemas";
import { AuthError, ValidationError } from "../middleware/error.js";
import { adminMiddleware, adminLoginRateLimit, adminRateLimit } from "../middleware/admin.js";

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("/*", adminRateLimit);

// --- Auth ---

async function signAdminJwt(env: Env, jti: string): Promise<string> {
  return sign(
    {
      sub: "admin",
      role: "admin",
      jti,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 30 * 60,
    },
    env.JWT_SECRET,
  );
}

// --- Audit logger ---

async function logAdminAction(
  c: AppContext,
  action: string,
  targetType: string | undefined,
  targetId: string | undefined,
  details: string | undefined,
): Promise<void> {
  await c.env.DB.prepare(
    "INSERT INTO admin_audit_log (action, target_type, target_id, details) VALUES (?, ?, ?, ?)",
  )
    .bind(action, targetType ?? null, targetId ?? null, details ?? null)
    .run();
}

// --- Routes ---

/**
 * POST /admin/login
 * Authenticate with the shared ADMIN_SECRET. Returns a 30-minute admin JWT.
 */
app.post("/login", adminLoginRateLimit, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = AdminLoginRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid request");
  }

  if (!c.env.ADMIN_SECRET) {
    throw new AuthError("Admin access is not configured");
  }

  if (parsed.data.secret !== c.env.ADMIN_SECRET) {
    throw new AuthError("Invalid admin secret");
  }

  const jti = crypto.randomUUID();
  const accessToken = await signAdminJwt(c.env, jti);

  return c.json({ accessToken });
});

// --- Stats ---

/**
 * GET /admin/stats
 * Aggregate system statistics for the admin dashboard.
 */
app.get("/stats", adminMiddleware, async (c) => {
  const counts = await c.env.DB.prepare(
    `SELECT
      COUNT(*) as totalUsers,
      SUM(CASE WHEN tier = 'premium' AND deleted_at IS NULL THEN 1 ELSE 0 END) as premiumUsers,
      SUM(CASE WHEN tier = 'free' AND deleted_at IS NULL THEN 1 ELSE 0 END) as freeUsers,
      SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) as suspendedUsers,
      SUM(CASE WHEN created_at >= date('now') THEN 1 ELSE 0 END) as signupsToday,
      SUM(CASE WHEN created_at >= date('now', '-7 days') THEN 1 ELSE 0 END) as signupsThisWeek,
      SUM(CASE WHEN created_at >= date('now', '-30 days') THEN 1 ELSE 0 END) as signupsThisMonth,
      COALESCE(SUM(attachment_used), 0) as totalAttachmentBytes
    FROM users`,
  )
    .first<{
      totalUsers: number;
      premiumUsers: number;
      freeUsers: number;
      suspendedUsers: number;
      signupsToday: number;
      signupsThisWeek: number;
      signupsThisMonth: number;
      totalAttachmentBytes: number;
    }>();

  const loginEvents = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM login_events WHERE created_at >= date('now')",
  )
    .first<{ count: number }>();

  return c.json({
    totalUsers: counts?.totalUsers ?? 0,
    premiumUsers: counts?.premiumUsers ?? 0,
    freeUsers: counts?.freeUsers ?? 0,
    suspendedUsers: counts?.suspendedUsers ?? 0,
    signupsToday: counts?.signupsToday ?? 0,
    signupsThisWeek: counts?.signupsThisWeek ?? 0,
    signupsThisMonth: counts?.signupsThisMonth ?? 0,
    totalAttachmentBytes: counts?.totalAttachmentBytes ?? 0,
    loginEventsToday: loginEvents?.count ?? 0,
  });
});

// --- Users ---

/**
 * GET /admin/users
 * Paginated list of users with optional search and tier filter.
 */
app.get("/users", adminMiddleware, async (c) => {
  const q = c.req.query("q") ?? "";
  const tier = c.req.query("tier");
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") ?? "20")));
  const offset = (page - 1) * limit;

  let where = "1=1";
  const binds: string[] = [];

  if (q) {
    where += " AND email LIKE ?";
    binds.push(`%${q}%`);
  }
  if (tier === "suspended") {
    where += " AND deleted_at IS NOT NULL";
  } else if (tier === "free" || tier === "premium") {
    where += " AND tier = ? AND deleted_at IS NULL";
    binds.push(tier);
  } else {
    where += " AND deleted_at IS NULL";
  }

  const countRow = await c.env.DB.prepare(`SELECT COUNT(*) as total FROM users WHERE ${where}`)
    .bind(...binds)
    .first<{ total: number }>();

  const users = await c.env.DB.prepare(
    `SELECT id, email, tier, mfa_enabled, attachment_used, deleted_at, created_at
     FROM users WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...binds, limit, offset)
    .all<{
      id: string;
      email: string;
      tier: string;
      mfa_enabled: number;
      attachment_used: number;
      deleted_at: string | null;
      created_at: string;
    }>();

  return c.json({
    users: users.results.map((u) => ({
      id: u.id,
      email: u.email,
      tier: u.tier as "free" | "premium",
      mfaEnabled: u.mfa_enabled === 1,
      attachmentUsed: u.attachment_used,
      deleted: u.deleted_at !== null,
      createdAt: u.created_at,
    })),
    total: countRow?.total ?? 0,
    page,
    limit,
  });
});

/**
 * GET /admin/users/:id
 * Full user detail with attachments and login events.
 */
app.get("/users/:id", adminMiddleware, async (c) => {
  const userId = c.req.param("id");

  const user = await c.env.DB.prepare(
    `SELECT id, email, tier, mfa_enabled, attachment_used,
            deleted_at, subscription_status, created_at, updated_at
     FROM users WHERE id = ?`,
  )
    .bind(userId)
    .first<{
      id: string;
      email: string;
      tier: string;
      mfa_enabled: number;
      attachment_used: number;
      deleted_at: string | null;
      subscription_status: string;
      created_at: string;
      updated_at: string;
    }>();

  if (!user) {
    throw new AuthError("User not found");
  }

  const attachments = await c.env.DB.prepare(
    "SELECT id, name, size, content_type, created_at FROM attachment_meta WHERE user_id = ? ORDER BY created_at DESC",
  )
    .bind(userId)
    .all<{
      id: string;
      name: string;
      size: number;
      content_type: string | null;
      created_at: string;
    }>();

  const loginEvents = await c.env.DB.prepare(
    "SELECT created_at as timestamp, ip_hash, user_agent, city_country as cityCountry FROM login_events WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
  )
    .bind(userId)
    .all<{
      timestamp: string;
      ip_hash: string;
      user_agent: string;
      cityCountry: string;
    }>();

  const quota = user.tier === "premium" ? 2 * 1024 * 1024 * 1024 : 250 * 1024 * 1024;

  return c.json({
    id: user.id,
    email: user.email,
    tier: user.tier as "free" | "premium",
    mfaEnabled: user.mfa_enabled === 1,
    attachmentUsed: user.attachment_used,
    attachmentQuota: quota,
    deleted: user.deleted_at !== null,
    subscriptionStatus: user.subscription_status,
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    deletedAt: user.deleted_at,
    attachments: attachments.results.map((a) => ({
      id: a.id,
      name: a.name,
      size: a.size,
      contentType: a.content_type,
      createdAt: a.created_at,
    })),
    loginEvents: loginEvents.results.map((e) => ({
      timestamp: e.timestamp,
      ipHash: e.ip_hash,
      userAgent: e.user_agent,
      cityCountry: e.cityCountry,
    })),
  });
});

/**
 * PATCH /admin/users/:id/tier
 * Change a user's tier between free and premium.
 */
app.patch("/users/:id/tier", adminMiddleware, async (c) => {
  const userId = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = AdminUpdateTierRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid tier");
  }

  const user = await c.env.DB.prepare("SELECT id, tier FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string; tier: string }>();

  if (!user) {
    throw new AuthError("User not found");
  }

  const oldTier = user.tier;
  const newTier = parsed.data.tier;

  await c.env.DB.prepare("UPDATE users SET tier = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(newTier, userId)
    .run();

  await logAdminAction(
    c,
    "tier_change",
    "user",
    userId,
    JSON.stringify({ oldTier, newTier }),
  );

  return c.json({ success: true, tier: newTier });
});

/**
 * POST /admin/users/:id/suspend
 * Soft-delete a user account.
 */
app.post("/users/:id/suspend", adminMiddleware, async (c) => {
  const userId = c.req.param("id");

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND deleted_at IS NULL")
    .bind(userId)
    .first<{ id: string }>();

  if (!user) {
    throw new AuthError("User not found or already suspended");
  }

  await c.env.DB.prepare("UPDATE users SET deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
    .bind(userId)
    .run();

  await logAdminAction(c, "user_suspend", "user", userId, undefined);

  return c.json({ success: true });
});

/**
 * POST /admin/users/:id/unsuspend
 * Restore a soft-deleted user account.
 */
app.post("/users/:id/unsuspend", adminMiddleware, async (c) => {
  const userId = c.req.param("id");

  const user = await c.env.DB.prepare("SELECT id FROM users WHERE id = ? AND deleted_at IS NOT NULL")
    .bind(userId)
    .first<{ id: string }>();

  if (!user) {
    throw new AuthError("User not found or not suspended");
  }

  await c.env.DB.prepare("UPDATE users SET deleted_at = NULL, updated_at = datetime('now') WHERE id = ?")
    .bind(userId)
    .run();

  await logAdminAction(c, "user_unsuspend", "user", userId, undefined);

  return c.json({ success: true });
});

/**
 * GET /admin/users/:id/events
 * Paginated login events for a specific user.
 */
app.get("/users/:id/events", adminMiddleware, async (c) => {
  const userId = c.req.param("id");
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") ?? "20")));

  const events = await c.env.DB.prepare(
    "SELECT created_at as timestamp, ip_hash, user_agent, city_country as cityCountry FROM login_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
  )
    .bind(userId, limit)
    .all<{
      timestamp: string;
      ip_hash: string;
      user_agent: string;
      cityCountry: string;
    }>();

  return c.json({
    events: events.results.map((e) => ({
      timestamp: e.timestamp,
      ipHash: e.ip_hash,
      userAgent: e.user_agent,
      cityCountry: e.cityCountry,
    })),
  });
});

// --- Audit Log ---

/**
 * GET /admin/audit-log
 * Paginated admin audit trail with optional action filter.
 */
app.get("/audit-log", adminMiddleware, async (c) => {
  const action = c.req.query("action") ?? "";
  const q = c.req.query("q") ?? "";
  const page = Math.max(1, parseInt(c.req.query("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") ?? "20")));
  const offset = (page - 1) * limit;

  let where = "1=1";
  const binds: string[] = [];

  if (action) {
    where += " AND action = ?";
    binds.push(action);
  }
  if (q) {
    where += " AND target_id LIKE ?";
    binds.push(`%${q}%`);
  }

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as total FROM admin_audit_log WHERE ${where}`,
  )
    .bind(...binds)
    .first<{ total: number }>();

  const entries = await c.env.DB.prepare(
    `SELECT id, action, target_type, target_id, details, created_at
     FROM admin_audit_log WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...binds, limit, offset)
    .all<{
      id: number;
      action: string;
      target_type: string | null;
      target_id: string | null;
      details: string | null;
      created_at: string;
    }>();

  return c.json({
    entries: entries.results.map((e) => ({
      id: e.id,
      action: e.action,
      targetType: e.target_type,
      targetId: e.target_id,
      details: e.details,
      createdAt: e.created_at,
    })),
    total: countRow?.total ?? 0,
    page,
    limit,
  });
});

// --- Feature Flags ---

/**
 * GET /admin/feature-flags
 * List all feature flags stored in KV under the feature: prefix.
 */
app.get("/feature-flags", adminMiddleware, async (c) => {
  const result = await c.env.KV.list({ prefix: "feature:" });
  const flags: { key: string; value: string }[] = [];

  for (const item of result.keys) {
    const val = await c.env.KV.get(item.name);
    flags.push({
      key: item.name.replace(/^feature:/, ""),
      value: val ?? "",
    });
  }

  return c.json({ flags });
});

/**
 * PUT /admin/feature-flags/:key
 * Set a feature flag in KV.
 */
app.put("/feature-flags/:key", adminMiddleware, async (c) => {
  const flagKey = c.req.param("key");
  const body = await c.req.json().catch(() => ({}));
  const parsed = AdminFeatureFlagUpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid flag value");
  }

  const kvKey = `feature:${flagKey}`;
  const oldValue = await c.env.KV.get(kvKey);
  await c.env.KV.put(kvKey, parsed.data.value);

  await logAdminAction(
    c,
    "feature_flag_update",
    "feature_flag",
    flagKey,
    JSON.stringify({ oldValue: oldValue ?? null, newValue: parsed.data.value }),
  );

  return c.json({ success: true, key: flagKey, value: parsed.data.value });
});

export const adminRoutes = app;
