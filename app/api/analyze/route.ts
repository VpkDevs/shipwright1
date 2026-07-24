import { RepoAnalyzer } from "@/lib/analyzer";
import { authOptions } from "@/lib/auth";
import { createLogger, generateRequestId } from "@/lib/logger";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { getServerSession } from "next-auth";
import { z } from "zod";

const analyzeSchema = z.object({
  owner: z.string().trim().min(1).max(100),
  repo: z.string().trim().min(1).max(100),
});

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const logger = createLogger({
    requestId,
    route: "POST /api/analyze",
  });

  // Rate limiting check
  const headers = request.headers;
  const clientIp = getClientIp(headers);
  const rateLimitKey = `analyze:${clientIp}`;
  const rateLimitResult = await checkRateLimitAsync(rateLimitKey, "analyze");

  if (!rateLimitResult.allowed) {
    logger.warn("Analyze request rate limited", { clientIp });
    return rateLimitResponse(rateLimitResult.remaining, rateLimitResult.reset);
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.accessToken) {
    logger.warn("Unauthorized analyze request: missing GitHub access token");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("Analyze request received invalid JSON", {
        error: error instanceof Error ? error.message : String(error),
      });
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { owner, repo } = analyzeSchema.parse(body);

    const token = session.user.accessToken;
    const analyzer = new RepoAnalyzer(token);

    logger.info("Analyzing repository", { owner, repo });

    const analysis = await analyzer.analyze(owner, repo);

    logger.info("Repository analysis succeeded", {
      owner,
      repo,
      framework: analysis.framework,
      backendType: analysis.backendType,
      deploymentRiskScore: analysis.deploymentRiskScore,
    });

    return Response.json(analysis);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    logger.error("Failed to analyze repo", undefined, error);
    return Response.json({ error: "Failed to analyze repository" }, { status: 500 });
  }
}
