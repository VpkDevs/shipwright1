import type Stripe from "stripe";
import {
  markStripeEventFailed,
  markStripeEventProcessed,
  reserveStripeEvent,
} from "@/lib/db/stripe-events";
import { createLogger } from "@/lib/logger";
import { addShipCredits, stripe } from "@/lib/stripe";

const logger = createLogger({ route: "POST /api/stripe/webhook" });

/**
 * Handle Stripe webhook events
 * Verifies signature, then processes payment/subscription events
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    logger.error("Missing webhook signature or secret");
    return Response.json({ error: "Webhook signature missing" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error) {
    logger.error("Webhook signature verification failed", { error });
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  logger.info("Webhook event received", { type: event.type, id: event.id });

  let reserved = false;
  try {
    reserved = await reserveStripeEvent(event.id, event.type);
  } catch (error) {
    logger.error("Stripe event reservation failed", { error, eventId: event.id, type: event.type });
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  if (!reserved) {
    logger.info("Duplicate Stripe event ignored", { eventId: event.id, type: event.type });
    return Response.json({ received: true, duplicate: true }, { status: 200 });
  }

  try {
    // Handle checkout completion (one-time payment)
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutSessionCompleted(session);
    }

    // Handle subscription creation
    if (event.type === "customer.subscription.created") {
      const subscription = event.data.object as Stripe.Subscription;
      logger.info("Subscription created", {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
      });
    }

    // Handle subscription updates
    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      logger.info("Subscription updated", {
        subscriptionId: subscription.id,
        status: subscription.status,
      });
    }

    // Handle subscription deletion
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      logger.info("Subscription deleted", {
        subscriptionId: subscription.id,
        customerId: subscription.customer,
      });
    }

    await markStripeEventProcessed(event.id).catch((markProcessedError) => {
      logger.error("Stripe event processed marker failed", {
        error: markProcessedError,
        eventId: event.id,
      });
    });
    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    logger.error("Webhook processing failed", { error, eventId: event.id, type: event.type });
    await markStripeEventFailed(event.id, error).catch((markFailedError) => {
      logger.error("Stripe event failure marker failed", {
        error: markFailedError,
        eventId: event.id,
      });
    });
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

/**
 * Handle successful checkout session
 * For one-time credit purchases, add credits to customer metadata
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string | null;
  const planType = session.metadata?.planType;

  logger.info("Processing checkout completion", {
    sessionId: session.id,
    customerId,
    planType,
  });

  // For one-time credit purchases, add the credit
  if (planType === "credit" && customerId && typeof customerId === "string") {
    const newCredits = await addShipCredits(customerId, 1);
    logger.info("Credit added to customer", {
      customerId,
      newCredits,
    });
  }

  // For subscriptions, they're automatically activated by Stripe
  if (planType && ["pro", "proAnnual", "team"].includes(planType)) {
    logger.info("Subscription activated for customer", {
      customerId,
      planType,
    });
  }
}
