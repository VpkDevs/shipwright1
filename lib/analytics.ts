import type { AnalyticsEventName } from "@/lib/analytics-events";

export type { AnalyticsEventName };

const ATTR_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ref",
] as const;
const MAX_ATTR_LENGTH = 256;
const MAX_REFERRER_LENGTH = 512;
const EVENT_TIMEOUT_MS = 1500;

function toSafeValue(value: string, maxLength = MAX_ATTR_LENGTH): string {
  return value.trim().slice(0, maxLength);
}

/**
 * Persist UTM/ref from the current URL once per session (client-only).
 */
export function captureMarketingParamsOnce(): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    const hasAttribution = ATTR_KEYS.some((key) => Boolean(url.searchParams.get(key)));

    if (!sessionStorage.getItem("sw_landing_path")) {
      sessionStorage.setItem(
        "sw_landing_path",
        `${url.pathname}${url.search}`.slice(0, MAX_REFERRER_LENGTH)
      );
    }

    if (!sessionStorage.getItem("sw_attr_first_touch_ts")) {
      sessionStorage.setItem("sw_attr_first_touch_ts", Date.now().toString());
    }

    for (const key of ATTR_KEYS) {
      const v = url.searchParams.get(key);
      if (v) {
        const normalized = toSafeValue(v);
        if (!sessionStorage.getItem(`sw_ft_${key}`)) {
          sessionStorage.setItem(`sw_ft_${key}`, normalized);
        }
        sessionStorage.setItem(`sw_${key}`, normalized);
      }
    }

    if (hasAttribution) {
      sessionStorage.setItem("sw_attr_last_touch_ts", Date.now().toString());
    }
  } catch {
    // ignore
  }
}

export function getMarketingProperties(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  try {
    if (document.referrer) {
      out.referrer = document.referrer.slice(0, MAX_REFERRER_LENGTH);
    }
    const landingPath = sessionStorage.getItem("sw_landing_path");
    if (landingPath) out.landing_path = landingPath;

    const firstTouchTs = sessionStorage.getItem("sw_attr_first_touch_ts");
    const lastTouchTs = sessionStorage.getItem("sw_attr_last_touch_ts");
    if (firstTouchTs) out.attr_first_touch_ts = firstTouchTs;
    if (lastTouchTs) out.attr_last_touch_ts = lastTouchTs;

    for (const key of ATTR_KEYS) {
      const v = sessionStorage.getItem(`sw_${key}`);
      if (v) out[key] = v;
      const firstTouch = sessionStorage.getItem(`sw_ft_${key}`);
      if (firstTouch) out[`first_${key}`] = firstTouch;
    }
  } catch {
    // ignore
  }
  return out;
}

export interface AnalyticsPayload {
  name: AnalyticsEventName;
  properties?: Record<string, string | number | boolean | null | undefined>;
}

export async function trackEvent(payload: AnalyticsPayload): Promise<void> {
  if (typeof window === "undefined") return;

  let timeout: number | undefined;
  try {
    const controller = new AbortController();
    timeout = window.setTimeout(() => controller.abort(), EVENT_TIMEOUT_MS);
    const properties = {
      pathname: window.location.pathname,
      ...getMarketingProperties(),
      ...payload.properties,
    };

    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        properties,
      }),
      keepalive: true,
      signal: controller.signal,
    });
  } catch {
    // analytics should never block UX
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}
