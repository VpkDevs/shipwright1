/**
 * Single source of truth for funnel + growth analytics event names.
 * Keep in sync with `lib/analytics.ts` and `app/api/analytics/route.ts`.
 */
export const ANALYTICS_EVENT_NAMES = [
  "homepage_cta_clicked",
  "pricing_cta_clicked",
  "pricing_plan_selected",
  "repo_paywall_clicked",
  "checkout_started",
  "checkout_completed",
  "demo_started",
  "demo_completed",
  "preflight_run",
  "repo_page_viewed",
  "analyze_completed",
  "first_artifact_ms",
  "generate_completed",
  "agent_completed",
  "pr_created",
  "launch_report_created",
  "launch_report_shared",
  "referral_attributed",
  "template_pack_selected",
  "deploy_handoff_viewed",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
