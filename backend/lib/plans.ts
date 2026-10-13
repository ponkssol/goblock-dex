import { operator } from "./operator";

export const FREE_RPM = 10;
export const CHECKOUT_DAYS = 30;

export const CHECKOUT_PLANS = {
  builder: { usd: 20, rpm: 30, name: "Builder" },
  starter: { usd: 99, rpm: 120, name: "Starter" },
} as const;

export type CheckoutPlanId = keyof typeof CHECKOUT_PLANS;

export function isCheckoutPlan(value: string): value is CheckoutPlanId {
  return value === "builder" || value === "starter";
}

function ended(expiresAt: string | null) {
  return Boolean(expiresAt) && Date.parse(expiresAt as string) <= Date.now();
}

/** Custom and env keys stay uncapped. A lapsed monthly key falls back to the free cap. */
export function rpmFor(plan: string, expiresAt: string | null): number | null {
  const live = operator();
  if (ended(expiresAt) || plan === "free") return live.freeRpm;
  if (plan === "builder") return live.builderRpm;
  if (plan === "starter") return live.starterRpm;
  return null;
}

export function feePlan(plan: string, expiresAt: string | null): "paid" | "free" {
  if (ended(expiresAt) || plan === "free") return "free";
  return "paid";
}
