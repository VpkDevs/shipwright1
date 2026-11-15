import { describe, expect, it } from "vitest";
import {
  generateDockerfile,
  generateDockerignore,
  shouldGenerateDockerfile,
} from "@/lib/generators/dockerfile";
import type { RepoAnalysis } from "@/types";

const baseServerAnalysis: RepoAnalysis = {
  framework: "Node.js",
  packageManager: "npm",
  backendType: "Express",
  hasDocker: false,
  hasReadme: true,
  hasEnvExample: true,
  lockfile: "package-lock.json",
  envVarsDetected: ["PORT", "DATABASE_URL"],
  buildScript: "tsc -b",
  startScript: "node dist/index.js",
  testScript: null,
  missingConfigs: [],
  deploymentIssues: [],
  recommendedActions: [],
  readinessSummary: "Node.js app using npm; no deployment blockers detected.",
  deploymentRiskScore: 0,
  description: "Node.js project with npm and Express",
};

describe("dockerfile generator", () => {
  it("does not generate when the repo already has a Dockerfile", () => {
    const analysis = { ...baseServerAnalysis, hasDocker: true };
    expect(shouldGenerateDockerfile(analysis)).toBe(false);
    expect(generateDockerfile(analysis)).toBeNull();
    expect(generateDockerignore(analysis)).toBeNull();
  });

  it("does not generate when no package.json was found", () => {
    const analysis = {
      ...baseServerAnalysis,
      deploymentIssues: [
        {
          severity: "blocker" as const,
          title: "No package.json found",
          detail: "Not a Node app.",
          fix: "Add a package.json.",
        },
      ],
    };
    expect(shouldGenerateDockerfile(analysis)).toBe(false);
    expect(generateDockerfile(analysis)).toBeNull();
    expect(generateDockerignore(analysis)).toBeNull();
  });

  it("generates a multi-stage Dockerfile for an npm Express server", () => {
    const dockerfile = generateDockerfile(baseServerAnalysis);
    expect(dockerfile).not.toBeNull();
    expect(dockerfile).toContain("FROM node:22-alpine AS deps");
    expect(dockerfile).toContain("FROM node:22-alpine AS build");
    expect(dockerfile).toContain("FROM node:22-alpine AS runner");
    expect(dockerfile).toContain("npm ci");
    expect(dockerfile).toContain("RUN npm run build");
    expect(dockerfile).toContain("RUN npm prune --omit=dev");
    expect(dockerfile).toContain("ENV NODE_ENV=production");
    expect(dockerfile).toContain("USER node");
    expect(dockerfile).toContain("EXPOSE 3000");
    expect(dockerfile).toContain('CMD ["npm", "start"]');
  });

  it("omits the build step when the server has no build script", () => {
    const dockerfile = generateDockerfile({ ...baseServerAnalysis, buildScript: null });
    expect(dockerfile).not.toBeNull();
    expect(dockerfile).not.toContain("RUN npm run build");
    expect(dockerfile).toContain('CMD ["npm", "start"]');
  });

  it("falls back to the Next.js binary when a Next.js app has no start script", () => {
    const dockerfile = generateDockerfile({
      ...baseServerAnalysis,
      framework: "Next.js",
      backendType: "Frontend",
      buildScript: "next build",
      startScript: null,
    });
    expect(dockerfile).not.toBeNull();
    expect(dockerfile).toContain('CMD ["./node_modules/.bin/next", "start"]');
  });

  it("uses corepack and frozen lockfile installs for pnpm", () => {
    const dockerfile = generateDockerfile({
      ...baseServerAnalysis,
      packageManager: "pnpm",
      lockfile: "pnpm-lock.yaml",
    });
    expect(dockerfile).toContain("RUN corepack enable");
    expect(dockerfile).toContain("pnpm install --frozen-lockfile");
    expect(dockerfile).toContain("COPY package.json pnpm-lock.yaml* ./");
    expect(dockerfile).toContain('CMD ["pnpm", "start"]');
  });

  it("uses the Bun image and runtime for bun projects", () => {
    const dockerfile = generateDockerfile({
      ...baseServerAnalysis,
      packageManager: "bun",
      lockfile: "bun.lock",
    });
    expect(dockerfile).toContain("FROM oven/bun:1 AS deps");
    expect(dockerfile).toContain("bun install --frozen-lockfile");
    expect(dockerfile).toContain("USER bun");
    expect(dockerfile).toContain('CMD ["bun", "run", "start"]');
  });

  it("returns null for a server app with no start script and no known framework entry point", () => {
    const dockerfile = generateDockerfile({
      ...baseServerAnalysis,
      framework: "Node.js",
      backendType: "Express",
      startScript: null,
    });
    expect(dockerfile).toBeNull();
  });

  it("generates an nginx Dockerfile for a Vite-built React app", () => {
    const dockerfile = generateDockerfile({
      ...baseServerAnalysis,
      framework: "React",
      backendType: "Frontend",
      buildScript: "vite build",
      startScript: null,
    });
    expect(dockerfile).not.toBeNull();
    expect(dockerfile).toContain("FROM nginx:alpine AS runner");
    expect(dockerfile).toContain("COPY --from=build /app/dist /usr/share/nginx/html");
    expect(dockerfile).toContain("EXPOSE 80");
  });

  it("uses the CRA build directory for react-scripts apps", () => {
    const dockerfile = generateDockerfile({
      ...baseServerAnalysis,
      framework: "React",
      backendType: "Frontend",
      buildScript: "react-scripts build",
      startScript: null,
    });
    expect(dockerfile).toContain("COPY --from=build /app/build /usr/share/nginx/html");
  });

  it("returns null for a static app with no build script", () => {
    const dockerfile = generateDockerfile({
      ...baseServerAnalysis,
      framework: "Vue",
      backendType: "Frontend",
      buildScript: null,
      startScript: null,
    });
    expect(dockerfile).toBeNull();
  });

  it("generates a .dockerignore that keeps dependencies and secrets out of the build context", () => {
    const dockerignore = generateDockerignore(baseServerAnalysis);
    expect(dockerignore).not.toBeNull();
    expect(dockerignore).toContain("node_modules");
    expect(dockerignore).toContain(".git");
    expect(dockerignore).toContain(".env.*");
    expect(dockerignore).toContain("!.env.example");
  });
});
