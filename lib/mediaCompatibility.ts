export const IMAGE_UPLOAD_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const VIDEO_UPLOAD_CONTENT_TYPES = ["video/mp4"] as const;

export const MEDIA_UPLOAD_ACCEPT = [
  ...IMAGE_UPLOAD_CONTENT_TYPES,
  ...VIDEO_UPLOAD_CONTENT_TYPES,
].join(",");

export const VIDEO_UPLOAD_ACCEPT = VIDEO_UPLOAD_CONTENT_TYPES.join(",");

export const SUPPORTED_UPLOAD_FORMAT_LABEL =
  "JPG, PNG, WEBP, GIF o video MP4 compatible";

export const SUPPORTED_VIDEO_FORMAT_LABEL = "MP4 compatible (H.264/AAC)";

const uploadContentTypeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
};

const supportedUploadTypes = new Set<string>([
  ...IMAGE_UPLOAD_CONTENT_TYPES,
  ...VIDEO_UPLOAD_CONTENT_TYPES,
]);

const supportedVideoTypes = new Set<string>(VIDEO_UPLOAD_CONTENT_TYPES);
const supportedVideoExtensions = new Set(["mp4"]);

export const normalizeContentType = (value: string) => {
  return value.split(";")[0]?.trim().toLowerCase() || "";
};

export const getFilenameExtension = (value: string) => {
  const cleanValue = value.split(/[?#]/)[0] || "";
  return cleanValue.split(".").pop()?.toLowerCase() || "";
};

export const inferUploadContentType = (
  contentType: string,
  filename: string
) => {
  const normalized = normalizeContentType(contentType);
  const extensionType =
    uploadContentTypeByExtension[getFilenameExtension(filename)] || "";

  if (normalized && supportedUploadTypes.has(normalized)) {
    return normalized;
  }

  return extensionType || normalized;
};

export const isSupportedUploadContentType = (contentType: string) => {
  return supportedUploadTypes.has(normalizeContentType(contentType));
};

export const isSupportedVideoContentType = (contentType: string) => {
  return supportedVideoTypes.has(normalizeContentType(contentType));
};

export const getUploadMediaType = (contentType: string) => {
  const normalized = normalizeContentType(contentType);

  if (normalized.startsWith("video/")) return "video" as const;
  if (normalized.startsWith("image/")) return "photo" as const;
  return null;
};

export const isSupportedVideoFilename = (filename: string) => {
  return supportedVideoExtensions.has(getFilenameExtension(filename));
};

export const isSupportedVideoUrl = (url?: string | null) => {
  if (!url) return false;

  try {
    return isSupportedVideoFilename(new URL(url).pathname);
  } catch {
    return isSupportedVideoFilename(url);
  }
};

export const isSupportedMediaUrl = (
  type?: string | null,
  url?: string | null
) => {
  return type !== "video" || isSupportedVideoUrl(url);
};
