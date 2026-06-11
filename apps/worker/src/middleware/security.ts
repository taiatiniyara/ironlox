import type { Context, Next } from "hono";

/**
 * Security headers middleware.
 * Sets Content-Security-Policy, X-Frame-Options, X-Content-Type-Options,
 * Strict-Transport-Security, and other security headers.
 */
export async function securityHeaders(c: Context, next: Next): Promise<void> {
  await next();

  // Content-Security-Policy: restrict to our own origins
  c.res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "frame-src https://challenges.cloudflare.com https://js.stripe.com",
      "connect-src 'self' https://api.ironlox.com",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  );

  // Prevent clickjacking
  c.res.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME-type sniffing
  c.res.headers.set("X-Content-Type-Options", "nosniff");

  // Referrer policy
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions policy: restrict sensitive APIs
  c.res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  // HSTS (1 year, include subdomains)
  c.res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
}
