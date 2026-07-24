# Shipwright — Monetization Blueprint

> **Status**: Execution-ready. Product is Next.js 15, GitHub OAuth, Stripe (credits + subs), AI orchestrator gated behind payment, JSONL/Redis analytics, Upstash rate-limiting.
> **Current pricing**: Ship Credit $5 · Pro $15/mo · Team ~$99/mo (stub conflicts with agent copy — fix this first).

---

## Executive Summary

Shipwright converts dormant repos into deployment-ready packages in minutes. The core monetization insight is **compounding value per repo**: every repo that gets analyzed and shipped is a discrete unit of work a developer would otherwise spend 2–6 hours doing manually. Price to capture a fraction of that time savings.

The path to $10K MRR is achievable in 90 days with the roadmap below. The path to $100K MRR requires the team tier + marketplace + agency channel.

---

## 1. Fix the Pricing Inconsistency (Day 1 — Critical)

**Problem**: `.rollout/monetization/PRICING.md` says $0/$29/$99. `app/api/agent/route.ts` says "Ship Credit ($5) or Pro subscription ($15/month)". The stub is noise; the agent copy is what users see.

**Fix**:
- Retire `.rollout/monetization/PRICING.md` as a source of truth
- Lock on: **Free / Pro $19/mo / Team $79/mo / Enterprise custom**
- $19 is the validated SaaS sweet spot for solo devs; $29 suppresses trials significantly
- Update `monetization_stub.ts` to match live Stripe prices

**Target files**: `.rollout/monetization/PRICING.md`, `.rollout/monetization/monetization_stub.ts`, `app/pricing/PricingClient.tsx`, `app/api/agent/route.ts` (error message string)

---

## 2. Monetization Model Stack

### Tier A — Freemium Core (Acquisition Engine)

| What | Gate | Rationale |
|------|------|-----------|
| Repo analysis (framework, risk score, env vars) | Free, rate-limited (10/min IP) | High perceived value, zero cost to serve |
| Template generation (README, landing, vercel.json) | Free | Demonstrates output quality; teases AI upgrade |
| Template packs (saas, oss, api, portfolio) | Free | Pack selection is a natural upsell moment |
| PR creation with generated files | Free (1 PR/day) | Habit-forming; the PR IS the value proof |

**JTBD**: "I need to make my repo shippable without spending a whole day on config and docs."

**KPI**: Free → Paid conversion rate. Baseline target: 8% within 30 days of signup.

---

### Tier B — Pay-per-use Credits (First Revenue)

**Price**: $5 per Ship Credit (1 credit = 1 AI generation run)

**Why it works**: Zero commitment. Indie devs and students will buy a $5 credit before they commit to a subscription. Credits also serve as the gifting/referral currency.

**Enhancements needed**:

#### B1 — Credit Bundles
- **User**: Freelancer who ships 5–10 repos/month
- **Revenue impact**: +40% ARPU vs single credits; reduces per-transaction Stripe fees
- **UX**: Pricing page bundle picker: 1 credit $5 · 5 credits $20 ($4 each) · 20 credits $60 ($3 each)
- **Implementation**: Add `STRIPE_PRICE_CREDIT_5` and `STRIPE_PRICE_CREDIT_20` env vars; extend `app/api/stripe/checkout/route.ts` to accept `productType: "credit_bundle_5" | "credit_bundle_20"`; update `grantLedgerCredits` call in webhook handler to grant correct amount
- **Target files**: `app/api/stripe/checkout/route.ts`, `app/api/stripe/webhook/route.ts`, `lib/credit-ledger.ts`, `app/pricing/PricingClient.tsx`
- **KPI**: Bundle attach rate >30%; ARPU from credit buyers >$12

#### B2 — Credit Gifting / Seat Packs
- **User**: Engineering manager onboarding a new hire
- **Revenue impact**: Creates B2B beachhead without full team tier build
- **UX**: "Gift 5 credits to a teammate" button on dashboard; email delivery via Stripe coupon code or direct ledger grant
- **Implementation**: POST endpoint `/api/credits/gift` — validates sender has N credits, calls `grantLedgerCredits` on recipient email, sends email via existing email infrastructure (or Resend)
- **Target files**: New `app/api/credits/gift/route.ts`, `lib/ship-credits.ts`, `lib/credit-ledger.ts`
- **KPI**: 15% of Pro users gift at least once (org expansion signal)

---

### Tier C — Pro Subscription ($19/mo or $190/yr)

**Current state**: $15/mo in agent copy. Raise to $19 (anchors better against $29 and justifies annual discount).

**Current included**: Unlimited AI generations, no credit consumption.

**Enhancements needed**:

#### C1 — Pro Dashboard: Repo History & Re-generation
- **User**: Pro subscriber who shipped 10 repos and wants to refresh configs after a dependency update
- **Revenue impact**: Increases perceived value of subscription; reduces churn (sticky data)
- **UX**: `/dashboard` page showing all previously generated repos with "Regenerate" CTA, diff view showing what changed
- **Implementation**: Persist generation results to Redis hash `shipwright:user:{email}:generations` (list of `{repoFullName, timestamp, artifacts}`). New `GET /api/generations` route. New `app/dashboard/page.tsx`.
- **Target files**: `app/api/agent/route.ts` (add post-generation Redis write), new `app/api/generations/route.ts`, new `app/dashboard/` pages, `lib/redis.ts`
- **KPI**: Dashboard DAU/MAU ratio >0.3 = subscribers are regularly returning

#### C2 — Pro: Unlimited Template Packs + Custom Pack Builder
- **User**: Agency dev building 20 client sites/month
- **Revenue impact**: Unlocks agency use case; custom pack = serious switching cost
- **UX**: Pro users see "Create custom pack" in pack selector; define headline/subhead/CTA templates; saved to account
- **Implementation**: `lib/template-packs.ts` currently has static `TEMPLATE_PACK_IDS`. Add a `custom` pack type backed by user-keyed Redis hash. New `PUT /api/template-packs` route.
- **Target files**: `lib/template-packs.ts`, new `app/api/template-packs/route.ts`
- **KPI**: Custom pack creation rate among Pro users >20%

#### C3 — Automated Re-deploy Webhook (Pro Exclusive)
- **User**: Pro dev who wants Shipwright configs auto-refreshed when they push to main
- **Revenue impact**: Creates platform dependency = near-zero churn
- **UX**: "Enable auto-refresh" toggle on repo page; shows webhook URL to add to GitHub repo settings
- **Implementation**: New `app/api/webhooks/github/route.ts` — verifies HMAC secret, calls `runOrchestrator` for push to default branch, creates new PR if configs changed
- **Target files**: New `app/api/webhooks/github/route.ts`, `lib/agents/orchestrator.ts`, `lib/github.ts`
- **KPI**: Webhook adoption rate among Pro users >25%; webhook users churn at <2%/mo

---

### Tier D — Team Plan ($79/mo for up to 5 seats, $15/seat after)

**Current state**: Stripe price exists (`STRIPE_PRICE_TEAM`) but no team-specific features exist.

**Required features to justify the price**:

#### D1 — Team Workspaces
- **User**: Engineering lead standardizing deploy configs across 20 repos
- **Revenue impact**: Single paying user → org account → seat expansion
- **UX**: Team settings page; invite members by email; shared generation history; shared custom template packs; shared credit pool
- **Implementation**: Add `teamId` concept to analytics events and ledger entries; create `lib/teams.ts` managing Redis hashes for team membership; extend auth to carry `teamId`
- **Target files**: New `lib/teams.ts`, `lib/credit-ledger.ts`, `app/api/stripe/webhook/route.ts` (team subscription handling), new `app/settings/team/page.tsx`
- **KPI**: Team plan ACV = $948/yr; target 50 team customers = $47K ARR

#### D2 — Team Audit Log
- **User**: CTO who needs to see who generated what config for compliance
- **Revenue impact**: Pure retention feature; makes downgrade feel risky
- **UX**: `/settings/audit` table: timestamp, user, repo, action, artifact type
- **Implementation**: Reuse existing `analytics-store.ts` JSONL/Redis infrastructure; add `teamId` filter to `readAnalyticsEvents`; new scoped UI page
- **Target files**: `lib/analytics-store.ts`, `app/api/analytics/route.ts`, new `app/settings/audit/page.tsx`
- **KPI**: Audit log viewed at least once/month by 60% of team admins

---

### Tier E — Enterprise (Custom / $500+/mo)

#### E1 — SSO + SAML
- **User**: Enterprise IT requiring SSO through Okta/Azure AD
- **Revenue impact**: Required for any Fortune 5000 procurement
- **UX**: "Request enterprise trial" CTA on pricing page → Calendly/form
- **Implementation**: Add NextAuth SAML provider (next-auth-saml or WorkOS); protected by `ENTERPRISE_ORG_IDS` env var
- **KPI**: 3 enterprise pilots = $18K ARR minimum

#### E2 — Self-hosted / Private Cloud
- **User**: Enterprise with data residency requirements
- **Revenue impact**: $2K–$5K/mo licensing
- **UX**: "On-premise" section on enterprise page; Docker Compose deployment guide
- **Implementation**: Already nearly self-hostable (Next.js + Upstash optional). Add `DEPLOYMENT_MODE=self-hosted` env; disable Stripe webhook requirement in favor of license key validation
- **KPI**: 5 self-hosted licenses = $10K–$25K ARR

---

### Tier F — Marketplace / Add-ons

#### F1 — Template Pack Marketplace
- **User**: Developer who wants a specialized pack (Django REST, Elixir Phoenix, Rust Axum)
- **Revenue impact**: 70/30 revenue share with pack creators; platform stickiness
- **UX**: Browse `/marketplace/packs`; install to account; creators submit via PR to a `community-packs` repo
- **Implementation**: Extend `lib/template-packs.ts` to fetch pack definitions from a CDN-backed JSON registry. Add `marketplace_pack_installed` analytics event.
- **KPI**: 20 community packs → 500 installs/mo → $5K GMV at $10/pack

#### F2 — Deploy Target Add-ons (AWS, Railway, Fly.io)
- **User**: Dev who doesn't use Vercel
- **Revenue impact**: Unlocks 60% of market currently blocked by Vercel-only output
- **UX**: In generation results, "Generate for AWS" / "Railway" buttons (Pro+ or $2 credit)
- **Implementation**: New `lib/generators/aws.ts`, `lib/generators/railway.ts`, `lib/generators/fly.ts` matching existing generator interface; add to `POST /api/generate` and `POST /api/agent` responses
- **KPI**: 30% of Pro users activate non-Vercel target within 60 days

#### F3 — Launch Report (Shareable PDF / Microsite)
- **User**: Indie hacker who wants to tweet about shipping; agency creating client handoff
- **Revenue impact**: Viral loop (see Growth Engine); premium export at $2/report or included in Pro
- **UX**: After AI generation, "Create Launch Report" → branded PDF / public microsite at `shipwright.dev/l/{slug}`
- **Implementation**: New `app/l/[slug]/page.tsx` SSG route; store report JSON in Redis `shipwright:reports:{slug}`; share button posts to Twitter/X with "Built with Shipwright" CTA
- **Target files**: New `app/l/[slug]/page.tsx`, `app/api/reports/route.ts`, `lib/analytics-events.ts` (already has `launch_report_created`, `launch_report_shared`)
- **KPI**: 20% share rate → 2 new signups per 10 reports shared (k-factor 0.2)

---

## 3. Revenue Projections

### 90-Day Scenario (Conservative)

| Segment | Users | ARPU | MRR |
|---------|-------|------|-----|
| Credit buyers | 150 | $8 | $1,200 |
| Pro monthly | 80 | $19 | $1,520 |
| Pro annual (amortized) | 20 | $16 | $316 |
| Team | 5 | $79 | $395 |
| **Total** | | | **$3,431** |

### 90-Day Scenario (Optimistic, with growth engine activated)

| Segment | Users | ARPU | MRR |
|---------|-------|------|-----|
| Credit buyers | 400 | $10 | $4,000 |
| Pro monthly | 200 | $19 | $3,800 |
| Pro annual (amortized) | 60 | $16 | $958 |
| Team | 15 | $79 | $1,185 |
| **Total** | | | **$9,943** |

---

## 4. Immediate Revenue Levers (No New Features Required)

These can be done in < 1 week:

1. **Fix the price**: Change Pro to $19/mo (up from $15). No code change needed — just update the Stripe price and the error string in `app/api/agent/route.ts`.
2. **Add annual plan CTA**: `STRIPE_PRICE_PRO_ANNUAL` already exists. Just surface it prominently on the pricing page with "Save 2 months" badge.
3. **Credit bundle checkout**: Add 5-pack and 20-pack Stripe prices; 3 lines of change in `checkout/route.ts`.
4. **Post-checkout upsell**: After a credit purchase, show "Get unlimited with Pro — upgrade now, credits already applied."
5. **Email capture on generate**: Before showing template output, require email (not GitHub auth). This gives a pre-auth funnel lead. Add `email_captured` to analytics events.

---

## 5. Pricing Architecture Principles

- **Free is a marketing channel**, not a cost center. Every free generation that creates a PR is a Shipwright attribution touchpoint in the customer's GitHub history.
- **Credits are for acquisition, subscriptions are for retention.** The credit model's job is to remove the friction of a subscription commitment from the first purchase.
- **Annual plans unlock cash flow.** Target 30% of Pro subscribers on annual within 6 months.
- **Team pricing should feel like "Pro for the whole team" not a separate product.** Price it as `n × $16` so expanding from 1 Pro to a 5-person team feels natural.
- **Never gate analysis behind payment.** Analysis is the hook. Generating artifacts is the product.

---

## 6. Technical Debt That Blocks Monetization

| Issue | Impact | Fix |
|-------|--------|-----|
| Stripe webhook handler has no DB writes | Credits don't auto-grant on payment; ledger is file-backed | Add `grantLedgerCredits` call in `webhook/route.ts` on `payment_intent.succeeded` |
| `agent` rate limit type defined but not applied | Pro users can be DoS'd; abuse possible | Apply `checkRateLimitAsync(key, "agent")` in `app/api/agent/route.ts` |
| `CREDIT_LEDGER_PATH` is file-backed | Doesn't survive serverless restarts | Migrate ledger to Upstash Redis hash; `credit-ledger.ts` already has Redis client available via `getRedis()` |
| Pricing stub `$29/$99` contradicts app copy | Confuses devs reading the codebase; causes pricing mistakes | Align `monetization_stub.ts` with actual Stripe prices |
| No post-checkout webhook credit grant | User pays, refreshes page, still no credits | Wire `checkout.session.completed` event in webhook handler |
