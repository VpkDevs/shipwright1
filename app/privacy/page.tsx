import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - Shipwright",
  description: "Shipwright Privacy Policy",
};

const retentionRows = [
  ["GitHub profile data", "Until account deletion"],
  [
    "Repository analysis results",
    "Request-time analysis; repository history may store summary metadata",
  ],
  ["API logs", "30 days"],
  ["Payment data", "Handled by Stripe under its retention policy"],
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <LegalNav />

      <article className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8">
          <p className="section-label mb-3">Legal</p>
          <h1 className="mb-3 text-4xl font-semibold">Privacy Policy</h1>
          <p className="text-sm text-muted">Effective date: May 3, 2026</p>
        </header>

        <div className="work-surface divide-y divide-[color:var(--line)]">
          <PolicySection title="Information we collect">
            <div className="grid gap-5 md:grid-cols-3">
              <PolicyFact
                label="GitHub OAuth"
                text="GitHub username, display name, email, avatar, and a session OAuth token used to call GitHub while you are signed in."
              />
              <PolicyFact
                label="Repository signals"
                text="Repository file tree, README, package metadata, scripts, lockfile presence, and environment variable names. Shipwright does not read environment values."
              />
              <PolicyFact
                label="Payments"
                text="Stripe customer id, plan type, and remaining ship credits. Card numbers are handled by Stripe."
              />
            </div>
          </PolicySection>

          <PolicySection title="How we use information">
            <ul className="grid gap-3 text-sm sm:grid-cols-2">
              <li>Analyze repositories and generate deployment artifacts.</li>
              <li>Process purchases, subscriptions, and billing portal access.</li>
              <li>Enforce rate limits and protect the service from abuse.</li>
              <li>Improve reliability using aggregated, non-sensitive operational signals.</li>
            </ul>
          </PolicySection>

          <PolicySection title="Data retention">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--line)]">
                    <th className="py-2 pr-6 font-semibold">Data</th>
                    <th className="py-2 font-semibold">Retention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {retentionRows.map(([data, retention]) => (
                    <tr key={data}>
                      <td className="py-3 pr-6 font-medium">{data}</td>
                      <td className="py-3 text-muted">{retention}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </PolicySection>

          <PolicySection title="Security">
            <p className="text-sm text-muted">
              GitHub tokens are session-scoped. Data in transit is encrypted with TLS. Shipwright
              does not use advertising cookies or tracking pixels.
            </p>
          </PolicySection>

          <PolicySection title="Your rights">
            <p className="text-sm text-muted">
              You can request access, deletion, or correction of your data by emailing{" "}
              <a
                href="mailto:vincekinney1991@gmail.com"
                className="font-semibold text-[color:var(--accent)]"
              >
                vincekinney1991@gmail.com
              </a>
              . We respond within 30 days.
            </p>
          </PolicySection>
        </div>

        <footer className="mt-8 flex flex-wrap gap-4 border-t border-[color:var(--line)] pt-5 text-sm">
          <Link href="/terms" className="font-semibold text-[color:var(--accent)]">
            Terms
          </Link>
          <Link href="/" className="font-semibold text-[color:var(--accent)]">
            Home
          </Link>
        </footer>
      </article>
    </main>
  );
}

function LegalNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[color:var(--line)] bg-[color:rgb(244_243_238_/_0.9)] backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-4">
        <Link href="/" className="text-xl font-semibold">
          Shipwright
        </Link>
        <Link href="/pricing" className="btn-secondary">
          Pricing
        </Link>
      </div>
    </nav>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-5">
      <h2 className="mb-3 text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function PolicyFact({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="section-label mb-2">{label}</p>
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}
