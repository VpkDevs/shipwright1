export type DeploymentIssueSeverity = "blocker" | "warning" | "info";

export interface DeploymentIssue {
  severity: DeploymentIssueSeverity;
  title: string;
  detail: string;
  fix: string;
  file?: string;
}

export interface RepoAnalysis {
  framework: string;
  packageManager: string;
  backendType: string;
  hasDocker: boolean;
  hasReadme: boolean;
  hasEnvExample: boolean;
  lockfile: string | null;
  envVarsDetected: string[];
  buildScript: string | null;
  startScript: string | null;
  testScript: string | null;
  missingConfigs: string[];
  deploymentIssues: DeploymentIssue[];
  recommendedActions: string[];
  readinessSummary: string;
  deploymentRiskScore: number;
  description: string;
}

export interface GeneratedContent {
  vercelJson: string;
  dockerfile: string | null;
  dockerignore: string | null;
  packageJsonScripts: Record<string, string>;
  packageJson: string | null;
  ciWorkflow: string | null;
  envTemplate: string;
  readme: string;
  landingPage: string;
  deploymentPlan: string;
}

// ─── Payment / Billing Types ───────────────────────────────────────────────

/** Access tier returned by the billing status endpoint */
export type PlanType = "none" | "credit" | "pro";

export interface PaymentStatus {
  /** Current plan: none, credit (one-time), or pro/team (subscription) */
  plan: PlanType;
  /** Remaining one-time ship credits (only if plan === "credit") */
  credits: number;
  /** ISO date string for subscription expiry (only if plan === "pro") */
  proExpiresAt?: string;
  /** Stripe customer ID for this user */
  stripeCustomerId?: string;
}
