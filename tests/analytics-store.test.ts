import { appendFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { appendAnalyticsEvent, readAnalyticsEvents } from "@/lib/analytics-store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("analytics store", () => {
  let tempDir = "";
  let previousStoragePath: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "shipwright-analytics-"));
    previousStoragePath = process.env.ANALYTICS_STORAGE_PATH;
    process.env.ANALYTICS_STORAGE_PATH = path.join(tempDir, "events.jsonl");
  });

  afterEach(async () => {
    if (previousStoragePath === undefined) {
      process.env.ANALYTICS_STORAGE_PATH = undefined;
    } else {
      process.env.ANALYTICS_STORAGE_PATH = previousStoragePath;
    }

    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns newest events first", async () => {
    await appendAnalyticsEvent({
      id: "event-1",
      timestamp: "2026-03-11T10:00:00.000Z",
      name: "pricing_cta_clicked",
      userEmail: "founder@example.com",
    });
    await appendAnalyticsEvent({
      id: "event-2",
      timestamp: "2026-03-11T10:01:00.000Z",
      name: "checkout_started",
      userEmail: "founder@example.com",
    });

    const events = await readAnalyticsEvents({ limit: 2 });

    expect(events).toHaveLength(2);
    expect(events[0]?.id).toBe("event-2");
    expect(events[1]?.id).toBe("event-1");
  });

  it("filters by event name", async () => {
    await appendAnalyticsEvent({
      id: "event-1",
      timestamp: "2026-03-11T10:00:00.000Z",
      name: "pricing_cta_clicked",
      userEmail: "founder@example.com",
    });
    await appendAnalyticsEvent({
      id: "event-2",
      timestamp: "2026-03-11T10:01:00.000Z",
      name: "checkout_started",
      userEmail: "founder@example.com",
    });

    const events = await readAnalyticsEvents({ name: "checkout_started" });

    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("event-2");
    expect(events[0]?.name).toBe("checkout_started");
  });

  it("ignores malformed json lines instead of failing", async () => {
    await appendAnalyticsEvent({
      id: "event-1",
      timestamp: "2026-03-11T10:00:00.000Z",
      name: "pricing_cta_clicked",
      userEmail: "founder@example.com",
    });

    await appendFile(path.join(tempDir, "events.jsonl"), '{"broken":', "utf8");

    const events = await readAnalyticsEvents({ limit: 5 });
    expect(events).toHaveLength(1);
    expect(events[0]?.id).toBe("event-1");
  });
});
