"use client";

import { captureMarketingParamsOnce } from "@/lib/analytics";
import { useEffect } from "react";

/** Captures UTM / ref query params once per browser session for funnel attribution. */
export function MarketingCapture() {
  useEffect(() => {
    captureMarketingParamsOnce();
  }, []);
  return null;
}
