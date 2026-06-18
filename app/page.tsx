"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/session");
        const session = await res.json();
        setIsLoggedIn(!!session?.user);
      } catch {
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6">
          <div className="work-surface px-6 py-5">
            <p className="section-label mb-2">Session</p>
            <p className="text-muted text-sm">Checking GitHub authentication...</p>
          </div>
        </div>
      </main>
    );
  }

  if (isLoggedIn) {
    return (
      <main className="min-h-screen">
        <TopNav />
        <section className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-8 max-w-3xl">
            <p className="section-label mb-3">Workbench</p>
            <h1 className="mb-3 text-4xl font-semibold text-[color:var(--ink)]">
              Pick a repo. Get the blockers, generated artifacts, and PR payload.
            </h1>
            <p className="text-muted text-lg">
              Shipwright gives every unfinished project the same repeatable launch path: inspect the
              evidence, generate the missing files, then review the pull request before it touches
              production.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <Link
              href="/repos"
              className="work-surface block p-6 transition-colors hover:border-[color:var(--accent)]"
            >
              <div className="mb-12 flex items-start justify-between gap-6">
                <div>
                  <p className="section-label mb-2">Primary queue</p>
                  <h2 className="text-2xl font-semibold">Start a free repo scan</h2>
                </div>
                <span className="rounded-md border border-[color:var(--line)] px-3 py-1 text-sm font-semibold">
                  Open
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {["Detect facts", "Rank blockers", "Generate PR"].map((label, index) => (
                  <div key={label} className="border-t border-[color:var(--line)] pt-3">
                    <p className="section-label mb-1">{String(index + 1).padStart(2, "0")}</p>
                    <p className="font-semibold">{label}</p>
                  </div>
                ))}
              </div>
            </Link>

            <div className="work-surface p-6">
              <p className="section-label mb-3">Operating stance</p>
              <div className="space-y-4 text-sm">
                <StatusLine label="Truth first" value="Show blockers before generated polish" />
                <StatusLine label="Reviewable" value="Every change lands in a PR" />
                <StatusLine label="No magic" value="Inferences stay visible" />
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <TopNav signedOut />

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1fr_440px] lg:items-start">
        <div className="max-w-3xl">
          <p className="section-label mb-4">Free scan. Paid generation.</p>
          <h1 className="mb-6 text-5xl font-semibold leading-[1.02] text-[color:var(--ink)]">
            Turn a neglected GitHub repo into a reviewable deployment PR.
          </h1>
          <p className="text-muted mb-8 max-w-2xl text-xl">
            Shipwright scans the repo, shows exactly what blocks launch, then generates the
            deployment plan, environment template, config, README updates, and PR body needed to
            move from "someday" to reviewable.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href="/api/auth/signin/github" className="btn-primary px-5 py-3">
              Scan a repo free
            </a>
            <Link href="/pricing" className="btn-secondary px-5 py-3">
              Credits and subscriptions
            </Link>
          </div>

          <div className="mt-10 grid gap-3 border-y border-[color:var(--line)] py-5 sm:grid-cols-3">
            {VALUE_STEPS.map((step) => (
              <div key={step.label}>
                <p className="section-label mb-2">{step.label}</p>
                <p className="text-sm font-semibold">{step.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="work-surface p-5">
          <p className="section-label mb-4">What changes</p>
          <h2 className="mb-4 text-2xl font-semibold">
            From unknown launch risk to a concrete PR.
          </h2>
          <div className="space-y-3">
            <SignalRow severity="blocker" title="Missing build script" detail="package.json" />
            <SignalRow
              severity="warning"
              title="Environment variables need documentation"
              detail=".env.example"
            />
            <SignalRow severity="info" title="Node version is not pinned" detail="package.json" />
          </div>
          <div className="mt-6 rounded-md bg-[color:var(--code-bg)] p-4 text-sm text-[color:var(--code-fg)]">
            <p className="mb-2 font-semibold">SHIPWRIGHT_DEPLOYMENT_PLAN.md</p>
            <p className="text-[color:rgb(215_226_223_/_0.78)]">
              Evidence-backed blockers, generated files, verification commands, and PR notes a
              future maintainer can understand.
            </p>
          </div>
        </div>
      </section>

      <section id="system" className="mx-auto max-w-6xl px-6 pb-16">
        <div className="work-surface divide-y divide-[color:var(--line)]">
          {[
            [
              "Repository scan",
              "Detects framework, package manager, lockfile, scripts, Docker, and env usage.",
            ],
            [
              "Launch diagnosis",
              "Separates hard blockers from warnings and labels inferred findings.",
            ],
            [
              "Generation package",
              "Creates the deployment plan, env template, config, docs, and pull request body.",
            ],
          ].map(([title, detail], index) => (
            <div key={title} className="grid gap-3 p-5 md:grid-cols-[96px_1fr]">
              <p className="section-label">{String(index + 1).padStart(2, "0")}</p>
              <div>
                <h2 className="font-semibold">{title}</h2>
                <p className="text-muted text-sm">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const VALUE_STEPS = [
  { label: "Input", value: "A repo you have not shipped yet" },
  { label: "Diagnosis", value: "Blockers ranked by launch impact" },
  { label: "Output", value: "A PR package ready for review" },
];

function TopNav({ signedOut = false }: { signedOut?: boolean }) {
  return (
    <nav className="border-b border-[color:var(--line)] bg-[color:rgb(244_243_238_/_0.86)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-semibold">
          Shipwright
        </Link>
        {signedOut ? (
          <div className="flex items-center gap-2">
            <Link
              href="/pricing"
              className="text-muted text-sm font-semibold hover:text-[color:var(--ink)]"
            >
              Pricing
            </Link>
            <a href="/api/auth/signin/github" className="btn-secondary">
              Sign in
            </a>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/repos" className="btn-secondary">
              Repos
            </Link>
            <a href="/api/auth/signout" className="btn-secondary">
              Sign out
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}

function SignalRow({
  severity,
  title,
  detail,
}: {
  severity: "blocker" | "warning" | "info";
  title: string;
  detail: string;
}) {
  const tone =
    severity === "blocker"
      ? "severity-blocker"
      : severity === "warning"
        ? "severity-warning"
        : "severity-info";

  return (
    <div className="grid grid-cols-[88px_1fr] gap-3 rounded-md border border-[color:var(--line)] p-3">
      <p className={`text-xs font-semibold uppercase ${tone}`}>{severity}</p>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="text-muted text-sm">{detail}</p>
      </div>
    </div>
  );
}

function StatusLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-[color:var(--line)] pt-3 first:border-t-0 first:pt-0">
      <p className="font-semibold">{label}</p>
      <p className="text-muted">{value}</p>
    </div>
  );
}
