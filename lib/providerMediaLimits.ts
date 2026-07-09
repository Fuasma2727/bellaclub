export const INCLUDED_PROVIDER_VIDEO_SECONDS = 3 * 60;
export const EXTRA_VIDEO_SECONDS = 60;
export const EXTRA_VIDEO_TIME_PRICE = 50000;
export const PRIVATE_CONTENT_PRICE_OPTIONS = [
  10000,
  15000,
  20000,
  50000,
  100000,
  200000,
] as const;

const privateContentPriceSet = new Set<number>(PRIVATE_CONTENT_PRICE_OPTIONS);

export const isAllowedPrivateContentPrice = (price: unknown) => {
  return privateContentPriceSet.has(Number(price));
};

export type ProviderMediaItem = {
  id?: string;
  type?: "photo" | "video";
  url?: string;
  private?: boolean;
  price?: number | string | null;
  description?: string;
  duration?: number | string | null;
};

export const getProviderVideoSecondsUsed = (media: ProviderMediaItem[]) => {
  return media
    .filter((item) => item.type === "video")
    .reduce((total, item) => total + Math.max(0, Number(item.duration || 0)), 0);
};

export const getProviderVideoSecondsLimit = (
  extraSeconds?: number | string | null
) => {
  return (
    INCLUDED_PROVIDER_VIDEO_SECONDS + Math.max(0, Number(extraSeconds || 0))
  );
};
