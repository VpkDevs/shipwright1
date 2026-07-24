# Shipwright — Pricing Experiments

> **Purpose**: Define concrete A/B and sequential pricing experiments to empirically find the highest-revenue price points without guessing. Each experiment has a hypothesis, implementation spec, success criterion, and rollback plan.

---

## Experiment Framework

**Decision rule**: Run each experiment for minimum 2 weeks or 100 conversion events, whichever comes first. Use a one-tailed z-test at 90% confidence (p < 0.1) for speed; don't wait for 95% at early stage.

**Instrumentation required** (add to `lib/analytics-events.ts`):
- `pricing_variant_seen` — which variant was shown (property: `variant`)
- `checkout_started` — already exists
- `checkout_completed` — already exists

**Variant assignment**: Hash `session.user.email` or IP mod N for consistent experience without a full A/B framework.

---

## Experiment 1: Pro Monthly Price Point

### Hypothesis
$19/mo will convert at a higher rate than $15/mo, with higher MRR per cohort despite potential slight volume drop.

### Context
Current price in agent error message: $15/mo. Pricing stub says $29/mo. Neither is tested. The $19 price point is the most-tested "developer SaaS sweet spot" (Vercel Pro was $19, Netlify Pro is $19, Railway is $20).

### Variants
| Variant | Price | Positioning |
|---------|-------|-------------|
| A (control) | $15/mo | Current |
| B | $19/mo | "Pro" badge, same features |
| C | $24/mo | "Pro" badge + "Priority AI" label |

### Implementation
- Create 3 Stripe prices: `price_pro_15`, `price_pro_19`, `price_pro_24`
- Add `STRIPE_PRICE_PRO_VARIANT` env var pattern: `STRIPE_PRICE_PRO_A`, `_B`, `_C`
- In `app/api/stripe/checkout/route.ts`, when `productType === "pro"`, select price ID based on variant assignment
- Show matching price on `app/pricing/PricingClient.tsx` by reading variant from cookie/header
- **Target files**: `app/api/stripe/checkout/route.ts`, `app/pricing/PricingClient.tsx`

### Success Criterion
Variant B MRR > Variant A MRR by >10% over 2-week cohort (higher price × slightly lower volume = net positive).

### Expected Outcome
Based on industry data: $19 vs $15 typically sees <5% conversion drop but +26% ARPU → ~+20% MRR.

### Rollback
Set `STRIPE_PRICE_PRO_VARIANT` back to A env var; no data loss.

---

## Experiment 2: Annual Plan Prominence

### Hypothesis
Moving the annual plan from secondary mention to equal-prominence will increase annual attach rate from ~0% (currently not surfaced) to >15%.

### Context
`STRIPE_PRICE_PRO_ANNUAL` exists in README but is not visibly promoted with a savings CTA. Annual cash flow is crucial: a $190/yr subscriber is worth 2.5× vs a $19/mo subscriber on a 12-month horizon (no churn risk for 12 months).

### Variants
| Variant | Annual Plan Placement |
|---------|----------------------|
| A | Monthly only (control) |
| B | Monthly/Annual toggle (annual shown first, highlighted "Most popular") |
| C | Annual default, monthly as "month-to-month" secondary option |

### Implementation
- `app/pricing/PricingClient.tsx`: add billing period toggle component
- Default toggle state = annual for variant C, monthly for A/B
- Add `pricing_period_toggled` analytics event
- Pass correct price ID to checkout based on toggle state
- **Target files**: `app/pricing/PricingClient.tsx`, `app/api/stripe/checkout/route.ts`

### Success Criterion
Annual attach rate >15% in winning variant (vs ~0% baseline).

### Expected Outcome
Industry benchmark: showing annual first → 20–30% annual attach. $190 annual vs $228 annual cost = good perceived value.

---

## Experiment 3: Credit Pack Sizing

### Hypothesis
A 5-credit bundle at $20 will generate more total revenue per buyer than 1 credit at $5, because the discount is large enough to trigger the "stock up" mental model.

### Variants
| Variant | Options Shown | Bundle Discount |
|---------|--------------|-----------------|
| A | $5 × 1 only | 0% |
| B | $5 × 1, $20 × 5 ($4 each) | 20% |
| C | $5 × 1, $20 × 5, $60 × 20 ($3 each) | 20% / 40% |

### Implementation
- Add Stripe prices: `STRIPE_PRICE_CREDIT_5PACK`, `STRIPE_PRICE_CREDIT_20PACK`
- Extend `app/api/stripe/checkout/route.ts` to accept `productType: "credit_bundle_5" | "credit_bundle_20"`
- In webhook handler `app/api/stripe/webhook/route.ts`: on `payment_intent.succeeded`, call `grantLedgerCredits(email, quantity, "credit_bundle_purchase")` where quantity = 5 or 20
- On checkout, show bundle options side-by-side
- **Target files**: `app/api/stripe/checkout/route.ts`, `app/api/stripe/webhook/route.ts`, `lib/ship-credits.ts`, `app/pricing/PricingClient.tsx`

### Success Criterion
Revenue per credit buyer in variant B/C > variant A by >25%.

### Expected Outcome
Bundle buyers typically spend 3–4× more per transaction. At 30% bundle attach rate, this doubles credit revenue from that cohort.

---

## Experiment 4: Paywall Placement (Hard vs Soft Gate)

### Hypothesis
Showing a "soft gate" (teaser output + blur) before asking for payment converts better than the current "hard gate" (nothing shown, just a payment prompt after free template).

### Context
Currently users get the full template for free, then hit a paywall for AI. The value gap between free template and paid AI is invisible. A soft gate shows the AI output is meaningfully better.

### Variants
| Variant | Behavior |
|---------|----------|
| A (control) | Full free template, then payment prompt for AI |
| B | Full free template + blurred AI preview (3 lines visible) |
| C | Blurred full AI output with "15% preview" visible |

### Implementation
- In `app/api/generate/route.ts`: add optional `aiPreview` field — call GPT-4o-mini to generate a 3-sentence "AI improvement summary" for the repo, cost ~$0.001/call. Add as `aiPreview: { summary: string, improvements: string[] }` to response.
- Frontend repo detail page: render AI preview card when `aiPreview` present
- Track `ai_preview_viewed` event (add to `analytics-events.ts`)
- Track `paywall_upgrade_clicked` from preview card
- **Target files**: `app/api/generate/route.ts`, new `lib/generators/ai-preview.ts`, `lib/analytics-events.ts`

### Success Criterion
`checkout_started` rate from variant B/C > variant A by >20%.

### Expected Outcome
SaaS soft-gate patterns typically see 15–40% conversion lift vs hard gates. The key is making the upgrade "feel obvious" not "feel forced."

---

## Experiment 5: Checkout Flow — Friction Reduction

### Hypothesis
Adding Stripe Link (one-click checkout) and payment method icons (Apple Pay, Google Pay) to the checkout session will reduce cart abandonment by >15%.

### Variants
| Variant | Payment Methods |
|---------|----------------|
| A (control) | Card only |
| B | Card + Stripe Link |
| C | Card + Stripe Link + Apple Pay + Google Pay |

### Implementation
```typescript
// app/api/stripe/checkout/route.ts — extend session creation:
const session = await stripe.checkout.sessions.create({
  // existing params...
  payment_method_types: 
    variant === 'C' ? ['card', 'link', 'apple_pay', 'google_pay'] :
    variant === 'B' ? ['card', 'link'] :
    ['card'],
  payment_method_collection: 'always',
});
```
- Stripe handles payment method availability automatically based on customer device
- No frontend changes required
- **Target files**: `app/api/stripe/checkout/route.ts`

### Success Criterion
`checkout_completed` / `checkout_started` ratio improves by >10%.

### Expected Outcome
Stripe reports Link reduces checkout time by 40% for returning users. Apple/Google Pay eliminates card entry on mobile entirely.

---

## Experiment 6: Free Tier Limits

### Hypothesis
Reducing the free template generation rate limit from 5/min to 2/day will increase conversion rate without significantly reducing acquisition.

### Context
Current: 5 generate requests per 60 seconds per IP. This is effectively unlimited for real users. A tighter limit creates upgrade pressure while not affecting normal usage.

### Variants
| Variant | Free Generate Limit |
|---------|---------------------|
| A (control) | 5/min (current) |
| B | 3/day per authenticated user |
| C | 1/day per authenticated user |

### Implementation
- Modify `RATE_LIMITS.generate` in `lib/rate-limit.ts` to use user-keyed limits instead of IP-keyed for authenticated users
- Add `generate:user:{email}` rate limit key alongside `generate:{ip}` 
- Show "2 free generations left today" counter in UI
- Upgrade prompt shown when limit reached
- **Target files**: `lib/rate-limit.ts`, `app/api/generate/route.ts`, repo detail frontend

### Success Criterion
Variant B/C `checkout_started` rate >15% higher than variant A without >20% reduction in `generate_completed` volume.

### Caution
Too aggressive a limit hurts top-of-funnel. This experiment should run last, after conversion flow is optimized.

---

## Experiment 7: Team Pricing Framing

### Hypothesis
Framing the team plan as "Pro × 5" with per-seat pricing will convert better than a flat "Team" price, because it anchors on the Pro plan value users already understand.

### Variants
| Variant | Team Plan Display |
|---------|-----------------|
| A | "$79/month — Team (up to 5 members)" |
| B | "$16/seat/month — 5 seats included ($80/mo)" |
| C | "5× Pro for $79 (save $16/mo)" |

### Implementation
- Pure copy change in `app/pricing/PricingClient.tsx`
- Track `pricing_plan_selected` with `variant` property
- **Target files**: `app/pricing/PricingClient.tsx`

### Success Criterion
Team plan `checkout_started` rate in winning variant >50% higher than control.

### Expected Outcome
Per-seat pricing reduces sticker shock for small teams (2–3 members thinking "I'm only using 2 seats"). Variant C uses loss aversion (savings framing).

---

## Experiment 8: Post-Checkout Upsell (Credit → Pro)

### Hypothesis
Showing a "Upgrade to Pro" offer immediately after a credit purchase, with the credit cost applied toward first month, will convert >10% of credit buyers to Pro subscribers.

### Mechanics
- Offer: "You just spent $5. Get Pro for $14/mo for your first month — $5 off applied."
- Technically: create a Stripe coupon `FIRST_MONTH_5OFF`; apply to Pro checkout initiated within 24h of credit purchase
- This is a classic "foot in the door" pattern — someone who just paid is 3–5× more likely to upgrade

### Implementation
- In `app/api/stripe/webhook/route.ts`: on `payment_intent.succeeded` for a credit purchase, set Redis key `shipwright:upsell:{email}` with TTL 24h
- New `GET /api/upsell` checks for this key; returns `{ eligible: true, couponCode: "FIRST_MONTH_5OFF" }` if present
- Frontend: after checkout redirect, check `/api/upsell` and show upgrade modal if eligible
- **Target files**: `app/api/stripe/webhook/route.ts`, new `app/api/upsell/route.ts`, post-checkout page

### Success Criterion
>10% of credit buyers shown the upsell convert to Pro within 24h.

### Expected Outcome
E-commerce cross-sell data suggests 8–15% upsell conversion for same-session offers. At 100 credit buyers/mo and 10% upsell rate = 10 new Pro subscribers from existing buyers.

---

## Experiment Priority Matrix

| Experiment | Effort | Revenue Impact | Risk | Run Order |
|------------|--------|----------------|------|-----------|
| E1: Pro price $19 | Low | High | Low | **Week 1** |
| E2: Annual prominence | Low | High | Low | **Week 1** |
| E3: Credit bundles | Medium | High | Low | **Week 2** |
| E5: Checkout friction | Low | Medium | Low | **Week 2** |
| E4: Soft paywall gate | Medium | High | Medium | **Week 3** |
| E8: Post-checkout upsell | Medium | High | Low | **Week 3** |
| E6: Free tier limits | Low | Medium | High | **Week 5** (after others validated) |
| E7: Team plan framing | Low | Medium | Low | **Week 4** |

---

## Measurement Dashboard (Minimal Viable)

Track these metrics weekly in a simple spreadsheet or Notion table until volume justifies a proper analytics tool:

| Metric | Formula | Target |
|--------|---------|--------|
| Activation rate | `generate_completed` / signups (7-day cohort) | >60% |
| Free→Paid CVR | `checkout_completed` / `generate_completed` (7-day) | >8% |
| Paywall CTR | `repo_paywall_clicked` / `generate_completed` | >25% |
| Checkout abandon | 1 − (`checkout_completed` / `checkout_started`) | <40% |
| Credit ARPU | total credit revenue / credit buyers | >$10 |
| Pro trial churn | cancellations / active Pro subs (monthly) | <8% |
| Annual attach | annual checkouts / (annual + monthly checkouts) | >20% |
| Viral k-factor | new signups from attribution / total signups | >0.15 |

**Data source**: `GET /api/analytics` with event name filters. Already implemented in `lib/analytics-store.ts` and `app/api/analytics/route.ts`.

---

## Pricing Page Psychological Framework

Regardless of which experiments win, follow these principles on the pricing page (`app/pricing/PricingClient.tsx`):

1. **Anchor high first**: Show Team plan before Pro, Pro before Free. Left-to-right visual anchoring makes $19 feel cheap after seeing $79.

2. **Default to Pro**: Mark Pro as "Most Popular" with a visual ring. Users default to highlighted options.

3. **Decoy effect**: The Team plan's purpose is partly to make Pro look like an obvious deal. "$79 for a team or $19 for me? Easy."

4. **Show value in time saved**: "Generates in 60 seconds what takes 4 hours manually" near the CTA. Price anchors to time, not to competitors.

5. **Social proof near checkout**: "X developers shipped this week" counter. Real-time social proof reduces checkout friction more than discounts.

6. **Risk reversal**: "30-day money-back guarantee" removes the last friction point for Pro subscribers. Cost is ~2% of revenue in refund requests based on industry benchmarks.
