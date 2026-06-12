import { Hono } from "hono";
import type { Env, Variables } from "../index.js";
import { authMiddleware } from "../middleware/auth.js";
import { ConflictError, ValidationError, QuotaError } from "../middleware/error.js";
import { PutVaultRequestSchema } from "@ironlox/schemas";

const MAX_VAULT_SIZE = 10 * 1024 * 1024; // 10MB max vault blob

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", authMiddleware);

/**
 * GET /vault
 * Returns the encrypted vault blob URL and current vault version.
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
 * Uses optimistic locking: client sends current version, server checks for conflicts.
 * Body is a JSON envelope with { version } followed by a vaultBlob field.
 */
app.put("/", async (c) => {
  const userId = c.get("userId") as string;

  const contentLength = parseInt(c.req.header("Content-Length") ?? "0");
  if (contentLength > MAX_VAULT_SIZE) {
    throw new ValidationError("Vault blob exceeds maximum size");
  }

  const rawBody = await c.req.text();
  if (rawBody.length > MAX_VAULT_SIZE) {
    throw new ValidationError("Vault blob exceeds maximum size");
  }

  const { version, vaultBlob } = parseVaultBody(rawBody);

  const key = `vault-lock:${userId}`;
  const locked = await c.env.KV.get(key);
  if (locked) {
    throw new ConflictError("Another vault upload is in progress. Please retry.");
  }

  await c.env.KV.put(key, "1", { expirationTtl: 30 });

  try {
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

    await c.env.VAULT.put(`${userId}/vault`, vaultBlob);

    await c.env.DB.prepare(
      "UPDATE users SET vault_version = ?, updated_at = ? WHERE id = ? AND vault_version = ?",
    )
      .bind(newVersion, new Date().toISOString(), userId, current.vault_version)
      .run();

    return c.json({ version: newVersion, vaultUrl: `${userId}/vault` });
  } finally {
    try {
      await c.env.KV.delete(key);
    } catch {
      // KV delete failure should not suppress the original error
    }
  }
});

/**
 * GET /vault/blob
 * Returns the raw encrypted vault blob content.
 */
app.get("/blob", async (c) => {
  const userId = c.get("userId") as string;

  const object = await c.env.VAULT.get(`${userId}/vault`);

  if (!object) {
    return c.body(null, 204);
  }

  const body = await object.text();
  return c.text(body);
});

/**
 * GET /vault/attachment/:id
 * Get an attachment download URL.
 */
app.get("/attachment/:id", async (c) => {
  const userId = c.get("userId") as string;
  const attachmentId = c.req.param("id");

  if (!/^[a-zA-Z0-9_-]+$/.test(attachmentId)) {
    throw new ValidationError("Invalid attachment ID");
  }

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
 * Upload an encrypted attachment to R2 with quota enforcement.
 */
app.put("/attachment/:id", async (c) => {
  const userId = c.get("userId") as string;
  const attachmentId = c.req.param("id");
  const tier = (c.get("tier") as string) ?? "free";

  if (!/^[a-zA-Z0-9_-]+$/.test(attachmentId)) {
    throw new ValidationError("Invalid attachment ID");
  }

  const quota = tier === "premium" ? 2 * 1024 * 1024 * 1024 : 250 * 1024 * 1024;
  const { actualUsage } = await getAttachmentUsage(c.env, userId);

  const content = await c.req.arrayBuffer();
  const actualSize = content.byteLength;

  if (actualUsage + actualSize > quota) {
    throw new QuotaError("Storage quota exceeded. Upgrade to premium for more space.");
  }

  await c.env.VAULT.put(`${userId}/attachments/${attachmentId}`, content, {
    customMetadata: { size: String(actualSize), uploadedAt: new Date().toISOString() },
  });

  return c.json({ success: true, id: attachmentId, size: actualSize });
});

/**
 * DELETE /vault/attachment/:id
 * Delete an attachment from R2.
 */
app.delete("/attachment/:id", async (c) => {
  const userId = c.get("userId") as string;
  const attachmentId = c.req.param("id");

  if (!/^[a-zA-Z0-9_-]+$/.test(attachmentId)) {
    throw new ValidationError("Invalid attachment ID");
  }

  await c.env.VAULT.delete(`${userId}/attachments/${attachmentId}`);

  return c.json({ success: true });
});

async function getAttachmentUsage(env: Env, userId: string): Promise<{ usage: number; count: number; actualUsage: number }> {
  const objects = await env.VAULT.list({ prefix: `${userId}/attachments/` });
  let usage = 0;

  for (const obj of objects.objects) {
    usage += obj.size;
  }

  return { usage, count: objects.objects.length, actualUsage: usage };
}

function parseVaultBody(raw: string): { version: number; vaultBlob: string } {
  try {
    const parsed = JSON.parse(raw);
    const validated = PutVaultRequestSchema.safeParse(parsed);
    if (!validated.success) {
      throw new ValidationError("Invalid vault upload data");
    }
    return validated.data;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError("Invalid JSON body");
  }
}

export const vaultRoutes = app;
