import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service - Shipwright",
  description: "Shipwright Terms of Service",
};

const paymentTerms = [
  [
    "Ship Credits",
    "$5 one-time purchase for one successful generation. Credits are not consumed by analysis.",
  ],
  ["Pro", "$15 per month for unlimited generations during the active subscription period."],
  ["Pro Annual", "$150 per year for the same Pro access billed annually."],
  ["Team", "$250 per month for shared generation capacity for up to 10 members."],
];

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <LegalNav />

      <article className="mx-auto max-w-4xl px-6 py-10">
        <header className="mb-8">
          <p className="section-label mb-3">Legal</p>
          <h1 className="mb-3 text-4xl font-semibold">Terms of Service</h1>
          <p className="text-sm text-muted">Effective date: May 3, 2026</p>
        </header>

        <div className="work-surface divide-y divide-[color:var(--line)]">
          <TermsSection title="1. Acceptance">
            <p>
              By accessing or using Shipwright, you agree to be bound by these Terms. If you do not
              agree, do not use the Service.
            </p>
          </TermsSection>

          <TermsSection title="2. Description of service">
            <p>
              Shipwright analyzes GitHub repositories and generates deployment configuration,
              documentation, landing-page copy, and pull request content. Generated output must be
              reviewed before production use.
            </p>
          </TermsSection>

          <TermsSection title="3. Account and authentication">
            <ul className="space-y-2">
              <li>You must authenticate with GitHub OAuth to use the Service.</li>
              <li>You are responsible for the security of your GitHub account.</li>
              <li>
                Shipwright requests the <code className="code-chip">repo user</code> scope so it can
                read repository context and create pull requests you request.
              </li>
              <li>Shipwright does not store your GitHub access token beyond the session.</li>
            </ul>
          </TermsSection>

          <TermsSection title="4. Payment terms">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--line)]">
                    <th className="py-2 pr-6 font-semibold">Plan</th>
                    <th className="py-2 font-semibold">Terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--line)]">
                  {paymentTerms.map(([plan, terms]) => (
                    <tr key={plan}>
                      <td className="py-3 pr-6 font-medium">{plan}</td>
                      <td className="py-3 text-muted">{terms}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-muted">
              First-time purchases include a 30-day money-back guarantee. Email{" "}
              <a
                href="mailto:vincekinney1991@gmail.com"
                className="font-semibold text-[color:var(--accent)]"
              >
                vincekinney1991@gmail.com
              </a>{" "}
              for refund requests.
            </p>
          </TermsSection>

          <TermsSection title="5. Acceptable use">
            <p>
              You agree not to use Shipwright to analyze repositories you do not own or have
              permission to access, circumvent rate limits or payment requirements, use the Service
              unlawfully, or reverse engineer the underlying AI models.
            </p>
          </TermsSection>

          <TermsSection title="6. Intellectual property">
            <p>
              Generated content belongs to you. The Shipwright codebase, service, and brand remain
              owned by Shipwright.
            </p>
          </TermsSection>

          <TermsSection title="7. Disclaimers and liability">
            <p>
              The Service is provided as is, without warranty of any kind. To the maximum extent
              permitted by law, Shipwright's liability will not exceed the amount you paid in the 12
              months before the claim.
            </p>
          </TermsSection>
        </div>

        <footer className="mt-8 flex flex-wrap gap-4 border-t border-[color:var(--line)] pt-5 text-sm">
          <Link href="/privacy" className="font-semibold text-[color:var(--accent)]">
            Privacy Policy
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

function TermsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="p-5 text-sm leading-6 text-muted">
      <h2 className="mb-3 text-xl font-semibold text-[color:var(--ink)]">{title}</h2>
      {children}
    </section>
  );
}
