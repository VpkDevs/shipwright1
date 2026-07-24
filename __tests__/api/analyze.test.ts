import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepoAnalysis } from "@/types";

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  checkRateLimit: vi.fn(),
  analyze: vi.fn(),
  getAnalysisContext: vi.fn(),
  enrichAnalysisWithGemini: vi.fn(),
  upsertRepositoryRecord: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
}));

vi.mock("@/lib/analyzer", () => ({
  RepoAnalyzer: vi.fn(function RepoAnalyzerMock() {
    return {
      analyze: mocks.analyze,
      getAnalysisContext: mocks.getAnalysisContext,
    };
  }),
}));

vi.mock("@/lib/gemini-analyzer", () => ({
  enrichAnalysisWithGemini: mocks.enrichAnalysisWithGemini,
}));

vi.mock("@/lib/db/repositories", () => ({
  upsertRepositoryRecord: mocks.upsertRepositoryRecord,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: mocks.warn,
    error: mocks.error,
    debug: vi.fn(),
  }),
  log: {
    warn: mocks.warn,
    error: mocks.error,
  },
}));

const { POST } = await import("@/app/api/analyze/route");

const session = {
  user: {
    id: "12345",
    email: "builder@example.com",
    name: "Builder",
    image: "https://example.com/avatar.png",
    accessToken: "gho_test",
  },
};

const baseAnalysis: RepoAnalysis = {
  framework: "Next.js",
  packageManager: "npm",
  backendType: "Frontend",
  hasDocker: false,
  hasReadme: true,
  hasEnvExample: false,
  lockfile: "package-lock.json",
  envVarsDetected: ["NEXT_PUBLIC_SITE_URL"],
  buildScript: "next build",
  startScript: "next start",
  testScript: "vitest run",
  missingConfigs: [],
  deploymentIssues: [],
  recommendedActions: ["Deploy first to a preview environment."],
  readinessSummary: "Next.js app using npm; no deployment blockers detected.",
  deploymentRiskScore: 4,
  description: "Next.js project with npm and Frontend",
};

function request(body: unknown) {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue(session);
    mocks.checkRateLimit.mockResolvedValue({ success: true });
    mocks.analyze.mockResolvedValue({ ...baseAnalysis, envVarsDetected: ["NEXT_PUBLIC_SITE_URL"] });
    mocks.getAnalysisContext.mockResolvedValue({
      packageJson: { dependencies: { next: "15.5.18" } },
      fileTree: ["package.json", "app/page.tsx", "README.md"],
      readme: "# Example",
      dependencies: ["next"],
    });
    mocks.enrichAnalysisWithGemini.mockResolvedValue(null);
    mocks.upsertRepositoryRecord.mockResolvedValue("repo-uuid");
  });

  it("requires authentication", async () => {
    mocks.getServerSession.mockResolvedValue(null);

    const response = await POST(request({ owner: "vpkdevs", repo: "shipwright" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid auth: Not authenticated");
  });

  it("returns rate limit responses with retry headers", async () => {
    mocks.checkRateLimit.mockResolvedValue({ success: false, retryAfter: 42 });

    const response = await POST(request({ owner: "vpkdevs", repo: "shipwright" }));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(body.retryAfter).toBe(42);
  });

  it("analyzes, enriches, and stores repository metadata", async () => {
    mocks.enrichAnalysisWithGemini.mockResolvedValue({
      framework: "Next.js",
      missingEnvVars: ["DATABASE_URL"],
      readinessSummary: "Next.js app using npm; verify DATABASE_URL before deployment.",
    });

    const response = await POST(
      request({ owner: "vpkdevs", repo: "shipwright", repoId: "987654321" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.analyze).toHaveBeenCalledWith("vpkdevs", "shipwright");
    expect(mocks.enrichAnalysisWithGemini).toHaveBeenCalledWith(
      { dependencies: { next: "15.5.18" } },
      "package.json\napp/page.tsx\nREADME.md",
      "# Example",
      "Next.js"
    );
    expect(body.envVarsDetected).toEqual(["DATABASE_URL", "NEXT_PUBLIC_SITE_URL"]);
    expect(body.readinessSummary).toContain("DATABASE_URL");
    expect(mocks.upsertRepositoryRecord).toHaveBeenCalledWith({
      sessionUser: session.user,
      githubRepoId: "987654321",
      owner: "vpkdevs",
      name: "shipwright",
      framework: "Next.js",
      riskScore: 4,
    });
  });

  it("still returns analysis if repository history persistence fails", async () => {
    mocks.upsertRepositoryRecord.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(
      request({ owner: "vpkdevs", repo: "shipwright", repoId: "987654321" })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.framework).toBe("Next.js");
    expect(mocks.warn).toHaveBeenCalledWith(
      "Repository analysis DB write failed",
      expect.objectContaining({ repoId: "987654321" })
    );
  });
});
