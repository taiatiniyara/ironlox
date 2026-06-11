import { Hono } from "hono";
import type { Env, Variables } from "../index.js";
import { authMiddleware } from "../middleware/auth.js";
import { ConflictError, ValidationError, QuotaError } from "../middleware/error.js";
import { PutVaultRequestSchema } from "@ironlox/schemas";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", authMiddleware);

/**
 * GET /vault
 * Returns a signed URL to download the encrypted vault blob from R2,
 * plus the current vault version for optimistic locking.
 */
app.get("/", async (c) => {
  const userId = c.get("userId") as string;

  const vault = await c.env.DB.prepare(
    "SELECT vault_version FROM users WHERE id = ?",
  )
    .bind(userId)
    .first<{ vault_version: number }>();

  if (!vault) {
    throw new ValidationError("User not found");
  }

  const object = await c.env.VAULT.get(`${userId}/vault`);

  if (!object) {
    return c.json({ vaultVersion: vault.vault_version, vaultUrl: null });
  }

  return c.json({
    vaultVersion: vault.vault_version,
    vaultUrl: `${userId}/vault`,
    size: object.size,
    uploaded: object.uploaded,
  });
});

/**
 * PUT /vault
 * Upload an encrypted vault blob to R2.
 * Optimistic locking: client must send the version they're overwriting.
 * If the server's version is higher, the request is rejected (409 Conflict).
 */
app.put("/", async (c) => {
  const userId = c.get("userId") as string;

  const body = await c.req.json();
  const parsed = PutVaultRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("Invalid vault upload data");
  }

  const { version } = parsed.data;

  // Optimistic locking: verify client version matches server version
  const current = await c.env.DB.prepare(
    "SELECT vault_version FROM users WHERE id = ?",
  )
    .bind(userId)
    .first<{ vault_version: number }>();

  if (!current) {
    throw new ValidationError("User not found");
  }

  if (version !== current.vault_version) {
    throw new ConflictError(
      "Vault version conflict. Pull the latest vault before uploading.",
    );
  }

  const newVersion = current.vault_version + 1;

  // Store vault blob directly from request body
  const vaultContent = await c.req.text();
  await c.env.VAULT.put(`${userId}/vault`, vaultContent);

  await c.env.DB.prepare(
    "UPDATE users SET vault_version = ?, updated_at = ? WHERE id = ?",
  )
    .bind(newVersion, new Date().toISOString(), userId)
    .run();

  return c.json({ version: newVersion });
});

/**
 * GET /vault/attachment/:id
 * Get a signed URL for an attachment download.
 */
app.get("/attachment/:id", async (c) => {
  const userId = c.get("userId") as string;
  const attachmentId = c.req.param("id");

  const object = await c.env.VAULT.get(`${userId}/attachments/${attachmentId}`);

  if (!object) {
    return c.json({ attachmentUrl: null }, 404);
  }

  return c.json({
    attachmentUrl: `${userId}/attachments/${attachmentId}`,
    size: object.size,
    uploaded: object.uploaded,
  });
});

/**
 * PUT /vault/attachment/:id
 * Upload an encrypted attachment to R2.
 * Checks quota before accepting.
 */
app.put("/attachment/:id", async (c) => {
  const userId = c.get("userId") as string;
  const attachmentId = c.req.param("id");
  const tier = (c.get("tier") as string) ?? "free";

  // Check quota
  const quota = tier === "premium" ? 2 * 1024 * 1024 * 1024 : 250 * 1024 * 1024; // 2GB or 250MB
  const { usage } = await getAttachmentUsage(c.env, userId);
  const bodySize = parseInt(c.req.header("Content-Length") ?? "0");

  if (usage + bodySize > quota) {
    throw new QuotaError("Storage quota exceeded. Upgrade to premium for more space.");
  }

  const content = await c.req.arrayBuffer();
  await c.env.VAULT.put(`${userId}/attachments/${attachmentId}`, content);

  return c.json({ success: true, id: attachmentId });
});

/**
 * DELETE /vault/attachment/:id
 * Delete an attachment from R2.
 */
app.delete("/attachment/:id", async (c) => {
  const userId = c.get("userId") as string;
  const attachmentId = c.req.param("id");

  await c.env.VAULT.delete(`${userId}/attachments/${attachmentId}`);

  return c.json({ success: true });
});

async function getAttachmentUsage(env: Env, userId: string): Promise<{ usage: number; count: number }> {
  const objects = await env.VAULT.list({ prefix: `${userId}/attachments/` });
  let usage = 0;

  for (const obj of objects.objects) {
    usage += obj.size;
  }

  return { usage, count: objects.objects.length };
}

export const vaultRoutes = app;
