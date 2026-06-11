import type { Context, Next } from "hono";

export async function securityHeaders(c: Context, next: Next): Promise<void> {
  await next();

  c.res.headers.set("Cache-Control", "no-store, max-age=0");

  c.res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' https://challenges.cloudflare.com",
      "style-src 'self'",
      "frame-src https://challenges.cloudflare.com https://js.stripe.com",
      "connect-src 'self' https://api.ironlox.com",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join("; "),
  );

  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Cross-Origin-Resource-Policy", "same-site");
  c.res.headers.set("Cross-Origin-Opener-Policy", "same-origin");

  c.res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );

  c.res.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains",
  );
}
