import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { RepoAnalyzer } from "@/lib/analyzer";
import { authOptions } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { repositories } from "@/lib/db/schema";
import { RateLimitError, ValidationError } from "@/lib/errors";
import { generateContentWithGemini } from "@/lib/gemini-generator";
import { generateCiWorkflow } from "@/lib/generators/ci-workflow";
import { generateDeploymentPlan } from "@/lib/generators/deployment-plan";
import { generateDockerfile, generateDockerignore } from "@/lib/generators/dockerfile";
import { generateEnvTemplate } from "@/lib/generators/env-template";
import { generateLandingPage } from "@/lib/generators/landing";
import { generateReadme } from "@/lib/generators/readme";
import {
  generatePackageJsonFile,
  generatePackageJsonScripts,
  generateVercelJsonFile,
} from "@/lib/generators/vercel-config";
import { GitHubClient } from "@/lib/github";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  consumeShipCredit,
  getOrCreateCustomer,
  getShipCredits,
  hasActiveProSubscription,
} from "@/lib/stripe";
import { withErrorHandler } from "@/lib/with-error-handler";

const generateSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  repoId: z.string().optional(),
  description: z.string().optional(),
});

export const POST = withErrorHandler(async (request: Request) => {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    throw new ValidationError("auth", "Not authenticated");
  }

  if (!session.user.accessToken) {
    throw new ValidationError("auth", "Missing access token");
  }

  const rateLimitResult = await checkRateLimit(session.user.email, "/api/generate");
  if (!rateLimitResult.success) {
    throw new RateLimitError(rateLimitResult.retryAfter || 60);
  }

  // Payment gate — require credits or active Pro/Team subscription
  const customerId = await getOrCreateCustomer(
    session.user.email,
    session.user.name || session.user.email
  );
  const [hasPro, credits] = await Promise.all([
    hasActiveProSubscription(customerId),
    getShipCredits(customerId),
  ]);

  if (!hasPro && credits <= 0) {
    return Response.json(
      {
        error: "Payment required",
        message: "You need a Ship Credit or Pro subscription to generate content.",
        upgradeUrl: "/pricing",
      },
      { status: 402 }
    );
  }

  const body = await request.json();
  const { owner, repo, repoId, description } = generateSchema.parse(body);

  const analyzer = new RepoAnalyzer(session.user.accessToken);
  const analysis = await analyzer.analyze(owner, repo);

  const db = getDb();

  // Try to load cached analysis from DB
  let cachedRepo: any = null;
  if (repoId) {
    try {
      const [repo] = await db
        .select()
        .from(repositories)
        .where(eq(repositories.github_repo_id, repoId));
      cachedRepo = repo;
    } catch (_e) {
      // DB lookup failed, continue with defaults
    }
  }

  // Generate with Gemini (with fallback to templates)
  const framework = cachedRepo?.framework || (analysis as any).framework || "unknown";
  const deps = (analysis as any).packageJson?.dependencies
    ? Object.keys((analysis as any).packageJson.dependencies).slice(0, 5)
    : [];
  const readinessSummary = cachedRepo?.readinessSummary || "Repository analysis";

  const generated = await generateContentWithGemini(repo, owner, framework, deps, readinessSummary);
  const packageJsonScripts = generatePackageJsonScripts(analysis);
  const github = new GitHubClient(session.user.accessToken);
  const hasPackageJson = !analysis.deploymentIssues.some(
    (issue) => issue.title === "No package.json found"
  );
  const hasGeneratedScripts = Object.keys(packageJsonScripts).length > 0;
  const packageJsonContent =
    hasPackageJson && hasGeneratedScripts
      ? await github.getFileContent(owner, repo, "package.json")
      : null;
  const packageJson = generatePackageJsonFile(packageJsonContent, packageJsonScripts);
  const defaultBranch = hasPackageJson
    ? await github.getDefaultBranch(owner, repo).catch(() => "main")
    : "main";

  // Fallback if Gemini fails
  const finalGenerated = {
    vercelJson: generateVercelJsonFile(analysis),
    dockerfile: generateDockerfile(analysis),
    dockerignore: generateDockerignore(analysis),
    packageJsonScripts,
    packageJson,
    ciWorkflow: hasPackageJson
      ? generateCiWorkflow(analysis, packageJson ? packageJsonScripts : {}, defaultBranch)
      : null,
    envTemplate: generated?.envTemplate || generateEnvTemplate(analysis),
    readme: generated?.readme || generateReadme(repo, analysis, description),
    landingPage:
      generated?.landingPageCopy || generateLandingPage(owner, repo, analysis, description),
    deploymentPlan: generateDeploymentPlan(owner, repo, analysis, description),
  };

  // Consume one credit if user paid per-generation (not on Pro)
  if (!hasPro && credits > 0) {
    await consumeShipCredit(customerId);
  }

  return new Response(JSON.stringify(finalGenerated), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
