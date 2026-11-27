import { getFilenameExtension, normalizeContentType } from "@/lib/mediaCompatibility";

export const VIDEO_UPLOAD_MAX_MB = 150;
export const VIDEO_UPLOAD_MAX_BYTES = VIDEO_UPLOAD_MAX_MB * 1024 * 1024;

const videoFormats = {
  mp4: { demuxer: "mov", mime: "video/mp4" },
  mov: { demuxer: "mov", mime: "video/quicktime" },
  m4v: { demuxer: "mov", mime: "video/x-m4v" },
  webm: { demuxer: "matroska", mime: "video/webm" },
  mkv: { demuxer: "matroska", mime: "video/x-matroska" },
  avi: { demuxer: "avi", mime: "video/x-msvideo" },
  "3gp": { demuxer: "mov", mime: "video/3gpp" },
} as const;

export const VIDEO_INPUT_FORMAT_LABEL = Object.keys(videoFormats).join(", ").toUpperCase();
export const VIDEO_INPUT_ACCEPT = [
  ...Object.keys(videoFormats).map((format) => `.${format}`),
  ...Object.values(videoFormats).map(({ mime }) => mime),
].join(",");

const isVideoInputFormat = (format: string): format is keyof typeof videoFormats =>
  Object.hasOwn(videoFormats, format);

export const getVideoInputDemuxer = (format: string) =>
  isVideoInputFormat(format) ? videoFormats[format].demuxer : null;

export const getVideoInputFormat = (file: Pick<File, "name" | "type">) => {
  const extension = getFilenameExtension(file.name);
  if (isVideoInputFormat(extension)) return extension;

  const mime = normalizeContentType(file.type);
  return Object.entries(videoFormats).find(([, format]) => format.mime === mime)?.[0];
};
