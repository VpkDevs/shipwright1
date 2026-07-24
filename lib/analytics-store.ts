import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AnalyticsEventName } from "@/lib/analytics-events";
import { getRedis } from "@/lib/redis";

const REDIS_ANALYTICS_KEY = "shipwright:analytics:events";
const REDIS_MAX_EVENTS = 50_000;
const FILE_SCAN_CAP = 10_000;

export interface PersistedAnalyticsEvent {
  id: string;
  timestamp: string;
  name: AnalyticsEventName;
  properties?: Record<string, string | number | boolean | null>;
  userEmail: string;
  ipAddress?: string;
  userAgent?: string;
  pathname?: string;
  requestId?: string;
}

export interface AnalyticsReadOptions {
  limit?: number;
  name?: AnalyticsEventName;
}

function parseEventLine(line: string): PersistedAnalyticsEvent | null {
  try {
    const parsed = JSON.parse(line) as Partial<PersistedAnalyticsEvent>;
    if (
      typeof parsed.id !== "string" ||
      typeof parsed.timestamp !== "string" ||
      typeof parsed.name !== "string" ||
      typeof parsed.userEmail !== "string"
    ) {
      return null;
    }

    return parsed as PersistedAnalyticsEvent;
  } catch {
    return null;
  }
}

export function getAnalyticsStoragePath(): string {
  return (
    process.env.ANALYTICS_STORAGE_PATH ||
    path.join(process.cwd(), ".data", "analytics", "events.jsonl")
  );
}

async function ensureAnalyticsStorage(): Promise<string> {
  const filePath = getAnalyticsStoragePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  return filePath;
}

export async function appendAnalyticsEvent(event: PersistedAnalyticsEvent): Promise<void> {
  const line = `${JSON.stringify(event)}\n`;

  const redis = getRedis();
  if (redis) {
    await redis.lpush(REDIS_ANALYTICS_KEY, JSON.stringify(event));
    await redis.ltrim(REDIS_ANALYTICS_KEY, 0, REDIS_MAX_EVENTS - 1);
  }

  const filePath = await ensureAnalyticsStorage();
  await appendFile(filePath, line, "utf8");
}

export async function readAnalyticsEvents(
  options: AnalyticsReadOptions = {}
): Promise<PersistedAnalyticsEvent[]> {
  const { limit = 100, name } = options;
  const redis = getRedis();

  if (redis) {
    try {
      const raw = await redis.lrange(REDIS_ANALYTICS_KEY, 0, REDIS_MAX_EVENTS - 1);
      const parsed = raw
        .map((line) => parseEventLine(line))
        .filter((event): event is PersistedAnalyticsEvent => Boolean(event))
        .filter((event) => (name ? event.name === name : true));
      return parsed.slice(0, limit);
    } catch {
      // fall through to file
    }
  }

  try {
    const contents = await readFile(getAnalyticsStoragePath(), "utf8");
    const lines = contents.split(/\r?\n/).filter(Boolean);
    const recentLines = lines.slice(-FILE_SCAN_CAP);
    const parsed = recentLines
      .map((line) => parseEventLine(line))
      .filter((event): event is PersistedAnalyticsEvent => Boolean(event))
      .filter((event) => (name ? event.name === name : true))
      .reverse();
    return parsed.slice(0, limit);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
