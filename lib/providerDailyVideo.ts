import { getVerificationRank } from "@/lib/providerPromotion";

export const DAILY_VIDEO_DURATION_HOURS = 4;
export const DAILY_VIDEO_MAX_SECONDS = 30;
export const DAILY_VIDEO_REWARD_AMOUNT = 5000;

const BOGOTA_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

export const getDailyVideoRewardDateKey = (date = new Date()) => {
  return new Date(date.getTime() - BOGOTA_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
};

export const canReceiveDailyVideoReward = (profile: {
  verificationBadge?: string | null;
  badgeVerificationStatus?: string | null;
  badgeVerificationLevel?: number | string | null;
}) => {
  const approvedLevel =
    profile.badgeVerificationStatus === "approved"
      ? profile.badgeVerificationLevel
      : null;

  return getVerificationRank(approvedLevel, profile.verificationBadge) >= 1;
};
