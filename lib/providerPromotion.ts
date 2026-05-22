export const PROVIDER_PROMOTION_PRICE = 100000;
export const PROVIDER_PROMOTION_DAYS = 3;

export const getVerificationRank = (
  level?: number | string | null,
  badge?: string | null
) => {
  const numericLevel = Number(level || 0);

  if (numericLevel >= 1 && numericLevel <= 4) return numericLevel;

  if (badge === "platinum") return 4;
  if (badge === "gold") return 3;
  if (badge === "silver") return 2;
  if (badge === "bronze") return 1;

  return 0;
};

