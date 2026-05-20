export const INCLUDED_PROVIDER_VIDEOS = 3;
export const EXTRA_VIDEO_SLOT_PRICE = 50000;

export type ProviderMediaItem = {
  id?: string;
  type?: "photo" | "video";
  url?: string;
  private?: boolean;
  price?: number | string | null;
  description?: string;
};

export const countProviderVideos = (media: ProviderMediaItem[]) => {
  return media.filter((item) => item.type === "video").length;
};

export const getProviderVideoLimit = (extraSlots?: number | string | null) => {
  return INCLUDED_PROVIDER_VIDEOS + Math.max(0, Number(extraSlots || 0));
};
