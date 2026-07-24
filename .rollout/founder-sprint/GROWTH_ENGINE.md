# Shipwright — Growth Engine

> **Premise**: Shipwright has a rare natural viral surface — every generated artifact (PR, README, landing page, vercel.json) touches multiple people: the author, their teammates, their GitHub followers, and future repo visitors. The growth engine's job is to convert those passive touches into active signups.

---

## 1. North Star Metric

**Weekly Active Repos (WAR)**: number of distinct repos that completed at least one generation (template or AI) in the rolling 7 days.

Why: A repo that ships is one that paid (or will pay). WAR correlates with both activation and revenue better than signups or page views.

**Supporting metrics**:
- Signup → First Generation rate (target: >60% within 24 hours)
- First Generation → Paid Conversion rate (target: >8% within 7 days)
- Paid → Second repo rate (target: >50% within 30 days — the retention anchor)
- Viral coefficient k: new signups attributable to shared content / total active users (target: k > 0.15)

---

## 2. Activation Funnel

### Current funnel (inferred from analytics events)
```
homepage_cta_clicked
  → repo_page_viewed
    → analyze_completed
      → generate_completed (free tier)
        → repo_paywall_clicked
          → checkout_started
            → checkout_completed
              → agent_completed
                → pr_created
```

The funnel has **two critical drop-off points**:
1. Between `generate_completed` and `repo_paywall_clicked` — users see template output and don't feel it's worth paying for AI
2. Between `checkout_started` and `checkout_completed` — classic cart abandonment

### 2A — Fix Drop-off Point 1: The "Preview Gap"

**Problem**: Template generation shows complete output. Users have no motivation to upgrade because they already have *something* that looks good enough.

**Fix — "AI Delta" Preview**: Show the template output side-by-side with a blurred/teased "AI version" highlighting exactly what's better. Annotate the diff: "AI version adds your actual API endpoints, real stack description, and 3 deployment warnings you're missing."

- **JTBD**: Developer wants to know if the $5 is actually worth it before paying
- **UX**: After `generate_completed`, show split-pane: "Template" (full) vs "AI" (blurred with 3 revealed lines). CTA: "Unlock AI version — $5"
- **Implementation**: Generate a short `aiPreview` snippet server-side in `POST /api/generate` using a cheap model call (GPT-4o-mini, ~$0.001 cost). Return as `aiPreview: { teaser: string }` in response. Gate full AI output behind payment.
- **Target files**: `app/api/generate/route.ts`, `lib/generators/landing.ts` or new `lib/generators/ai-preview.ts`, frontend repo detail page
- **KPI**: 25% lift in `repo_paywall_clicked` events; 15% lift in `checkout_started`

### 2B — Fix Drop-off Point 2: Cart Abandonment

**Problem**: User clicks "Buy Ship Credit", goes to Stripe checkout, abandons.

**Fix — Friction Reduction**:
- Add **Stripe Link** (one-click checkout for returning customers) — already supported by Stripe SDK
- Add **Apple Pay / Google Pay** buttons to checkout session via `payment_method_types: ["card", "link", "apple_pay", "google_pay"]` in `app/api/stripe/checkout/route.ts`
- Emit `checkout_abandoned` event (detect via Stripe webhook `checkout.session.expired`) and trigger recovery email within 1 hour

- **Target files**: `app/api/stripe/checkout/route.ts`, `app/api/stripe/webhook/route.ts`
- **KPI**: 20% reduction in checkout abandonment; +10% `checkout_completed` rate

### 2C — Reduce Time-to-First-Value

**Current**: User signs in → selects repo → analyze → generate. That's 3 clicks minimum plus GitHub OAuth.

**Fix — Demo Mode**: Allow analysis of a *public* GitHub URL with **no login required**. Show full template output. Gate AI + PR creation behind auth.

- **JTBD**: Skeptical visitor who won't sign in before seeing value
- **UX**: Homepage has a text input: "Paste any public GitHub repo URL". Runs `analyze` + `generate` without session. Shows output. CTA: "Sign in to create PR / use AI"
- **Implementation**: New `GET /api/demo?url=github.com/owner/repo` — uses a server-side GitHub token (no user token required for public repos); applies the `demo` rate limit (already defined in `RATE_LIMITS`); no PR creation allowed
- **Target files**: `app/page.tsx`, new `app/api/demo/route.ts`, `lib/analyzer.ts` (verify it works without user token for public repos)
- **Analytics event**: `demo_started`, `demo_completed` (already in `analytics-events.ts`)
- **KPI**: Demo → signup conversion >20%; demo lowers homepage bounce rate by 30%

---

## 3. Sharing Loops (Viral Mechanics)

### 3A — "Built with Shipwright" Attribution in Generated Artifacts

**The mechanic**: Every generated landing page already has `&copy; 2024 ${repoName}. Built with Shipwright.` in the footer. Every generated README could include a badge. These are passive viral touchpoints seen by *every visitor to that repo or deployed page*.

**Enhancement — Richer Attribution**:
- Landing page footer: replace plain text with styled badge linking to `shipwright.dev?ref=generated`
- README: add `[![Shipped with Shipwright](https://img.shields.io/badge/shipped%20with-Shipwright-7C3AED)](https://shipwright.dev)` badge
- vercel.json + GitHub Actions: add comment header `# Generated by Shipwright — shipwright.dev`
- Make attribution **opt-out for Pro** (free users always include it; Pro users can remove it)

- **Target files**: `lib/generators/landing.ts`, `lib/generators/readme.ts`, `lib/generators/vercel-config.ts`, `lib/generators/github-actions.ts`
- **KPI**: 500 live generated landing pages × 100 visitors each = 50K attribution impressions/mo; target 1% click → 500 visits/mo organic from generated content

### 3B — Launch Report Share Loop

**The mechanic**: After AI generation, user can create a shareable "Launch Report" microsite at `shipwright.dev/l/{slug}`. It shows repo analysis, what was generated, deployment risk score, tech stack.

**Sharing incentive**: When someone visits a Launch Report and signs up → original creator gets 1 free credit ("Refer a friend, get a credit").

- **JTBD**: Indie hacker wants to tweet "just shipped [project]" with something visual
- **UX**: After `agent_completed`, full-width CTA: "Share your Launch Report → Get 1 credit per signup". Copy link, Twitter/X share, LinkedIn share.
- **Implementation**:
  - New `app/api/reports/route.ts`: POST creates report, stores in Redis `shipwright:reports:{slug}` (TTL 90 days), returns slug
  - New `app/l/[slug]/page.tsx`: SSG/ISR page rendering report
  - New `app/api/reports/[slug]/claim/route.ts`: When visitor signs up via report referral link, grants 1 credit to report creator via `grantLedgerCredits`
  - Add `referral_attributed` event tracking (already in `analytics-events.ts`)
- **Target files**: New `app/api/reports/`, new `app/l/[slug]/`, `lib/ship-credits.ts`, `lib/analytics-events.ts`
- **KPI**: 20% of AI generation completions create a launch report; 15% of reports get shared; 2% of viewers convert to signup = k-factor contribution of 0.006 per generation

### 3C — GitHub PR as Growth Channel

**The mechanic**: The generated PR already appears in the user's GitHub repo with Shipwright as the author/description. Every teammate who reviews the PR is a potential signup.

**Enhancement — PR Body Marketing**:
- Add to generated PR description: "Generated by [Shipwright](https://shipwright.dev) — turn any repo into a deployment-ready product in minutes."
- Add "Review with Shipwright" link: `https://shipwright.dev/repos/{owner}/{repo}?ref=pr`
- For free users: PR includes full Shipwright branding; Pro users get a subtle "Powered by Shipwright" line only

- **Target files**: `app/api/repos/route.ts` (PR creation body), `lib/github.ts`
- **KPI**: 2% of PR reviewers click through → signups from existing user's teammates

---

## 4. Referral Program

### 4A — Credit-Based Referral

**Mechanic**: Share a referral link. When a referred user makes their first paid purchase → referrer gets 2 free credits (~$10 value), referred user gets 1 free credit (~$5 value).

**Why credits not cash**: Credits have zero marginal cost to grant (ledger entry) but $5 perceived value. Cash creates accounting complexity.

- **JTBD**: Power user who loves the product and talks about it in their dev community
- **UX**: `/settings/referral` page shows personal link `shipwright.dev?ref={userId}`; progress tracker showing referrals and credits earned; "Copy link", "Tweet this", "Share in Discord" buttons
- **Implementation**:
  - `MarketingCapture.tsx` already captures `ref` param — route it through as `referredBy` on signup
  - New `lib/referral.ts`: on first paid event, check `referredBy` in session/cookie, call `grantLedgerCredits` for both parties
  - New `app/settings/referral/page.tsx`
  - Add `referral_attributed` tracking (already in event names)
- **Target files**: `components/MarketingCapture.tsx`, `lib/analytics.ts`, new `lib/referral.ts`, `app/api/stripe/webhook/route.ts`
- **KPI**: 15% of paid users refer at least 1 person; referral CAC = $0 vs estimated $15–$30 paid CAC

### 4B — Community Referral (Discord / Dev Twitter)

**Mechanic**: Create a `#shipped-today` channel in a Shipwright Discord. Users share their launch reports. Most active community members get early access to new features (not credits — access is more valuable and costs nothing).

- **Implementation**: No code; community infrastructure only
- **KPI**: 200 Discord members in 90 days; 10% weekly active

---

## 5. Retention Levers

### 5A — Repo Health Score (Recurring Hook)

**The mechanic**: Every repo that was analyzed gets a "Deployment Health Score" (already output as `deploymentRiskScore`). Send a weekly email: "Your repo `my-app` health score dropped from 85 → 72 — 3 new deployment risks detected."

- **JTBD**: Busy developer who wants to stay on top of their repo's production readiness without manual effort
- **Why it retains**: Creates a recurring reason to log in even when not actively shipping. Establishes Shipwright as the source of truth for repo health.
- **UX**: Weekly email digest with score trend. Click-through to re-analyze and re-generate.
- **Implementation**: Scheduled job (Vercel Cron `vercel.json`) that re-runs `RepoAnalyzer` on saved repos and emails diffs. Requires email infrastructure (Resend recommended).
- **Target files**: New `app/api/cron/health-check/route.ts`, `lib/analyzer.ts`, new `lib/email.ts`
- **KPI**: Weekly email open rate >30%; email → re-generation rate >10%; email subscribers churn at 3% vs 8% for non-subscribers

### 5B — Artifact Version History

**The mechanic**: Every time a user regenerates a repo, Shipwright stores the diff between old and new output. "Your README changed in 3 sections — Vercel config now includes 3 new env vars."

- **Why it retains**: Creates a historical record that becomes valuable over time. Subscribers won't cancel because they'd lose their history.
- **Implementation**: On `agent_completed`, store artifact hash in Redis `shipwright:user:{email}:history:{repoFullName}` sorted set with timestamp as score. New `GET /api/generations?repo={repoFullName}` endpoint.
- **Target files**: `app/api/agent/route.ts`, `lib/redis.ts`, new `app/api/generations/route.ts`
- **KPI**: History feature users churn at <2%/mo; Pro plan "sticky feature" cited in >40% of retention survey responses

### 5C — Milestone Notifications

**Trigger events for re-engagement**:
- "Your repo just hit 100 stars — time for a fresh landing page?"
- "It's been 30 days since you generated configs for `my-app` — React 19 is out, check your dependencies"
- "Your PR was merged! Ready to generate configs for your next repo?"

- **Implementation**: GitHub webhook on `watch` events (stars) and scheduled checks for stale generations. Add `milestone_triggered` to analytics events.
- **KPI**: Milestone emails drive 15% re-activation rate for churned free users

---

## 6. Onboarding Loop

### Target: 60% of signups complete a generation within 24 hours (currently unknown — instrument first)

**Onboarding sequence**:

```
Step 0 (T+0): Sign in with GitHub → immediately show top 3 repos by recency
Step 1 (T+0): Auto-select most recently updated repo; show "Analyze this repo?" CTA
Step 2 (T+5min): First analysis complete → show risk score animation, env vars found, framework detected
Step 3 (T+5min): "Generate free template" auto-triggered (no second click needed)
Step 4 (T+6min): Template output shown → AI delta preview shown (see 2A)
Step 5 (T+7min): "Create PR" CTA (free) or "Unlock AI version" ($5)
Step 6 (T+7min if PR): PR URL shown → "Share your launch report" CTA
Step 7 (T+24h): Re-engagement email if Step 5 not completed
```

**Key insight**: Every additional click between sign-in and first value is a ~15% drop in activation. The current flow requires 3 explicit user choices (pick repo, click analyze, click generate). **Reduce to 1**: auto-select repo, auto-analyze, one-click to generate.

**Implementation**:
- `app/repos/page.tsx`: Auto-select most-recently-updated non-fork, non-archived repo
- `app/repos/[...slug]/RepoPageClient.tsx`: Auto-trigger analyze on page load (it's already cached)
- Add `onboarding_step_{n}` analytics events or instrument existing events with `onboarding_session_id` property

**KPI**: Signup → first generation rate from ~40% (estimated) to >60%; time to first value from ~8min to <3min

---

## 7. Acquisition Channels

| Channel | CAC | Scale | Priority |
|---------|-----|-------|----------|
| GitHub organic (attribution in PRs, READMEs) | $0 | Medium | High |
| Product Hunt launch | $0–$5 | High (spike) | High (one-time) |
| Dev Twitter/X content (ship threads, launch reports) | $0 | Medium | High |
| HackerNews "Show HN" | $0 | High (spike) | Medium |
| SEO: "deploy [framework] to Vercel" keywords | $0 (time) | High (slow) | Medium |
| YouTube: "From repo to live in 5 minutes" | $0 (time) | Medium | Medium |
| Dev newsletters (TLDR, Bytes.dev) | $200–$500/issue | Low-Medium | Low (post-PMF) |
| Google Ads | $15–$40 CPC | High | Low (post-PMF) |

**Highest-leverage channel: GitHub itself**. Every generated artifact is a breadcrumb back to Shipwright seen by other developers. Prioritize getting 1,000 generated PRs into the wild — that's the growth flywheel.

---

## 8. Analytics Instrumentation Gaps

The following events are missing from `analytics-events.ts` and should be added to close measurement gaps:

```typescript
// Add to ANALYTICS_EVENT_NAMES array in lib/analytics-events.ts:
"signup_completed",           // when GitHub OAuth completes for first time
"onboarding_repo_selected",   // first repo selection in onboarding
"ai_preview_viewed",          // demo of AI delta (section 2A)
"credit_bundle_purchased",    // bundle checkout completed
"referral_link_copied",       // referral page interaction
"launch_report_viewed",       // someone views another user's report
"health_score_email_clicked", // retention email CTA
"webhook_enabled",            // pro webhook setup
"custom_pack_created",        // pro template pack builder
"team_member_invited",        // team expansion signal
"annual_upgrade_clicked",     // plan page CTA
"checkout_abandoned",         // detected via webhook session.expired
```

**Target file**: `lib/analytics-events.ts`

---

## 9. The Flywheel (Summary)

```
Free analysis (low friction, high value perception)
  → Template generation (demonstrates product)
    → AI delta preview (creates upgrade desire)
      → First credit purchase (converts to payer)
        → AI generation (delivers WOW moment)
          → Launch report created (shareable artifact)
            → Report shared on Twitter/GitHub
              → New visitors arrive
                → Demo mode converts them
                  → New free users enter funnel
                    → [loop]

Meanwhile:
  PR body → teammates see it → 2% sign up
  README badge → repo visitors → 1% sign up
  Weekly health email → re-activates churned users
  Referral credits → power users bring their network
```

The flywheel velocity is determined by: (1) how fast free → paid converts, (2) how much each paid user generates virally. Both are actionable within 30 days.
