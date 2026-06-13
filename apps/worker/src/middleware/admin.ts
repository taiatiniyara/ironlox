import type { Context, Next } from "hono";
import { verify } from "hono/jwt";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../index.js";

type AdminContext = Context<{ Bindings: Env }>;

const ADMIN_RATE_LIMIT = 30;
const RATE_WINDOW = 900;

function throwUnauthorized(message: string): never {
  throw new HTTPException(401, { message });
}

export async function adminMiddleware(c: AdminContext, next: Next): Promise<void> {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throwUnauthorized("Missing or invalid authorization header");
  }

  const token = header.slice(7);
  try {
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");
    if ((payload.role as string) !== "admin") {
      throwUnauthorized("Admin access required");
    }
    await next();
  } catch (err) {
    if (err instanceof HTTPException) throw err;
    throwUnauthorized("Invalid or expired admin token");
  }
}

export async function adminLoginRateLimit(c: AdminContext, next: Next): Promise<void> {
  const identifier = c.req.header("CF-Connecting-IP") ?? "unknown";
  const key = `rate:admin-login:${identifier}`;

  const current = await c.env.KV.get(key);
  const count = current ? parseInt(current) : 0;

  if (count >= 5) {
    return c.json(
      { message: "Too many admin login attempts", code: "RATE_LIMITED" },
      429,
    ) as unknown as void;
  }

  await c.env.KV.put(key, String(count + 1), { expirationTtl: RATE_WINDOW });
  await next();
}

export async function adminRateLimit(c: AdminContext, next: Next): Promise<void> {
  const identifier = c.req.header("CF-Connecting-IP") ?? "unknown";
  const key = `rate:admin:${identifier}`;

  const current = await c.env.KV.get(key);
  const count = current ? parseInt(current) : 0;

  if (count >= ADMIN_RATE_LIMIT) {
    return c.json(
      { message: "Too many admin requests", code: "RATE_LIMITED" },
      429,
    ) as unknown as void;
  }

  await c.env.KV.put(key, String(count + 1), { expirationTtl: RATE_WINDOW });
  await next();
}
