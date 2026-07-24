import { ANALYTICS_EVENT_NAMES } from "@/lib/analytics-events";
import { appendAnalyticsEvent, readAnalyticsEvents } from "@/lib/analytics-store";
import { authOptions } from "@/lib/auth";
import { createLogger, generateRequestId } from "@/lib/logger";
import { getClientIp } from "@/lib/rate-limit";
import { getServerSession } from "next-auth";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const analyticsSchema = z.object({
  name: z.enum(ANALYTICS_EVENT_NAMES),
  properties: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

const analyticsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  name: z.enum(ANALYTICS_EVENT_NAMES).optional(),
});
const MAX_PROPERTY_KEYS = 50;

export async function GET(request: Request) {
  const requestId = generateRequestId();
  const logger = createLogger({
    requestId,
    route: "GET /api/analytics",
  });

  const session = await getServerSession(authOptions);

  if (!session?.user) {
    logger.warn("Unauthorized analytics read request");
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const query = analyticsQuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const events = await readAnalyticsEvents({
      limit: query.limit,
      name: query.name,
    });

    logger.info("Analytics events fetched", {
      count: events.length,
      name: query.name,
      limit: query.limit,
      user: session.user.email || "anonymous",
    });

    return Response.json({ events });
  } catch (error) {
    logger.error("Analytics read error", undefined, error);
    return Response.json({ error: "Failed to load analytics events" }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const requestId = generateRequestId();
  const logger = createLogger({
    requestId,
    route: "POST /api/analytics",
  });

  try {
    const session = await getServerSession(authOptions);
    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      logger.warn("Analytics capture invalid JSON", {
        error: error instanceof Error ? error.message : String(error),
      });
      return Response.json({ ok: false, requestId, error: "Invalid JSON body" }, { status: 400 });
    }

    const payload = analyticsSchema.parse(body);
    if (payload.properties && Object.keys(payload.properties).length > MAX_PROPERTY_KEYS) {
      return Response.json(
        {
          ok: false,
          requestId,
          error: `Too many analytics properties (max ${MAX_PROPERTY_KEYS})`,
        },
        { status: 400 }
      );
    }

    const event = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      name: payload.name,
      properties: payload.properties,
      userEmail: session?.user?.email || "anonymous",
      ipAddress: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent") || undefined,
      pathname:
        payload.properties && typeof payload.properties.pathname === "string"
          ? payload.properties.pathname
          : undefined,
      requestId,
    };

    await appendAnalyticsEvent(event);

    logger.info("Analytics event", {
      event: payload.name,
      propertyCount: payload.properties ? Object.keys(payload.properties).length : 0,
      user: event.userEmail,
      eventId: event.id,
    });

    return Response.json({ ok: true, eventId: event.id, requestId });
  } catch (error) {
    logger.error("Analytics capture error", undefined, error);
    return Response.json({ ok: false, requestId }, { status: 400 });
  }
}
