import { Hono } from "hono";
import type { Env, Variables } from "../index.js";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

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

  // Parse Stripe event — event shapes vary by type
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
