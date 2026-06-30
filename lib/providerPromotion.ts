export const PROVIDER_PROMOTION_PRICE = 100000;
export const PROVIDER_PROMOTION_DAYS = 3;

export type VerificationBadge = "bronze" | "silver" | "gold" | "platinum";

export const getVerificationBadgeFromLevel = (
  level?: number | string | null
): VerificationBadge | null => {
  const numericLevel = Number(level || 0);

  if (numericLevel === 1) return "bronze";
  if (numericLevel === 2) return "silver";
  if (numericLevel === 3) return "gold";
  if (numericLevel === 4) return "platinum";

  return null;
};

export const getVerificationLevelFromBadge = (
  badge?: string | null
): 1 | 2 | 3 | 4 | null => {
  if (badge === "bronze") return 1;
  if (badge === "silver") return 2;
  if (badge === "gold") return 3;
  if (badge === "platinum") return 4;

  return null;
};

export const getPublicVerificationBadge = (
  badge?: string | null,
  badgeVerificationStatus?: string | null,
  badgeVerificationLevel?: number | string | null
): VerificationBadge | null => {
  const currentBadge = getVerificationLevelFromBadge(badge)
    ? (badge as VerificationBadge)
    : null;

  if (currentBadge) return currentBadge;

  if (badgeVerificationStatus === "approved") {
    return getVerificationBadgeFromLevel(badgeVerificationLevel);
  }

  return null;
};

export const getVerificationRank = (
  level?: number | string | null,
  badge?: string | null
) => {
  const numericLevel = Number(level || 0);

  const badgeLevel = getVerificationLevelFromBadge(badge);

  if (badgeLevel) return badgeLevel;

  if (numericLevel >= 1 && numericLevel <= 4) return numericLevel;

  return 0;
};

export const getAdminQualityRank = (value?: number | string | null) => {
  const rank = Number(value || 0);

  if (!Number.isInteger(rank) || rank < 1 || rank > 5) return 0;

  return rank;
};
