import type { Context, Next } from "hono";
import { verify, decode } from "hono/jwt";
import { HTTPException } from "hono/http-exception";
import type { Env, Variables } from "../index.js";

type AppContext = Context<{ Bindings: Env; Variables: Variables }>;

function throwUnauthorized(message: string): never {
  throw new HTTPException(401, { message });
}

export async function authMiddleware(c: AppContext, next: Next): Promise<void> {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    throwUnauthorized("Missing or invalid authorization header");
  }

  const token = header.slice(7);
  try {
    const payload = await verify(token, c.env.JWT_SECRET, "HS256");
    const decoded = decode(token);
    c.set("jwtPayload", payload);
    c.set("userId", payload.sub as string);
    c.set("tier", (decoded.payload.tier as string) ?? "free");
    await next();
  } catch {
    throwUnauthorized("Invalid or expired token");
  }
}

export async function optionalAuthMiddleware(c: AppContext, next: Next): Promise<void> {
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7);
    try {
      const payload = await verify(token, c.env.JWT_SECRET, "HS256");
      const decoded = decode(token);
      c.set("jwtPayload", payload);
      c.set("userId", payload.sub as string);
      c.set("tier", (decoded.payload.tier as string) ?? "free");
    } catch {
      // Token invalid but this is optional auth — proceed without
    }
  }
  await next();
}
