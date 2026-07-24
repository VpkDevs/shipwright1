import { RepoAnalyzer } from "@/lib/analyzer";
import { authOptions } from "@/lib/auth";
import { generateEnvTemplate } from "@/lib/generators/env-template";
import { generateLandingPage } from "@/lib/generators/landing";
import { generateReadme } from "@/lib/generators/readme";
import { generatePackageJsonScripts, generateVercelJsonFile } from "@/lib/generators/vercel-config";
import { createLogger, generateRequestId } from "@/lib/logger";
import { checkRateLimitAsync, getClientIp, rateLimitResponse } from "@/lib/rate-limit";
import { normalizeTemplatePack } from "@/lib/template-packs";
import { getServerSession } from "next-auth";
import { z } from "zod";

const generateSchema = z.object({
  owner: z.string().trim().min(1).max(100),
  repo: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  templatePack: z.string().trim().max(32).optional(),
});

/**
 * POST /api/generate
 *
 * Returns FREE template-based generation (no AI, no payment required).
 * This is the "preview" tier — shows users what they'd get so they want
 * to upgrade to AI generation via POST /api/agent.
 */
export async function POST(request: Request) {
  const requestId = generateRequestId();
  const logger = createLogger({
    requestId,
    route: "POST /api/generate",
  });

  // Rate limiting check
  const headers = request.headers;
  const clientIp = getClientIp(headers);
  const rateLimitKey = `generate:${clientIp}`;
  const rateLimitResult = await checkRateLimitAsync(rateLimitKey, "generate");

  if (!rateLimitResult.allowed) {
    logger.warn("Generate request rate limited", { clientIp });
    return rateLimitResponse(rateLimitResult.remaining, rateLimitResult.reset);
  }

  const session = await getServerSession(authOptions);

  if (!session?.user || !(session.user as { accessToken?: string }).accessToken) {
    logger.warn("Unauthorized generate request: missing GitHub access token");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("Generate request received invalid JSON", {
        error: error instanceof Error ? error.message : String(error),
      });
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { owner, repo, description, templatePack: templatePackRaw } = generateSchema.parse(body);
    const templatePack = normalizeTemplatePack(templatePackRaw);

    const token = (session.user as { accessToken?: string }).accessToken;
    if (!token) {
      logger.warn("Generate request missing GitHub access token after auth check");
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const analyzer = new RepoAnalyzer(token);

    logger.info("Starting template-based generation", { owner, repo });

    const analysis = await analyzer.analyze(owner, repo);

    const generated = {
      vercelJson: generateVercelJsonFile(analysis),
      packageJsonScripts: generatePackageJsonScripts(analysis),
      envTemplate: generateEnvTemplate(analysis),
      readme: generateReadme(repo, analysis, description, templatePack),
      landingPage: generateLandingPage(repo, analysis, description, templatePack),
      templatePack,
      /** Flag so the UI knows this is template-based, not AI */
      isAI: false,
    };

    logger.info("Template-based generation completed", {
      owner,
      repo,
      framework: analysis.framework,
      backendType: analysis.backendType,
      deploymentRiskScore: analysis.deploymentRiskScore,
    });

    return Response.json(generated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid request parameters" }, { status: 400 });
    }

    logger.error("Failed to generate template content", undefined, error);
    return Response.json({ error: "Failed to generate content" }, { status: 500 });
  }
}
