import { rateLimitResponse } from "@/lib/rate-limit";
import { describe, expect, it } from "vitest";

describe("rateLimitResponse", () => {
  it("never returns a negative retry-after", async () => {
    const response = rateLimitResponse(0, Date.now() - 2_000);
    const payload = (await response.json()) as { retryAfter: number };

    expect(response.status).toBe(429);
    expect(payload.retryAfter).toBeGreaterThanOrEqual(1);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThanOrEqual(1);
  });
});
