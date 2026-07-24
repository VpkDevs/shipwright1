import { runOrchestrator } from "@/lib/agents/orchestrator";
import { authOptions } from "@/lib/auth";
import { createLogger, generateRequestId } from "@/lib/logger";
import { consumeOneShipCredit, getTotalShipCredits } from "@/lib/ship-credits";
import { getOrCreateCustomer, hasActiveProSubscription } from "@/lib/stripe";
import { getServerSession } from "next-auth";
import { z } from "zod";

const agentSchema = z.object({
  owner: z.string().trim().min(1).max(100),
  repo: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const baseLogger = createLogger({
    requestId,
    route: "POST /api/agent",
  });

  baseLogger.info("Incoming agent request");

  const session = await getServerSession(authOptions);

  if (!session?.user || !(session.user as { accessToken?: string }).accessToken) {
    baseLogger.warn("Unauthorized agent request: missing GitHub access token");
    return Response.json({ error: "Unauthorized", requestId }, { status: 401 });
  }

  // ── Payment Gate ────────────────────────────────────────────────────────
  const user = session.user as { email?: string; name?: string; accessToken?: string };
  const email = user.email || "";
  const logger = baseLogger.child({
    email: email || undefined,
    userName: user.name || undefined,
  });

  if (!email) {
    logger.warn("Agent request missing account email");
    return Response.json(
      {
        error: "Account email required to use AI generation. Please sign in with GitHub.",
        requestId,
      },
      { status: 403 }
    );
  }

  let customerId: string;
  let isPro = false;
  let credits = 0;

  try {
    customerId = await getOrCreateCustomer(email, user.name || "");
    [isPro, credits] = await Promise.all([
      hasActiveProSubscription(customerId),
      getTotalShipCredits(customerId, email),
    ]);
  } catch (err) {
    logger.error("Payment check failed", { email }, err);
    return Response.json(
      { error: "Payment verification failed. Please try again.", requestId },
      { status: 500 }
    );
  }

  const hasAccess = isPro || credits > 0;

  if (!hasAccess) {
    logger.info("Payment required for agent request", {
      plan: "none",
      credits,
    });
    return Response.json(
      {
        error: "payment_required",
        message: "AI generation requires a Ship Credit ($5) or Pro subscription ($15/month).",
        plan: "none",
        credits: 0,
        requestId,
      },
      { status: 402 }
    );
  }

  // ── Parse Request ────────────────────────────────────────────────────────
  let owner: string;
  let repo: string;
  let description: string | undefined;

  try {
    const body = await request.json();
    ({ owner, repo, description } = agentSchema.parse(body));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid request parameters" }, { status: 400 });
    }
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // ── Run Agent ────────────────────────────────────────────────────────────
  const githubToken = user.accessToken;
  if (!githubToken) {
    logger.warn("Agent request missing GitHub access token after auth check");
    return Response.json({ error: "Unauthorized", requestId }, { status: 401 });
  }
  const steps: Array<{ id: string; label: string; status: string; detail?: string }> = [];

  try {
    const result = await runOrchestrator({
      owner,
      repo,
      githubToken,
      description,
      logger,
      onStep: (step) => {
        // Update or add step
        const existing = steps.find((s) => s.id === step.id);
        if (existing) {
          existing.label = step.label;
          existing.status = step.status;
          existing.detail = step.detail;
        } else {
          steps.push({ ...step });
        }
      },
    });

    // ── Consume Credit (only after successful generation) ─────────────────
    if (!isPro) {
      try {
        await consumeOneShipCredit(customerId, email);
      } catch (err) {
        // Log but don't fail — user already got their result
        logger.error("Failed to consume ship credit", { customerId }, err);
      }
    }

    const creditsRemaining = isPro ? null : Math.max(0, credits - 1);

    logger.info("Agent run completed", {
      owner,
      repo,
      provider: result.provider,
      isPro,
      creditsBefore: credits,
      creditsRemaining,
    });

    return Response.json({
      ...result,
      steps,
      creditsRemaining,
      plan: isPro ? "pro" : "credit",
      requestId,
    });
  } catch (error) {
    logger.error("Agent orchestrator failed", { owner, repo }, error);
    return Response.json(
      {
        error: "AI generation failed. Please try again.",
        steps,
        requestId,
      },
      { status: 500 }
    );
  }
}
