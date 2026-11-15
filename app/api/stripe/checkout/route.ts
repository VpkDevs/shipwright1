import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { createLogger, generateRequestId } from "@/lib/logger";
import { getOrCreateCustomer, STRIPE_PRICES, stripe } from "@/lib/stripe";
import { withErrorHandler } from "@/lib/with-error-handler";

const checkoutSchema = z.object({
  /** Plan type — never trust client-supplied price IDs */
  plan: z.enum(["credit", "pro", "proAnnual", "team"]),
  /** Optional repo full name (owner/repo) for metadata */
  repoFullName: z.string().optional(),
  /** Optional relative path to return users to after checkout */
  successPath: z.string().optional(),
});

const PLAN_CONFIG = {
  credit: {
    priceId: STRIPE_PRICES.credit,
    mode: "payment" as const,
    description: "Ship Credit",
  },
  pro: {
    priceId: STRIPE_PRICES.pro,
    mode: "subscription" as const,
    description: "Pro Monthly",
  },
  proAnnual: {
    priceId: STRIPE_PRICES.proAnnual,
    mode: "subscription" as const,
    description: "Pro Annual",
  },
  team: {
    priceId: STRIPE_PRICES.team,
    mode: "subscription" as const,
    description: "Team Monthly",
  },
} as const;

export const POST = withErrorHandler(async (request: Request) => {
  const requestId = generateRequestId();
  const logger = createLogger({
    requestId,
    route: "POST /api/stripe/checkout",
  });

  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    logger.warn("Unauthorized checkout request");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = session.user.email;
  const name = session.user.name || email;

  logger.info("Processing checkout request", { email });

  try {
    const body = await request.json();
    const { plan, repoFullName, successPath } = checkoutSchema.parse(body);

    const planConfig = PLAN_CONFIG[plan];
    const { priceId, mode } = planConfig;

    if (!priceId) {
      logger.error("Missing Stripe price ID", { plan });
      return Response.json(
        { error: `Stripe price not configured for plan: ${plan}` },
        { status: 500 }
      );
    }

    const customerId = await getOrCreateCustomer(email, name);
    const origin =
      request.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const returnPath = getSafeCheckoutPath(successPath, "/repos");
    const successUrl = new URL(returnPath, origin);
    successUrl.searchParams.set("checkout", "success");
    successUrl.searchParams.set("plan", plan);
    const cancelUrl = new URL(returnPath, origin);
    cancelUrl.searchParams.set("checkout", "cancelled");

    logger.info("Creating checkout session", { plan, mode, customerId });

    const sessionParams: any = {
      customer: customerId,
      [mode === "subscription" ? "subscription_data" : "payment_intent_data"]: {
        metadata: {
          planType: plan,
          repoFullName: repoFullName || "",
          email,
        },
      },
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode,
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
    };

    const checkoutSession = await stripe.checkout.sessions.create(sessionParams);

    if (!checkoutSession.url) {
      logger.error("Checkout session created but has no URL", {
        sessionId: checkoutSession.id,
      });
      return Response.json({ error: "Failed to create checkout session" }, { status: 500 });
    }

    logger.info("Checkout session created successfully", {
      sessionId: checkoutSession.id,
      plan,
    });

    return Response.json({ url: checkoutSession.url }, { status: 200 });
  } catch (error) {
    logger.error("Failed to create checkout session", { error });
    throw error;
  }
});

function getSafeCheckoutPath(path: string | undefined, fallback: string) {
  if (!path?.startsWith("/") || path.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(path, "http://shipwright.local");
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
