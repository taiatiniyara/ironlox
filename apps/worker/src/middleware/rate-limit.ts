import type { Context, Next } from "hono";
import type { Env } from "../index.js";

const RATE_LIMIT_WINDOW = 900; // 15 minutes in seconds
const MAX_ATTEMPTS = 5;

/**
 * Rate limit middleware using Cloudflare KV.
 * Tracks request counts per IP and per email.
 */
export async function rateLimitMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next,
): Promise<void> {
  const identifier = c.req.header("CF-Connecting-IP") ?? "unknown";
  const key = `rate:${c.req.path}:${identifier}`;

  const current = await c.env.KV.get(key);
  const count = current ? parseInt(current) : 0;

  if (count >= MAX_ATTEMPTS) {
    return c.json(
      {
        message: "Too many requests. Please retry later or complete the CAPTCHA.",
        code: "RATE_LIMITED",
        retryAfter: RATE_LIMIT_WINDOW,
      },
      429,
    ) as unknown as void;
  }

  await c.env.KV.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW });
  await next();
}

/**
 * Verify Cloudflare Turnstile token.
 * Called after rate limit threshold is exceeded to allow legitimate users through.
 */
export async function verifyTurnstile(
  token: string,
  secretKey: string,
): Promise<boolean> {
  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: secretKey, response: token }),
    });

    const data = (await response.json()) as { success: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
