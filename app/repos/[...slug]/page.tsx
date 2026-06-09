"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import type { DeploymentIssue, GeneratedContent, RepoAnalysis } from "@/types";

interface PRResult {
  url: string;
  number: number;
  title: string;
}

const PREVIEW_TABS = ["overview", "plan", "readme", "landing", "config"] as const;

type PreviewTab = (typeof PREVIEW_TABS)[number];
type CheckoutPlan = "credit" | "pro";

interface PaymentPrompt {
  message: string;
}

export default function RepoPage() {
  const router = useRouter();
  const params = useParams();
  const [analysis, setAnalysis] = useState<RepoAnalysis | null>(null);
  const [generated, setGenerated] = useState<GeneratedContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [generationError, setGenerationError] = useState("");
  const [activeTab, setActiveTab] = useState<PreviewTab>("overview");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [prResult, setPRResult] = useState<PRResult | null>(null);
  const [prError, setPRError] = useState("");
  const [paymentPrompt, setPaymentPrompt] = useState<PaymentPrompt | null>(null);
  const [checkoutPlan, setCheckoutPlan] = useState<CheckoutPlan | null>(null);
  const [checkoutError, setCheckoutError] = useState("");

  const slug = params?.slug;
  const owner = Array.isArray(slug) && slug.length === 2 ? slug[0] : undefined;
  const repo = Array.isArray(slug) && slug.length === 2 ? slug[1] : undefined;
  const repoFullName = owner && repo ? `${owner}/${repo}` : "";
  const repoPath =
    owner && repo ? `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}` : "/repos";

  useEffect(() => {
    if (!owner || !repo) {
      setError("Invalid repository URL");
      setIsLoading(false);
      return;
    }

    const analyze = async () => {
      try {
        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ owner, repo }),
        });

        if (!res.ok) {
          if (res.status === 401) {
            router.push("/");
            return;
          }
          throw new Error("Failed to analyze");
        }

        const data = await res.json();
        setAnalysis(data);
      } catch (err) {
        setError("Failed to analyze repository");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    analyze();
  }, [owner, repo, router]);

  const issueCounts = useMemo(() => {
    const issues = analysis?.deploymentIssues ?? [];
    return {
      blocker: issues.filter((issue) => issue.severity === "blocker").length,
      warning: issues.filter((issue) => issue.severity === "warning").length,
      info: issues.filter((issue) => issue.severity === "info").length,
    };
  }, [analysis]);

  const handleGenerate = async () => {
    if (!owner || !repo || isGenerating) return;

    setIsGenerating(true);
    setGenerationError("");
    setPaymentPrompt(null);
    setCheckoutError("");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo }),
      });

      if (res.status === 402) {
        const data = await res.json().catch(() => null);
        setPaymentPrompt({
          message:
            data?.message || "You need a Ship Credit or Pro subscription to generate artifacts.",
        });
        return;
      }

      if (!res.ok) throw new Error("Failed to generate");

      const data = await res.json();
      setGenerated(data);
      setActiveTab("plan");
      setGenerationError("");
    } catch (err) {
      setGenerationError("Failed to generate content");
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCheckout = async (plan: CheckoutPlan) => {
    if (!owner || !repo || checkoutPlan) return;

    setCheckoutPlan(plan);
    setCheckoutError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, repoFullName, successPath: repoPath }),
      });

      if (res.status === 401) {
        setCheckoutPlan(null);
        window.location.href = "/api/auth/signin/github";
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Checkout failed");
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Checkout failed");
      setCheckoutPlan(null);
    }
  };

  const handlePreviewTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, tab: PreviewTab) => {
    const currentIndex = PREVIEW_TABS.indexOf(tab);
    let nextIndex: number | null = null;

    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % PREVIEW_TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex = (currentIndex - 1 + PREVIEW_TABS.length) % PREVIEW_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = PREVIEW_TABS.length - 1;
    }

    if (nextIndex === null) return;

    event.preventDefault();
    const nextTab = PREVIEW_TABS[nextIndex];
    setActiveTab(nextTab);
    requestAnimationFrame(() => {
      document.getElementById(getPreviewTabId(nextTab))?.focus();
    });
  };

  const handleCreatePR = async () => {
    if (!owner || !repo || !generated || isCreatingPR) return;

    setIsCreatingPR(true);
    setPRError("");

    const files: Array<{ path: string; content: string }> = [];

    if (generated.vercelJson) {
      files.push({ path: "vercel.json", content: generated.vercelJson });
    }
    if (generated.envTemplate) {
      files.push({ path: ".env.example", content: generated.envTemplate });
    }
    if (generated.readme) {
      files.push({ path: "README.md", content: generated.readme });
    }
    if (generated.deploymentPlan) {
      files.push({ path: "SHIPWRIGHT_DEPLOYMENT_PLAN.md", content: generated.deploymentPlan });
    }
    if (generated.packageJson) {
      files.push({ path: "package.json", content: generated.packageJson });
    }
    if (generated.ciWorkflow) {
      files.push({
        path: ".github/workflows/shipwright-deployment-checks.yml",
        content: generated.ciWorkflow,
      });
    }
    if (generated.landingPage) {
      files.push({ path: "landing/index.html", content: generated.landingPage });
    }
    if (!generated.packageJson && Object.keys(generated.packageJsonScripts).length > 0) {
      files.push({
        path: "shipwright-scripts.json",
        content: JSON.stringify({ scripts: generated.packageJsonScripts }, null, 2),
      });
    }

    try {
      const res = await fetch("/api/create-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner, repo, files }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to create PR");
      }

      const data = await res.json();
      setPRResult(data);
    } catch (err) {
      setPRError(err instanceof Error ? err.message : "Failed to create pull request");
      console.error(err);
    } finally {
      setIsCreatingPR(false);
    }
  };

  if (isLoading) {
    return (
      <main className="min-h-screen">
        <RepoNav repoName={repo || "Repository"} />
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="work-surface p-5">
            <p className="section-label mb-2">Analysis</p>
            <p className="text-muted">Scanning repository structure and deployment signals...</p>
          </div>
        </div>
      </main>
    );
  }

  if (!analysis) {
    return (
      <main className="min-h-screen">
        <RepoNav repoName={repo || "Repository"} />
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="work-surface p-8">
            <p className="mb-4 font-semibold text-[color:var(--blocker)]">
              {error || "Repository not found"}
            </p>
            <Link href="/repos" className="btn-secondary">
              Back to repos
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <RepoNav repoName={repo || "Repository"} />

      <div className="mx-auto max-w-6xl px-6 py-8">
        <section className="mb-6 grid gap-5 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="section-label mb-3">{owner}</p>
            <h1 className="mb-3 text-4xl font-semibold">{repo}</h1>
            <p className="text-muted max-w-3xl">{analysis.readinessSummary}</p>
          </div>

          <div className="work-surface grid grid-cols-3 divide-x divide-[color:var(--line)]">
            <Metric label="Risk" value={`${analysis.deploymentRiskScore}%`} />
            <Metric label="Blockers" value={String(issueCounts.blocker)} tone="blocker" />
            <Metric label="Warnings" value={String(issueCounts.warning)} tone="warning" />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <div className="work-surface p-5">
              <p className="section-label mb-4">Stack facts</p>
              <Fact label="Framework" value={analysis.framework} />
              <Fact label="Package manager" value={analysis.packageManager} />
              <Fact label="Lockfile" value={analysis.lockfile || "Not detected"} />
              <Fact label="Backend" value={analysis.backendType} />
              <Fact label="Docker" value={analysis.hasDocker ? "Present" : "Not detected"} />
              <Fact
                label="Environment example"
                value={analysis.hasEnvExample ? "Present" : "Not detected"}
              />
            </div>

            <div className="work-surface p-5">
              <p className="section-label mb-4">Deployment issues</p>
              {analysis.deploymentIssues.length > 0 ? (
                <div className="space-y-3">
                  {analysis.deploymentIssues.map((issue, idx) => (
                    <IssueItem
                      key={`${issue.severity}-${issue.title}-${issue.file ?? idx}`}
                      issue={issue}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-muted text-sm">No deployment issues detected.</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={isGenerating || !!generated || checkoutPlan !== null}
              className="btn-primary w-full py-3"
            >
              {isGenerating
                ? "Generating artifacts..."
                : generated
                  ? "Artifacts generated"
                  : "Generate artifacts"}
            </button>
            {generationError && (
              <p className="text-sm text-[color:var(--blocker)]" role="alert">
                {generationError}
              </p>
            )}
            {paymentPrompt && (
              <CheckoutPanel
                prompt={paymentPrompt}
                repoFullName={repoFullName}
                checkoutPlan={checkoutPlan}
                checkoutError={checkoutError}
                onCheckout={handleCheckout}
              />
            )}
          </aside>

          <section>
            {!generated ? (
              <div className="work-surface p-8">
                {paymentPrompt ? (
                  <RevenueMoment
                    repoFullName={repoFullName}
                    checkoutPlan={checkoutPlan}
                    onCheckout={handleCheckout}
                  />
                ) : (
                  <>
                    <p className="section-label mb-3">Generated artifacts</p>
                    <h2 className="mb-3 text-2xl font-semibold">No generated files yet.</h2>
                    <p className="text-muted max-w-2xl">
                      Generate artifacts after reviewing the deployment diagnosis. Shipwright will
                      prepare a deployment plan, environment template, config, README, and PR
                      payload.
                    </p>
                    {generationError && (
                      <p className="mt-4 text-sm text-[color:var(--blocker)]" role="alert">
                        {generationError}
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <>
                <div
                  className="mb-4 flex flex-wrap gap-2 border-b border-[color:var(--line)] pb-3"
                  role="tablist"
                  aria-label="Generated artifact previews"
                >
                  {PREVIEW_TABS.map((tab) => (
                    <button
                      type="button"
                      key={tab}
                      id={getPreviewTabId(tab)}
                      role="tab"
                      aria-selected={activeTab === tab}
                      aria-controls={getPreviewPanelId(tab)}
                      tabIndex={activeTab === tab ? 0 : -1}
                      onClick={() => setActiveTab(tab)}
                      onKeyDown={(event) => handlePreviewTabKeyDown(event, tab)}
                      className={`rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
                        activeTab === tab
                          ? "bg-[color:var(--accent)] text-white"
                          : "text-[color:var(--ink-muted)] hover:bg-[color:rgb(36_81_90_/_0.08)]"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div
                  className="work-surface p-5"
                  role="tabpanel"
                  id={getPreviewPanelId(activeTab)}
                  aria-labelledby={getPreviewTabId(activeTab)}
                >
                  <PreviewContent activeTab={activeTab} generated={generated} />
                </div>

                <PRPanel
                  prResult={prResult}
                  prError={prError}
                  isCreatingPR={isCreatingPR}
                  onCreatePR={handleCreatePR}
                />
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function CheckoutPanel({
  prompt,
  repoFullName,
  checkoutPlan,
  checkoutError,
  onCheckout,
}: {
  prompt: PaymentPrompt;
  repoFullName: string;
  checkoutPlan: CheckoutPlan | null;
  checkoutError: string;
  onCheckout: (plan: CheckoutPlan) => void;
}) {
  return (
    <div className="work-surface border-[color:var(--accent)] p-5">
      <p className="section-label mb-2">Unlock generation</p>
      <h2 className="mb-2 text-lg font-semibold">{repoFullName}</h2>
      <p className="text-muted mb-4 text-sm">{prompt.message}</p>
      <CheckoutActions
        checkoutPlan={checkoutPlan}
        creditLabel="Buy 1 Ship Credit - $5"
        onCheckout={onCheckout}
        proLabel="Go Pro - unlimited repos"
      />
      {checkoutError && (
        <p className="mt-3 text-sm text-[color:var(--blocker)]" role="alert">
          {checkoutError}
        </p>
      )}
    </div>
  );
}

function RevenueMoment({
  repoFullName,
  checkoutPlan,
  onCheckout,
}: {
  repoFullName: string;
  checkoutPlan: CheckoutPlan | null;
  onCheckout: (plan: CheckoutPlan) => void;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px] lg:items-start">
      <div>
        <p className="section-label mb-3">Ready to generate</p>
        <h2 className="mb-3 text-3xl font-semibold leading-tight">
          Turn this diagnosis into a pull request.
        </h2>
        <p className="text-muted max-w-2xl">
          Shipwright already found the deployment shape for {repoFullName}. Unlock the artifact run
          to generate the deployment plan, config files, README, landing page, and PR payload.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {["Deployment plan", "Config patch", "Reviewable PR"].map((label) => (
            <div key={label} className="rounded-md border border-[color:var(--line)] p-3">
              <p className="font-semibold">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-[color:var(--line)] bg-[color:rgb(36_81_90_/_0.06)] p-4">
        <p className="section-label mb-2">Best next move</p>
        <p className="mb-4 text-sm text-[color:var(--ink-muted)]">
          One credit is fastest for this repo. Pro makes sense if you are clearing a backlog.
        </p>
        <CheckoutActions
          checkoutPlan={checkoutPlan}
          creditLabel="Generate this repo - $5"
          onCheckout={onCheckout}
          proLabel="Unlock unlimited - $15/mo"
        />
      </div>
    </div>
  );
}

function CheckoutActions({
  checkoutPlan,
  creditLabel,
  proLabel,
  onCheckout,
}: {
  checkoutPlan: CheckoutPlan | null;
  creditLabel: string;
  proLabel: string;
  onCheckout: (plan: CheckoutPlan) => void;
}) {
  return (
    <div className="grid gap-2">
      <button
        type="button"
        onClick={() => onCheckout("credit")}
        disabled={checkoutPlan !== null}
        className="btn-primary w-full py-3"
      >
        {checkoutPlan === "credit" ? "Opening checkout..." : creditLabel}
      </button>
      <button
        type="button"
        onClick={() => onCheckout("pro")}
        disabled={checkoutPlan !== null}
        className="btn-secondary w-full py-3"
      >
        {checkoutPlan === "pro" ? "Opening checkout..." : proLabel}
      </button>
    </div>
  );
}

function RepoNav({ repoName }: { repoName: string }) {
  return (
    <nav className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[color:rgb(244_243_238_/_0.9)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/repos" className="text-lg font-semibold">
          Back to repos / {repoName}
        </Link>
        <a href="/api/auth/signout" className="btn-secondary">
          Sign out
        </a>
      </div>
    </nav>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "blocker" | "warning";
}) {
  const toneClass =
    tone === "blocker" ? "severity-blocker" : tone === "warning" ? "severity-warning" : "";

  return (
    <div className="p-4">
      <p className="section-label mb-1">{label}</p>
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[color:var(--line)] py-3 first:border-t-0 first:pt-0 last:pb-0">
      <p className="section-label mb-1">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function IssueItem({ issue }: { issue: DeploymentIssue }) {
  const tone =
    issue.severity === "blocker"
      ? "severity-blocker"
      : issue.severity === "warning"
        ? "severity-warning"
        : "severity-info";

  return (
    <div className="rounded-md border border-[color:var(--line)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`text-xs font-semibold uppercase ${tone}`}>{issue.severity}</span>
        {issue.file && (
          <code className="rounded bg-[color:rgb(24_26_31_/_0.07)] px-1.5 py-0.5 text-xs">
            {issue.file}
          </code>
        )}
      </div>
      <p className="font-semibold">{issue.title}</p>
      <p className="text-muted mt-1 text-sm">{issue.fix}</p>
    </div>
  );
}

function PreviewContent({
  activeTab,
  generated,
}: {
  activeTab: PreviewTab;
  generated: GeneratedContent;
}) {
  if (activeTab === "overview") {
    return (
      <div className="space-y-5">
        <ArtifactPreview title="vercel.json" content={generated.vercelJson || "Not applicable"} />
        <ArtifactPreview
          title=".github/workflows/shipwright-deployment-checks.yml"
          content={generated.ciWorkflow || "Not applicable for this repository."}
        />
        <ArtifactPreview title=".env.example" content={generated.envTemplate} />
      </div>
    );
  }

  if (activeTab === "plan") {
    return (
      <ArtifactPreview
        title="SHIPWRIGHT_DEPLOYMENT_PLAN.md"
        content={generated.deploymentPlan}
        tall
      />
    );
  }

  if (activeTab === "readme") {
    return <ArtifactPreview title="README.md" content={generated.readme} tall />;
  }

  if (activeTab === "landing") {
    const content =
      generated.landingPage.length > 1400
        ? `${generated.landingPage.substring(0, 1400)}\n... truncated preview`
        : generated.landingPage;
    return <ArtifactPreview title="landing/index.html" content={content} tall />;
  }

  return (
    <ArtifactPreview
      title={generated.packageJson ? "package.json" : "Suggested package scripts"}
      content={
        generated.packageJson ||
        (Object.keys(generated.packageJsonScripts).length > 0
          ? JSON.stringify(generated.packageJsonScripts, null, 2)
          : "No missing scripts detected.")
      }
    />
  );
}

function getPreviewTabId(tab: PreviewTab) {
  return `preview-tab-${tab}`;
}

function getPreviewPanelId(tab: PreviewTab) {
  return `preview-panel-${tab}`;
}

function ArtifactPreview({
  title,
  content,
  tall = false,
}: {
  title: string;
  content: string;
  tall?: boolean;
}) {
  return (
    <div>
      <p className="section-label mb-2">{title}</p>
      <pre
        className={`code-panel overflow-x-auto whitespace-pre-wrap ${tall ? "max-h-[520px]" : "max-h-72"}`}
      >
        {content}
      </pre>
    </div>
  );
}

function PRPanel({
  prResult,
  prError,
  isCreatingPR,
  onCreatePR,
}: {
  prResult: PRResult | null;
  prError: string;
  isCreatingPR: boolean;
  onCreatePR: () => void;
}) {
  if (prResult) {
    return (
      <div className="mt-5 rounded-md border border-[color:var(--success)] bg-green-50 p-4">
        <p className="font-semibold text-[color:var(--success)]">Pull request created</p>
        <p className="text-muted mt-1 text-sm">
          PR #{prResult.number}: {prResult.title}
        </p>
        <a
          href={prResult.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary mt-4"
        >
          View pull request
        </a>
      </div>
    );
  }

  return (
    <div className="mt-5">
      {prError && <p className="mb-3 text-sm text-[color:var(--blocker)]">{prError}</p>}
      <button
        type="button"
        onClick={onCreatePR}
        disabled={isCreatingPR}
        className="btn-primary w-full py-3"
      >
        {isCreatingPR ? "Creating pull request..." : "Create pull request"}
      </button>
    </div>
  );
}
