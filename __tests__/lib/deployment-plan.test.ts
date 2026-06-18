import { describe, expect, it } from "vitest";
import { generateDeploymentPlan } from "@/lib/generators/deployment-plan";
import type { RepoAnalysis } from "@/types";

const baseAnalysis: RepoAnalysis = {
  framework: "Next.js",
  packageManager: "npm",
  backendType: "Frontend",
  hasDocker: false,
  hasReadme: true,
  hasEnvExample: false,
  lockfile: "package-lock.json",
  envVarsDetected: ["DATABASE_URL", "NEXTAUTH_SECRET"],
  buildScript: "next build",
  startScript: "next start",
  testScript: "vitest run",
  missingConfigs: [],
  deploymentIssues: [
    {
      severity: "warning",
      title: "Environment variables need documentation",
      detail: "Environment variables were found, but no .env.example file exists.",
      fix: "Add .env.example with placeholder values for every required variable.",
      file: ".env.example",
    },
  ],
  recommendedActions: ["Add .env.example with placeholder values for every required variable."],
  readinessSummary: "Next.js app using npm; likely deployable after 1 warning is reviewed.",
  deploymentRiskScore: 12,
  description: "Next.js project with npm and Frontend",
};

describe("generateDeploymentPlan", () => {
  it("includes readiness, issues, and environment variables", () => {
    const plan = generateDeploymentPlan("vpkdevs", "shipwright", baseAnalysis);

    expect(plan).toContain("# Shipwright Deployment Plan for vpkdevs/shipwright");
    expect(plan).toContain(baseAnalysis.readinessSummary);
    expect(plan).toContain("Environment variables need documentation");
    expect(plan).toContain("`DATABASE_URL`");
    expect(plan).toContain("## Fastest Revenue Path");
    expect(plan).toContain("launch-readiness cleanup");
    expect(plan).toContain("npm run build");
    expect(plan).toContain("npm run start");
  });

  it("handles repos with no detected issues", () => {
    const plan = generateDeploymentPlan("vpkdevs", "ready-app", {
      ...baseAnalysis,
      hasEnvExample: true,
      envVarsDetected: [],
      startScript: null,
      deploymentIssues: [],
      recommendedActions: [],
      readinessSummary: "Next.js app using npm; no deployment blockers detected.",
      deploymentRiskScore: 0,
    });

    expect(plan).toContain("No deployment issues detected");
    expect(plan).toContain("No environment variable references detected");
    expect(plan).toContain("deployment activation package");
    expect(plan).toContain("Add a start script before testing production startup");
  });
});
