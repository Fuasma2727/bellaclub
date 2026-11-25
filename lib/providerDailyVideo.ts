import { getVerificationRank } from "@/lib/providerPromotion";
import { getFilenameExtension, normalizeContentType } from "@/lib/mediaCompatibility";

export const DAILY_VIDEO_DURATION_HOURS = 4;
export const DAILY_VIDEO_MAX_SECONDS = 30;
export const DAILY_VIDEO_REWARD_AMOUNT = 5000;
export const DAILY_VIDEO_MAX_UPLOAD_MB = 150;
export const DAILY_VIDEO_MAX_UPLOAD_BYTES = DAILY_VIDEO_MAX_UPLOAD_MB * 1024 * 1024;

const dailyVideoFormats = {
  mp4: { demuxer: "mov", mime: "video/mp4" },
  mov: { demuxer: "mov", mime: "video/quicktime" },
  m4v: { demuxer: "mov", mime: "video/x-m4v" },
  webm: { demuxer: "matroska", mime: "video/webm" },
  mkv: { demuxer: "matroska", mime: "video/x-matroska" },
  avi: { demuxer: "avi", mime: "video/x-msvideo" },
  "3gp": { demuxer: "mov", mime: "video/3gpp" },
} as const;

export const DAILY_VIDEO_FORMAT_LABEL = Object.keys(dailyVideoFormats).join(", ").toUpperCase();
export const DAILY_VIDEO_UPLOAD_ACCEPT = [
  ...Object.keys(dailyVideoFormats).map((format) => `.${format}`),
  ...Object.values(dailyVideoFormats).map(({ mime }) => mime),
].join(",");

const isDailyVideoFormat = (format: string): format is keyof typeof dailyVideoFormats =>
  Object.hasOwn(dailyVideoFormats, format);

export const getDailyVideoDemuxer = (format: string) =>
  isDailyVideoFormat(format) ? dailyVideoFormats[format].demuxer : null;

export const getDailyVideoInputFormat = (file: Pick<File, "name" | "type">) => {
  const extension = getFilenameExtension(file.name);
  if (isDailyVideoFormat(extension)) return extension;

  const mime = normalizeContentType(file.type);
  return Object.entries(dailyVideoFormats).find(([, format]) => format.mime === mime)?.[0];
};

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
