import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

type AppContext = Context;

export function errorHandler(err: Error, c: AppContext): Response {
  const sanitizedMessage = err.message.replace(/[A-Za-z0-9+/]{32,}/g, "[REDACTED]");

  console.error("API Error:", {
    message: sanitizedMessage,
    path: c.req.path,
    method: c.req.method,
  });

  if (err instanceof ValidationError) {
    return c.json({ message: "Invalid request", code: "VALIDATION_ERROR" }, 400);
  }

  if (err instanceof AuthError) {
    return c.json({ message: "Unauthorized", code: "UNAUTHORIZED" }, 401);
  }

  if (err instanceof RateLimitError) {
    return c.json({ message: "Too many requests", code: "RATE_LIMITED" }, 429);
  }

  if (err instanceof ConflictError) {
    return c.json({ message: err.message, code: "VAULT_VERSION_CONFLICT" }, 409);
  }

  if (err instanceof QuotaError) {
    return c.json({ message: err.message, code: "STORAGE_QUOTA_EXCEEDED" }, 413);
  }

  return c.json(
    { message: "Internal server error", code: "INTERNAL_ERROR" },
    500 as ContentfulStatusCode,
  );
}

export class AuthError extends Error {
  name = "AuthError";
  status = 401;
  constructor(message = "Unauthorized") {
    super(message);
  }
}

export class ValidationError extends Error {
  name = "ValidationError";
  status = 400;
  constructor(message = "Invalid request") {
    super(message);
  }
}

export class RateLimitError extends Error {
  name = "RateLimitError";
  status = 429;
  constructor(message = "Too many requests") {
    super(message);
  }
}

export class ConflictError extends Error {
  name = "ConflictError";
  status = 409;
  constructor(message = "Vault version conflict") {
    super(message);
  }
}

export class QuotaError extends Error {
  name = "QuotaError";
  status = 413;
  constructor(message = "Storage quota exceeded") {
    super(message);
  }
}
