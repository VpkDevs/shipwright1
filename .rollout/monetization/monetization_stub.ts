export type PlanId = "free" | "pro" | "team";

export const PRICING_USD_MONTHLY: Record<PlanId, number> = {
  free: 0,
  pro: 29,
  team: 99,
};

export function canAccessFeature(plan: PlanId, required: PlanId): boolean {
  const order: PlanId[] = ["free", "pro", "team"];
  return order.indexOf(plan) >= order.indexOf(required);
}
