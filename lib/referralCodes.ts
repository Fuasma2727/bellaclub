export const PROVIDER_REFERRAL_REWARD = 20000;

export const normalizeReferralCode = (value?: string | null) => {
  if (!value) return "";

  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 128);
};
