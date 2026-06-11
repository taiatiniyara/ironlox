import type { Context, Next } from "hono";

export async function logger(c: Context, next: Next): Promise<void> {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;

  // Minimal logging — no PII, no auth headers, no body content
  console.log({
    method: c.req.method,
    path: c.req.path,
    status: c.res.status,
    durationMs: duration,
  });
}
