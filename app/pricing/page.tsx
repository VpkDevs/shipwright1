"use client";

import Link from "next/link";
import { useState } from "react";

const PLANS = [
  {
    id: "credit",
    name: "Ship Credit",
    price: "$5",
    period: "one-time",
    description: "A low-friction way to ship one repo without starting a subscription.",
    features: [
      "Free analysis before purchase",
      "One repo generation",
      "Deployment plan and README",
      "Vercel config and env template",
      "GitHub pull request payload",
    ],
    cta: "Buy credit",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "$15",
    period: "per month",
    description: "The default plan for builders clearing a backlog of unfinished projects.",
    features: [
      "Unlimited repo generations",
      "Deployment plan and README",
      "Vercel config and env template",
      "GitHub pull request payload",
      "Priority processing",
    ],
    cta: "Start Pro",
    highlighted: true,
  },
  {
    id: "proAnnual",
    name: "Pro Annual",
    price: "$150",
    period: "per year",
    description: "The monthly plan with two months removed from the bill.",
    features: [
      "Unlimited repo generations",
      "Deployment plan and README",
      "Vercel config and env template",
      "GitHub pull request payload",
      "Priority processing",
      "Lower annual cost",
    ],
    cta: "Start annual",
    highlighted: false,
  },
  {
    id: "team",
    name: "Team",
    price: "$250",
    period: "per month",
    description: "Shared shipping capacity for studios, agencies, and internal tool teams.",
    features: [
      "Everything in Pro",
      "Up to 10 team members",
      "Shared repo history",
      "Priority support",
    ],
    cta: "Start Team",
    highlighted: false,
  },
];

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleCheckout = async (planId: string) => {
    setLoading(planId);
    setError("");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      if (res.status === 401) {
        window.location.href = "/api/auth/signin/github";
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Checkout failed");
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  };

  return (
    <main className="min-h-screen">
      <CommercialNav />

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div>
            <p className="section-label mb-3">Billing</p>
            <h1 className="mb-3 max-w-3xl text-4xl font-semibold">
              Free repo scans. Credits or subscriptions when you generate.
            </h1>
            <p className="text-muted max-w-2xl">
              Analyze first, then choose a one-off Ship Credit or a subscription when you want
              Shipwright to create deployment artifacts and a PR-ready plan.
            </p>
          </div>

          <div className="work-surface p-5">
            <p className="section-label mb-3">How billing works</p>
            <ul className="space-y-3 text-sm">
              <li>Repository analysis is free so you can see blockers before paying.</li>
              <li>Credits are consumed only after a successful generation.</li>
              <li>Subscriptions unlock ongoing generation for active builders.</li>
              <li>Card data is handled by Stripe, not stored by Shipwright.</li>
            </ul>
          </div>
        </div>

        {error && (
          <div
            className="mb-6 rounded-md border border-[color:var(--blocker)] bg-red-50 p-4 text-sm text-[color:var(--blocker)]"
            role="alert"
          >
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <section
              key={plan.id}
              className={`work-surface flex min-h-[430px] flex-col p-5 ${
                plan.highlighted ? "ring-2 ring-[color:rgb(36_81_90_/_0.32)]" : ""
              }`}
              aria-label={`${plan.name} pricing plan`}
            >
              <div className="mb-5 min-h-[132px]">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h2 className="text-xl font-semibold">{plan.name}</h2>
                  {plan.highlighted && (
                    <span className="rounded-md bg-[color:rgb(36_81_90_/_0.1)] px-2 py-1 text-xs font-semibold text-[color:var(--accent)]">
                      Default
                    </span>
                  )}
                </div>
                <p className="mb-4 text-sm text-muted">{plan.description}</p>
                <p>
                  <span className="text-3xl font-semibold">{plan.price}</span>
                  <span className="ml-2 text-sm text-muted">{plan.period}</span>
                </p>
              </div>

              <ul className="mb-6 flex-1 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="severity-success font-semibold" aria-hidden="true">
                      +
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => handleCheckout(plan.id)}
                disabled={loading !== null}
                className={plan.highlighted ? "btn-primary w-full" : "btn-secondary w-full"}
              >
                {loading === plan.id ? "Opening Stripe..." : plan.cta}
              </button>
            </section>
          ))}
        </div>

        <footer className="mt-10 border-t border-[color:var(--line)] pt-5 text-sm text-muted">
          <p>
            Questions or refund requests:{" "}
            <a
              href="mailto:vincekinney1991@gmail.com"
              className="font-semibold text-[color:var(--accent)]"
            >
              vincekinney1991@gmail.com
            </a>
          </p>
          <p className="mt-2">
            Purchases are governed by the{" "}
            <Link href="/terms" className="font-semibold text-[color:var(--accent)]">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-[color:var(--accent)]">
              Privacy Policy
            </Link>
            .
          </p>
        </footer>
      </section>
    </main>
  );
}

function CommercialNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[color:rgb(244_243_238_/_0.9)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-xl font-semibold">
          Shipwright
        </Link>
        <Link href="/repos" className="btn-secondary">
          My repos
        </Link>
      </div>
    </nav>
  );
}
