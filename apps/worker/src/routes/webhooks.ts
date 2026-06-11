import { Hono } from "hono";
import type { Env, Variables } from "../index.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

async function verifyStripeSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const parts = signature.split(",");
  const timestamp = parts.find((p) => p.startsWith("t="))?.split("=")[1];
  const sigs = parts.filter((p) => p.startsWith("v1="));

  if (!timestamp || sigs.length === 0) return false;

  for (const sig of sigs) {
    const sigValue = sig.split("=")[1];
    if (!sigValue) continue;

    const signedPayload = `${timestamp}.${body}`;
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      hexToBuffer(sigValue),
      encoder.encode(signedPayload),
    );
    if (valid) return true;
  }

  return false;
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * POST /webhooks/stripe
 * Handles Stripe webhook events for subscription lifecycle.
 * Verifies webhook signature before processing.
 */
app.post("/stripe", async (c) => {
  const signature = c.req.header("Stripe-Signature");
  if (!signature) {
    return c.json({ error: "Missing signature" }, 400);
  }

  const body = await c.req.text();

  const valid = await verifyStripeSignature(
    body,
    signature,
    c.env.STRIPE_WEBHOOK_SECRET,
  );
  if (!valid) {
    return c.json({ error: "Invalid signature" }, 401);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: { type: string; data: { object: Record<string, any> } };

  try {
    event = JSON.parse(body);
  } catch {
    return c.json({ error: "Invalid payload" }, 400);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerId = session.customer;

      await c.env.DB.prepare(
        "UPDATE users SET tier = 'premium', stripe_customer_id = ?, updated_at = ? WHERE stripe_customer_id = ? OR id = ?",
      )
        .bind(customerId, new Date().toISOString(), customerId, customerId)
        .run();

      break;
    }

    case "customer.subscription.updated": {
      const obj = event.data.object;
      const customerId = obj.customer as string;

      await c.env.DB.prepare(
        "UPDATE users SET subscription_status = ?, updated_at = ? WHERE stripe_customer_id = ?",
      )
        .bind((obj.status as string) ?? "active", new Date().toISOString(), customerId)
        .run();

      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      // Downgrade to free tier
      await c.env.DB.prepare(
        "UPDATE users SET tier = 'free', subscription_status = 'canceled', updated_at = ? WHERE stripe_customer_id = ?",
      )
        .bind(new Date().toISOString(), customerId)
        .run();

      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = invoice.customer;

      await c.env.DB.prepare(
        "UPDATE users SET subscription_status = 'past_due', updated_at = ? WHERE stripe_customer_id = ?",
      )
        .bind(new Date().toISOString(), customerId)
        .run();

      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object;
      const customerId = invoice.customer;

      await c.env.DB.prepare(
        "UPDATE users SET subscription_status = 'active', updated_at = ? WHERE stripe_customer_id = ?",
      )
        .bind(new Date().toISOString(), customerId)
        .run();

      break;
    }
  }

  return c.json({ received: true });
});

export const webhookRoutes = app;
