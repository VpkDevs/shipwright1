import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { stripe_events } from "@/lib/db/schema";

export async function reserveStripeEvent(eventId: string, eventType: string): Promise<boolean> {
  try {
    await getDb().insert(stripe_events).values({
      id: eventId,
      type: eventType,
      status: "processing",
      updated_at: new Date(),
    });
    return true;
  } catch (error) {
    if (isUniqueViolation(error)) {
      const [existing] = await getDb()
        .select({ status: stripe_events.status })
        .from(stripe_events)
        .where(eq(stripe_events.id, eventId))
        .limit(1);

      if (existing?.status !== "failed") {
        return false;
      }

      await getDb()
        .update(stripe_events)
        .set({
          status: "processing",
          type: eventType,
          error: null,
          updated_at: new Date(),
        })
        .where(eq(stripe_events.id, eventId));
      return true;
    }

    throw error;
  }
}

export async function markStripeEventProcessed(eventId: string): Promise<void> {
  const now = new Date();
  await getDb()
    .update(stripe_events)
    .set({
      status: "processed",
      error: null,
      processed_at: now,
      updated_at: now,
    })
    .where(eq(stripe_events.id, eventId));
}

export async function markStripeEventFailed(eventId: string, error: unknown): Promise<void> {
  await getDb()
    .update(stripe_events)
    .set({
      status: "failed",
      error: serializeStripeEventError(error),
      updated_at: new Date(),
    })
    .where(eq(stripe_events.id, eventId));
}

function serializeStripeEventError(error: unknown): string {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return String(error).slice(0, 1000);
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const code = (error as { code?: string; cause?: { code?: string } }).code;
  const causeCode = (error as { cause?: { code?: string } }).cause?.code;
  return code === "23505" || causeCode === "23505";
}
