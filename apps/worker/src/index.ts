import { Hono } from "hono";
import { cors } from "hono/cors";
import type { JwtVariables } from "hono/jwt";
import { authRoutes } from "./routes/auth.js";
import { vaultRoutes } from "./routes/vault.js";
import { accountRoutes } from "./routes/account.js";
import { healthRoute } from "./routes/health.js";
import { webhookRoutes } from "./routes/webhooks.js";
import { mfaRoutes } from "./routes/mfa.js";
import { errorHandler } from "./middleware/error.js";
import { logger } from "./middleware/logger.js";
import { securityHeaders } from "./middleware/security.js";
import { rateLimitMiddleware } from "./middleware/rate-limit.js";

export type Env = {
  DB: D1Database;
  VAULT: R2Bucket;
  KV: KVNamespace;
  JWT_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  MAILCHANNELS_API_KEY: string;
  SENTRY_DSN: string;
  CORS_ORIGINS?: string;
};

export type Variables = JwtVariables<{ tier: string }> & {
  userId: string;
  tier: string;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", cors({
  origin: (origin, c) => {
    const allowed = (c.env.CORS_ORIGINS ?? "http://localhost:3001,http://localhost:3000")
      .split(",")
      .map((s: string) => s.trim());
    if (!origin || allowed.includes(origin)) return origin;
    return null;
  },
  credentials: true,
}));
app.use("*", securityHeaders);
app.use("*", logger);
app.use("/auth/*", rateLimitMiddleware);
app.use("/vault/*", rateLimitMiddleware);
app.use("/account/*", rateLimitMiddleware);
app.onError(errorHandler);

app.route("/health", healthRoute);
app.route("/auth", authRoutes);
app.route("/auth", mfaRoutes);
app.route("/vault", vaultRoutes);
app.route("/account", accountRoutes);
app.route("/webhooks", webhookRoutes);

export default app;
