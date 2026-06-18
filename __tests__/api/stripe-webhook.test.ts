import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  addShipCredits: vi.fn(),
  reserveStripeEvent: vi.fn(),
  markStripeEventProcessed: vi.fn(),
  markStripeEventFailed: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: {
      constructEvent: mocks.constructEvent,
    },
  },
  addShipCredits: mocks.addShipCredits,
}));

vi.mock("@/lib/db/stripe-events", () => ({
  reserveStripeEvent: mocks.reserveStripeEvent,
  markStripeEventProcessed: mocks.markStripeEventProcessed,
  markStripeEventFailed: mocks.markStripeEventFailed,
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: mocks.info,
    warn: mocks.warn,
    error: mocks.error,
    debug: vi.fn(),
  }),
}));

const { POST } = await import("@/app/api/stripe/webhook/route");

function webhookRequest() {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": "sig_test" },
    body: "{}",
  });
}

function checkoutCompletedEvent(planType = "credit") {
  return {
    id: "evt_123",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_123",
        customer: "cus_123",
        metadata: { planType },
      },
    },
  };
}

describe("POST /api/stripe/webhook", () => {
  const originalSecret = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    mocks.constructEvent.mockReturnValue(checkoutCompletedEvent());
    mocks.reserveStripeEvent.mockResolvedValue(true);
    mocks.markStripeEventProcessed.mockResolvedValue(undefined);
    mocks.markStripeEventFailed.mockResolvedValue(undefined);
    mocks.addShipCredits.mockResolvedValue(2);
  });

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = originalSecret;
  });

  it("adds one ship credit and marks a new checkout event processed", async () => {
    const response = await POST(webhookRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(mocks.reserveStripeEvent).toHaveBeenCalledWith("evt_123", "checkout.session.completed");
    expect(mocks.addShipCredits).toHaveBeenCalledWith("cus_123", 1);
    expect(mocks.markStripeEventProcessed).toHaveBeenCalledWith("evt_123");
  });

  it("does not add duplicate credits for an already reserved Stripe event", async () => {
    mocks.reserveStripeEvent.mockResolvedValue(false);

    const response = await POST(webhookRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true, duplicate: true });
    expect(mocks.addShipCredits).not.toHaveBeenCalled();
    expect(mocks.markStripeEventProcessed).not.toHaveBeenCalled();
  });

  it("rejects invalid webhook signatures before reserving the event", async () => {
    mocks.constructEvent.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const response = await POST(webhookRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid signature");
    expect(mocks.reserveStripeEvent).not.toHaveBeenCalled();
  });

  it("marks the event failed when checkout processing fails", async () => {
    mocks.addShipCredits.mockRejectedValue(new Error("stripe metadata update failed"));

    const response = await POST(webhookRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Webhook processing failed");
    expect(mocks.markStripeEventFailed).toHaveBeenCalledWith("evt_123", expect.any(Error));
  });

  it("does not ask Stripe to retry after credits are added but processed marking fails", async () => {
    mocks.markStripeEventProcessed.mockRejectedValue(new Error("database update failed"));

    const response = await POST(webhookRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(mocks.addShipCredits).toHaveBeenCalledWith("cus_123", 1);
    expect(mocks.markStripeEventFailed).not.toHaveBeenCalled();
  });
});
