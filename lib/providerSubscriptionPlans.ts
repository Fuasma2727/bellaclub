export const PROVIDER_SUBSCRIPTION_PLANS = [
  {
    id: "ten_days",
    label: "10 días hábiles",
    amount: 50000,
    durationDays: 10,
  },
  {
    id: "monthly",
    label: "30 días hábiles",
    amount: 100000,
    durationDays: 30,
  },
] as const;

export type ProviderSubscriptionPlan = (typeof PROVIDER_SUBSCRIPTION_PLANS)[number];
export type ProviderSubscriptionPlanId = ProviderSubscriptionPlan["id"];

export const DEFAULT_PROVIDER_SUBSCRIPTION_PLAN =
  PROVIDER_SUBSCRIPTION_PLANS.find((plan) => plan.id === "monthly") ||
  PROVIDER_SUBSCRIPTION_PLANS[0];

export const PROVIDER_RECHARGE_AMOUNTS = [100000, 200000, 500000] as const;

export const getProviderSubscriptionPlan = (value: unknown) =>
  PROVIDER_SUBSCRIPTION_PLANS.find((plan) => plan.id === value) ||
  DEFAULT_PROVIDER_SUBSCRIPTION_PLAN;

export const isProviderSubscriptionPlanId = (
  value: unknown
): value is ProviderSubscriptionPlanId =>
  PROVIDER_SUBSCRIPTION_PLANS.some((plan) => plan.id === value);
