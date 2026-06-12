import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "../src/middleware/error.js";
import { securityHeaders } from "../src/middleware/security.js";
import type { Env } from "../src/index.js";

export function createApp(env: Env) {
  const app = new Hono<{ Bindings: Env }>();
  app.use("*", cors({ origin: "*" }));
  app.use("*", securityHeaders);
  app.onError(errorHandler);
  return app;
}
