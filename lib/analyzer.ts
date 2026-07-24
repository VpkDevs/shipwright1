import type { DeploymentIssue, RepoAnalysis } from "@/types";
import { GitHubClient } from "./github";

export interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  packageManager?: string;
  engines?: Record<string, string>;
}

export interface RepoAnalysisContext {
  packageJson: PackageJson | null;
  fileTree: string[];
  readme: string | null;
  dependencies: string[];
}

const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx|mjs|cjs|vue|svelte|astro)$/;
const IGNORED_PATH_PARTS = [
  "node_modules/",
  ".next/",
  "dist/",
  "build/",
  "coverage/",
  ".turbo/",
  ".vercel/",
];
const SOURCE_FILE_SCAN_CONCURRENCY = 5;
const DEFAULT_NPM_TEST_SCRIPT = 'echo "Error: no test specified" && exit 1';

export function getUsableTestScript(script: string | undefined): string | null {
  if (!script) {
    return null;
  }

  return script.trim() === DEFAULT_NPM_TEST_SCRIPT ? null : script;
}

export class RepoAnalyzer {
  private client: GitHubClient;

  constructor(token: string) {
    this.client = new GitHubClient(token);
  }

  async analyze(owner: string, repo: string): Promise<RepoAnalysis> {
    const [packageJson, hasDocker, envVarsFromFiles, fileList] = await Promise.all([
      this.getPackageJson(owner, repo),
      this.hasDockerfile(owner, repo),
      this.detectEnvVars(owner, repo),
      this.getFileList(owner, repo),
    ]);

    const framework = this.detectFramework(packageJson);
    const envVarsFromSource = await this.detectEnvVarsFromSource(owner, repo, fileList);
    const envVars = Array.from(new Set([...envVarsFromFiles, ...envVarsFromSource])).sort();
    const lockfile = this.detectLockfile(fileList, packageJson);
    const packageManager = this.detectPackageManager(packageJson, lockfile);
    const backendType = this.detectBackendType(packageJson);
    const buildScript = packageJson?.scripts?.build || null;
    const startScript = packageJson?.scripts?.start || null;
    const testScript = getUsableTestScript(packageJson?.scripts?.test);
    const hasReadme = this.hasReadmeFile(fileList);
    const hasEnvExample = this.hasEnvExampleFile(fileList);
    const missingConfigs = this.checkMissingConfigs(packageJson, framework, hasDocker, fileList);
    const deploymentIssues = this.buildDeploymentIssues({
      packageJson,
      framework,
      hasDocker,
      hasEnvExample,
      hasReadme,
      lockfile,
      envVars,
      buildScript,
      startScript,
      missingConfigs,
    });
    const recommendedActions = this.buildRecommendedActions(deploymentIssues, framework);
    const readinessSummary = this.buildReadinessSummary(
      deploymentIssues,
      framework,
      packageManager
    );

    const riskScore = this.calculateRiskScore(deploymentIssues);

    return {
      framework,
      packageManager,
      backendType,
      hasDocker,
      hasReadme,
      hasEnvExample,
      lockfile,
      envVarsDetected: envVars,
      buildScript,
      startScript,
      testScript,
      missingConfigs,
      deploymentIssues,
      recommendedActions,
      readinessSummary,
      deploymentRiskScore: riskScore,
      description: `${framework} project with ${packageManager} and ${backendType}`,
    };
  }

  async getAnalysisContext(owner: string, repo: string): Promise<RepoAnalysisContext> {
    const [packageJson, fileTree, readme] = await Promise.all([
      this.getPackageJson(owner, repo),
      this.getFileList(owner, repo),
      this.getReadme(owner, repo),
    ]);
    const dependencies = packageJson
      ? Object.keys({
          ...(packageJson.dependencies ?? {}),
          ...(packageJson.devDependencies ?? {}),
        }).sort()
      : [];

    return {
      packageJson,
      fileTree,
      readme,
      dependencies,
    };
  }

  private async getPackageJson(owner: string, repo: string): Promise<PackageJson | null> {
    try {
      const content = await this.client.getFileContent(owner, repo, "package.json");
      if (!content) return null;
      return JSON.parse(content) as PackageJson;
    } catch {
      return null;
    }
  }

  private async getReadme(owner: string, repo: string): Promise<string | null> {
    for (const path of ["README.md", "README.mdx", "README.txt", "readme.md"]) {
      const content = await this.client.getFileContent(owner, repo, path);
      if (content) return content;
    }

    return null;
  }

  private async getFileList(owner: string, repo: string): Promise<string[]> {
    try {
      const tree = await this.client.getFileTree(owner, repo, 3);
      return tree.map((f) => f.path);
    } catch {
      return [];
    }
  }

  private async hasDockerfile(owner: string, repo: string): Promise<boolean> {
    const dockerfile = await this.client.getFileContent(owner, repo, "Dockerfile");
    return dockerfile !== null;
  }

  private async detectEnvVars(owner: string, repo: string): Promise<string[]> {
    const files = [".env.example", ".env.local", ".env"];
    const vars: Set<string> = new Set();

    for (const file of files) {
      const content = await this.client.getFileContent(owner, repo, file);
      if (content) {
        const lines = content.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          // Skip comments and empty lines
          if (!trimmed || trimmed.startsWith("#")) continue;
          // Match both UPPER_CASE and mixed-case env var names
          const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
          if (match) {
            vars.add(match[1]);
          }
        }
      }
    }

    return Array.from(vars);
  }

  private async detectEnvVarsFromSource(
    owner: string,
    repo: string,
    fileList: string[]
  ): Promise<string[]> {
    const sourceFiles = fileList
      .filter((path) => SOURCE_FILE_PATTERN.test(path))
      .filter((path) => !IGNORED_PATH_PARTS.some((part) => path.includes(part)));
    const vars = new Set<string>();

    await this.eachWithConcurrency(sourceFiles, SOURCE_FILE_SCAN_CONCURRENCY, async (file) => {
      try {
        const content = await this.client.getFileContent(owner, repo, file);
        if (!content) return;

        for (const envVar of this.extractEnvVarsFromSource(content)) {
          vars.add(envVar);
        }
      } catch {
        // Source scanning is best-effort; one unreadable file should not fail analysis.
      }
    });

    return Array.from(vars);
  }

  private async eachWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>
  ): Promise<void> {
    for (let index = 0; index < items.length; index += concurrency) {
      await Promise.all(items.slice(index, index + concurrency).map((item) => worker(item)));
    }
  }

  extractEnvVarsFromSource(content: string): string[] {
    const vars = new Set<string>();
    const patterns = [
      /process\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
      /process\.env\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\]/g,
      /import\.meta\.env\.([A-Za-z_][A-Za-z0-9_]*)/g,
      /Deno\.env\.get\(['"]([A-Za-z_][A-Za-z0-9_]*)['"]\)/g,
    ];

    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) {
        vars.add(match[1]);
      }
    }

    return Array.from(vars);
  }

  private detectFramework(packageJson: PackageJson | null): string {
    if (!packageJson?.dependencies && !packageJson?.devDependencies) {
      return "Unknown";
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.next) return "Next.js";
    if (deps.react) return "React";
    if (deps.vue) return "Vue";
    if (deps.svelte) return "Svelte";
    if (deps.nuxt) return "Nuxt";
    if (deps.gatsby) return "Gatsby";
    if (deps["@remix-run/node"] || deps["@remix-run/react"]) return "Remix";
    if (deps.astro) return "Astro";

    return "Node.js";
  }

  private detectPackageManager(packageJson: PackageJson | null, lockfile: string | null): string {
    // Check packageManager field in package.json (corepack standard)
    if (packageJson?.packageManager) {
      const pm = packageJson.packageManager.toLowerCase();
      if (pm.startsWith("pnpm")) return "pnpm";
      if (pm.startsWith("yarn")) return "yarn";
      if (pm.startsWith("bun")) return "bun";
      if (pm.startsWith("npm")) return "npm";
    }

    if (lockfile === "bun.lock" || lockfile === "bun.lockb") return "bun";
    if (lockfile === "pnpm-lock.yaml") return "pnpm";
    if (lockfile === "yarn.lock") return "yarn";
    if (lockfile === "package-lock.json") return "npm";

    return "npm";
  }

  private detectLockfile(fileList: string[], packageJson: PackageJson | null): string | null {
    const rootFiles = new Set(fileList.filter((path) => !path.includes("/")));

    if (packageJson?.packageManager?.toLowerCase().startsWith("bun") && rootFiles.has("bun.lock")) {
      return "bun.lock";
    }

    for (const lockfile of [
      "bun.lock",
      "bun.lockb",
      "pnpm-lock.yaml",
      "yarn.lock",
      "package-lock.json",
    ]) {
      if (rootFiles.has(lockfile)) return lockfile;
    }

    return null;
  }

  private detectBackendType(packageJson: PackageJson | null): string {
    if (!packageJson?.dependencies && !packageJson?.devDependencies) {
      return "Frontend";
    }

    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps.express) return "Express";
    if (deps.fastify) return "Fastify";
    if (deps["@hapi/hapi"] || deps.hapi) return "Hapi";
    if (deps.koa) return "Koa";
    if (deps["@nestjs/core"]) return "NestJS";

    return "Frontend";
  }

  private checkMissingConfigs(
    packageJson: PackageJson | null,
    framework: string,
    hasDocker: boolean,
    fileList: string[]
  ): string[] {
    const missing: string[] = [];

    if (!packageJson?.scripts?.build) {
      missing.push("build script");
    }
    if (!packageJson?.scripts?.start) {
      missing.push("start script");
    }
    if (!hasDocker && !packageJson?.scripts?.dev) {
      missing.push("dev script");
    }

    if (framework === "Next.js") {
      const hasNextConfig = fileList.some((f) => /^next\.config\.(js|ts|mjs|cjs)$/.test(f));
      if (!hasNextConfig) {
        missing.push("next.config.js");
      }
    }

    return missing;
  }

  private hasReadmeFile(fileList: string[]): boolean {
    return fileList.some((file) => /^readme(\.md|\.mdx|\.txt)?$/i.test(file));
  }

  private hasEnvExampleFile(fileList: string[]): boolean {
    return fileList.some((file) => /^\.env(\.example|\.sample|\.template)$/i.test(file));
  }

  private buildDeploymentIssues(params: {
    packageJson: PackageJson | null;
    framework: string;
    hasDocker: boolean;
    hasEnvExample: boolean;
    hasReadme: boolean;
    lockfile: string | null;
    envVars: string[];
    buildScript: string | null;
    startScript: string | null;
    missingConfigs: string[];
  }): DeploymentIssue[] {
    const issues: DeploymentIssue[] = [];

    if (!params.packageJson) {
      issues.push({
        severity: "blocker",
        title: "No package.json found",
        detail: "Shipwright could not identify this as a Node-based app with installable scripts.",
        fix: "Add a package.json or deploy this repo with a platform-specific adapter.",
        file: "package.json",
      });
      return issues;
    }

    if (!params.buildScript) {
      issues.push({
        severity: "blocker",
        title: "Missing build script",
        detail: "Most deployment platforms need a repeatable build command.",
        fix: "Add a build script to package.json, for example `next build` or `vite build`.",
        file: "package.json",
      });
    }

    if (!params.startScript && params.framework !== "React" && params.framework !== "Vue") {
      issues.push({
        severity: "warning",
        title: "Missing start script",
        detail: "Server-rendered or API-backed apps usually need a production start command.",
        fix: "Add a start script to package.json that runs the production server.",
        file: "package.json",
      });
    }

    if (!params.lockfile) {
      issues.push({
        severity: "warning",
        title: "No lockfile detected",
        detail: "Installs may resolve different dependency versions between local machines and CI.",
        fix: "Commit the lockfile generated by your package manager.",
      });
    }

    if (params.envVars.length > 0 && !params.hasEnvExample) {
      issues.push({
        severity: "warning",
        title: "Environment variables need documentation",
        detail: `${params.envVars.length} environment variable reference${
          params.envVars.length === 1 ? "" : "s"
        } detected, but no .env.example file was found.`,
        fix: "Add .env.example with placeholder values for every required variable.",
        file: ".env.example",
      });
    }

    if (!params.hasReadme) {
      issues.push({
        severity: "info",
        title: "README is missing",
        detail:
          "New users and contributors will not know how to configure, run, or deploy the app.",
        fix: "Add a README with setup, environment variables, build, and deployment notes.",
        file: "README.md",
      });
    }

    if (params.framework === "Next.js" && params.missingConfigs.includes("next.config.js")) {
      issues.push({
        severity: "info",
        title: "No Next.js config detected",
        detail:
          "This is fine for simple apps, but image domains, redirects, and output settings often live here.",
        fix: "Add next.config.js only when the app needs framework-level deployment options.",
        file: "next.config.js",
      });
    }

    if (!params.packageJson.engines?.node) {
      issues.push({
        severity: "info",
        title: "Node version is not pinned",
        detail:
          "Deployment platforms may pick a newer Node runtime than the app was tested against.",
        fix: "Add an engines.node field to package.json once you know the supported runtime.",
        file: "package.json",
      });
    }

    if (!params.hasDocker && params.framework === "Unknown") {
      issues.push({
        severity: "warning",
        title: "Deployment target is unclear",
        detail: "Shipwright could not infer a known web framework or a Docker deployment path.",
        fix: "Add framework dependencies, deployment config, or a Dockerfile.",
      });
    }

    return issues;
  }

  private buildRecommendedActions(issues: DeploymentIssue[], framework: string): string[] {
    const actions = issues.map((issue) => issue.fix);

    if (framework === "Next.js") {
      actions.push(
        "Deploy first to a preview environment and verify routes, auth callbacks, and images."
      );
    } else if (framework === "React" || framework === "Vue") {
      actions.push(
        "Confirm the static output directory matches the hosting platform configuration."
      );
    } else {
      actions.push("Run the generated deployment plan against your target hosting platform.");
    }

    return Array.from(new Set(actions));
  }

  private buildReadinessSummary(
    issues: DeploymentIssue[],
    framework: string,
    packageManager: string
  ): string {
    const blockers = issues.filter((issue) => issue.severity === "blocker").length;
    const warnings = issues.filter((issue) => issue.severity === "warning").length;

    if (blockers > 0) {
      return `${framework} app using ${packageManager}; ${blockers} blocker${
        blockers === 1 ? "" : "s"
      } must be fixed before deployment.`;
    }

    if (warnings > 0) {
      return `${framework} app using ${packageManager}; likely deployable after ${warnings} warning${
        warnings === 1 ? "" : "s"
      } are reviewed.`;
    }

    return `${framework} app using ${packageManager}; no deployment blockers detected.`;
  }

  private calculateRiskScore(issues: DeploymentIssue[]): number {
    let score = 0;

    for (const issue of issues) {
      if (issue.severity === "blocker") score += 30;
      if (issue.severity === "warning") score += 12;
      if (issue.severity === "info") score += 4;
    }

    return Math.min(score, 100);
  }
}
