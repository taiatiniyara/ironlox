import { Hono } from "hono";
import type { Env, Variables } from "../index.js";
import { authMiddleware } from "../middleware/auth.js";
import { AuthError, ValidationError } from "../middleware/error.js";
import { z } from "zod";

export const CreateCheckoutRequestSchema = z.object({
  cycle: z.enum(["monthly", "annual"]),
});

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const STRIPE_API = "https://api.stripe.com/v1";

async function stripeFetch(
  endpoint: string,
  secretKey: string,
  method: "GET" | "POST",
  body: Record<string, string>,
): Promise<Record<string, unknown>> {
  const formBody = new URLSearchParams(body).toString();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  const init: RequestInit = { method, headers };
  if (method === "POST") {
    init.body = formBody;
  }
  const res = await fetch(`${STRIPE_API}${endpoint}`, init);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: "Stripe request failed" } })) as {
      error?: { message: string };
    };
    throw new Error(error.error?.message ?? `Stripe ${res.status}: ${res.statusText}`);
  }

  return res.json() as Promise<Record<string, unknown>>;
}

app.use("*", authMiddleware);

/**
 * POST /billing/checkout
 * Creates a Stripe Checkout session for premium subscription.
 * Body: { cycle: "monthly" | "annual" }
 * Returns a URL the client redirects to for payment.
 */
app.post("/checkout", async (c) => {
  const userId = c.get("userId") as string;

  const user = await c.env.DB.prepare(
    "SELECT email, tier FROM users WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(userId)
    .first<{ email: string; tier: string }>();

  if (!user) {
    throw new AuthError("User not found");
  }

  if (user.tier === "premium") {
    return c.json({ error: "You are already on the Premium plan" }, 400);
  }

  const body = await c.req.json();
  const parsed = CreateCheckoutRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new ValidationError("cycle must be 'monthly' or 'annual'");
  }

  const { cycle } = parsed.data;
  const priceId = cycle === "monthly" ? c.env.STRIPE_PRICE_MONTHLY : c.env.STRIPE_PRICE_ANNUAL;
  const baseUrl = (c.env.CORS_ORIGINS ?? "http://localhost:3001").split(",")[0]!.trim();

  try {
    const session = await stripeFetch("/checkout/sessions", c.env.STRIPE_SECRET_KEY, "POST", {
      mode: "subscription",
      "success_url": `${baseUrl}/settings/billing?session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url": `${baseUrl}/settings/billing?canceled=true`,
      "line_items[0][price]": priceId,
      "line_items[0][quantity]": "1",
      "customer_email": user.email,
      "metadata[user_id]": userId,
      "metadata[cycle]": cycle,
      "allow_promotion_codes": "true",
    });

    return c.json({ url: session.url as string });
  } catch (err) {
    console.error("Stripe checkout failed:", err);
    return c.json({ error: "Failed to create checkout session" }, 502);
  }
});

/**
 * POST /billing/portal
 * Creates a Stripe Customer Portal session for managing subscription.
 * Returns a URL the client redirects to for subscription management.
 */
app.post("/portal", async (c) => {
  const userId = c.get("userId") as string;

  const user = await c.env.DB.prepare(
    "SELECT email, tier, stripe_customer_id FROM users WHERE id = ? AND deleted_at IS NULL",
  )
    .bind(userId)
    .first<{ email: string; tier: string; stripe_customer_id: string | null }>();

  if (!user) {
    throw new AuthError("User not found");
  }

  if (user.tier !== "premium" || !user.stripe_customer_id) {
    return c.json({ error: "No active subscription found" }, 400);
  }

  const baseUrl = (c.env.CORS_ORIGINS ?? "http://localhost:3001").split(",")[0]!.trim();

  try {
    const portal = await stripeFetch("/billing_portal/sessions", c.env.STRIPE_SECRET_KEY, "POST", {
      customer: user.stripe_customer_id,
      "return_url": `${baseUrl}/settings/billing`,
    });

    return c.json({ url: portal.url as string });
  } catch (err) {
    console.error("Stripe portal failed:", err);
    return c.json({ error: "Failed to create portal session" }, 502);
  }
});

export const billingRoutes = app;
