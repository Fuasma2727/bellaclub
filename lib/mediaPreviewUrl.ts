import type { MediaItem } from "@/app/prestadores/_components/types";

export const getMediaPreviewUrl = (providerId: string, mediaId: string) =>
  `/api/media-preview?providerId=${encodeURIComponent(providerId)}&mediaId=${encodeURIComponent(mediaId)}&v=1`;

export const withPrivateMediaPreviews = (
  providerId: string,
  media: MediaItem[]
): MediaItem[] =>
  media.map((item, index) =>
    item.private
      ? {
          ...item,
          previewUrl: getMediaPreviewUrl(providerId, item.id || `legacy-${index}`),
        }
      : item
  );
