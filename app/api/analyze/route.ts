import { getServerSession } from "next-auth";
import { z } from "zod";
import { RepoAnalyzer } from "@/lib/analyzer";
import { authOptions } from "@/lib/auth";
import { upsertRepositoryRecord } from "@/lib/db/repositories";
import { RateLimitError, ValidationError } from "@/lib/errors";
import { enrichAnalysisWithGemini } from "@/lib/gemini-analyzer";
import { createLogger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { withErrorHandler } from "@/lib/with-error-handler";

const logger = createLogger({ route: "POST /api/analyze" });

const analyzeSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  repoId: z.string().optional(),
});

export const POST = withErrorHandler(async (request: Request) => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new ValidationError("auth", "Not authenticated");
  }

  if (!session.user.accessToken) {
    throw new ValidationError("auth", "Missing access token");
  }

  const rateLimitResult = await checkRateLimit(session.user.email, "/api/analyze");
  if (!rateLimitResult.success) {
    throw new RateLimitError(rateLimitResult.retryAfter || 60);
  }

  const body = await request.json();
  const { owner, repo, repoId } = analyzeSchema.parse(body);

  const analyzer = new RepoAnalyzer(session.user.accessToken);
  const analysis = await analyzer.analyze(owner, repo);
  const context = await analyzer.getAnalysisContext(owner, repo);

  // Enrich with Gemini
  const enrichment = await enrichAnalysisWithGemini(
    context.packageJson ?? {},
    context.fileTree.join("\n"),
    context.readme ?? undefined,
    analysis.framework
  );

  if (enrichment) {
    analysis.framework = enrichment.framework;
    analysis.envVarsDetected = Array.from(
      new Set([...analysis.envVarsDetected, ...enrichment.missingEnvVars])
    ).sort();
    analysis.readinessSummary = enrichment.readinessSummary || analysis.readinessSummary;
  }

  // Save to DB
  if (repoId && session.user.id) {
    try {
      await upsertRepositoryRecord({
        sessionUser: session.user,
        githubRepoId: repoId,
        owner,
        name: repo,
        framework: analysis.framework,
        riskScore: analysis.deploymentRiskScore,
      });
    } catch (error) {
      logger.warn("Repository analysis DB write failed", { error, owner, repo, repoId });
    }
  }

  return new Response(JSON.stringify(analysis), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
