import { authOptions } from "@/lib/auth";
import { createLogger, generateRequestId } from "@/lib/logger";
import { getTotalShipCredits } from "@/lib/ship-credits";
import { getOrCreateCustomer, hasActiveProSubscription } from "@/lib/stripe";
import type { PaymentStatus } from "@/types";
import { getServerSession } from "next-auth";

export async function GET() {
  const requestId = generateRequestId();
  const logger = createLogger({
    requestId,
    route: "GET /api/credits",
  });

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    logger.warn("Unauthorized credits request");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = session.user as { email?: string; name?: string };
    const email = user.email || "";

    if (!email) {
      // Dev mode / no email — return no credits
      const status: PaymentStatus = { plan: "none", credits: 0 };
      logger.info("Credits request without email; returning no credits");
      return Response.json(status);
    }

    const customerId = await getOrCreateCustomer(email, user.name || "");

    const [isPro, credits] = await Promise.all([
      hasActiveProSubscription(customerId),
      getTotalShipCredits(customerId, email),
    ]);

    const status: PaymentStatus = {
      plan: isPro ? "pro" : credits > 0 ? "credit" : "none",
      credits,
      stripeCustomerId: customerId,
    };

    logger.info("Credits status resolved", {
      plan: status.plan,
      credits: status.credits,
      stripeCustomerId: status.stripeCustomerId,
    });

    return Response.json(status);
  } catch (error) {
    logger.error("Credits check error", undefined, error);
    // On error, return no credits (fail closed — don't give free access)
    const status: PaymentStatus = { plan: "none", credits: 0 };
    return Response.json(status);
  }
}
