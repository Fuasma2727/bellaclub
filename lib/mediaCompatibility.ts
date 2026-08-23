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
const mp4ContainerBoxes = new Set([
  "moov",
  "trak",
  "mdia",
  "minf",
  "stbl",
  "edts",
  "dinf",
  "mvex",
  "moof",
  "traf",
  "meta",
  "udta",
]);
const browserVideoCodecs = new Set(["avc1", "avc3"]);
const videoSampleEntries = new Set([
  "avc1",
  "avc3",
  "hvc1",
  "hev1",
  "av01",
  "vp09",
  "mp4v",
  "encv",
  "dvh1",
  "dvhe",
  "apch",
  "apcn",
  "apco",
  "apcs",
  "ap4h",
]);
const audioSampleEntries = new Set([
  "mp4a",
  "ac-3",
  "ec-3",
  "alac",
  "Opus",
  "flac",
  "enca",
]);
const videoCodecLabels: Record<string, string> = {
  avc1: "H.264",
  avc3: "H.264",
  hvc1: "HEVC/H.265",
  hev1: "HEVC/H.265",
  av01: "AV1",
  vp09: "VP9",
  mp4v: "MPEG-4 Visual",
  encv: "video cifrado",
  dvh1: "Dolby Vision/HEVC",
  dvhe: "Dolby Vision/HEVC",
  apch: "Apple ProRes",
  apcn: "Apple ProRes",
  apco: "Apple ProRes",
  apcs: "Apple ProRes",
  ap4h: "Apple ProRes",
};

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

type VideoCompatibilityResult = {
  supported: boolean;
  message?: string;
  videoCodecs: string[];
  audioCodecs: string[];
};

const toByteView = (input: ArrayBuffer | ArrayBufferView) => {
  if (input instanceof ArrayBuffer) return new Uint8Array(input);

  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
};

const readUint32 = (bytes: Uint8Array, offset: number) => {
  if (offset + 4 > bytes.length) return 0;

  return (
    (bytes[offset] || 0) * 0x1000000 +
    (bytes[offset + 1] || 0) * 0x10000 +
    (bytes[offset + 2] || 0) * 0x100 +
    (bytes[offset + 3] || 0)
  );
};

const readUint64 = (bytes: Uint8Array, offset: number) => {
  const high = readUint32(bytes, offset);
  const low = readUint32(bytes, offset + 4);
  const value = high * 0x100000000 + low;

  return Number.isSafeInteger(value) ? value : Number.MAX_SAFE_INTEGER;
};

const readAscii = (bytes: Uint8Array, offset: number, length = 4) => {
  if (offset + length > bytes.length) return "";

  let value = "";

  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(bytes[offset + index] || 0);
  }

  return value;
};

const addUnique = (values: string[], value: string) => {
  if (value && !values.includes(value)) {
    values.push(value);
  }
};

const hasMp4FileType = (bytes: Uint8Array) => {
  let offset = 0;
  const scanEnd = Math.min(bytes.length, 64 * 1024);

  while (offset + 8 <= scanEnd) {
    const size32 = readUint32(bytes, offset);
    const type = readAscii(bytes, offset + 4);
    const headerSize = size32 === 1 ? 16 : 8;
    const size =
      size32 === 1
        ? readUint64(bytes, offset + 8)
        : size32 === 0
          ? bytes.length - offset
          : size32;

    if (type === "ftyp") return true;
    if (size < headerSize) return false;

    offset += size;
  }

  return false;
};

const detectMp4Codecs = (input: ArrayBuffer | ArrayBufferView) => {
  const bytes = toByteView(input);
  const videoCodecs: string[] = [];
  const audioCodecs: string[] = [];

  const parseStsd = (start: number, end: number) => {
    if (start + 8 > end) return;

    const entryCount = Math.min(readUint32(bytes, start + 4), 64);
    let entryOffset = start + 8;

    for (
      let index = 0;
      index < entryCount && entryOffset + 8 <= end;
      index += 1
    ) {
      const entrySize = readUint32(bytes, entryOffset);
      const entryType = readAscii(bytes, entryOffset + 4);

      if (videoSampleEntries.has(entryType)) {
        addUnique(videoCodecs, entryType);
      }

      if (audioSampleEntries.has(entryType)) {
        addUnique(audioCodecs, entryType);
      }

      if (entrySize < 8) return;

      entryOffset += entrySize;
    }
  };

  const parseBoxes = (start: number, end: number, depth = 0) => {
    if (depth > 8) return;

    let offset = start;

    while (offset + 8 <= end && offset + 8 <= bytes.length) {
      const size32 = readUint32(bytes, offset);
      const type = readAscii(bytes, offset + 4);
      const headerSize = size32 === 1 ? 16 : 8;
      const size =
        size32 === 1
          ? readUint64(bytes, offset + 8)
          : size32 === 0
            ? end - offset
            : size32;
      const boxEnd = Math.min(offset + size, end, bytes.length);

      if (!type || size < headerSize || boxEnd <= offset) return;

      const contentStart = offset + headerSize;

      if (type === "stsd") {
        parseStsd(contentStart, boxEnd);
      } else if (mp4ContainerBoxes.has(type)) {
        parseBoxes(type === "meta" ? contentStart + 4 : contentStart, boxEnd, depth + 1);
      }

      offset = boxEnd;
    }
  };

  parseBoxes(0, bytes.length);

  return { videoCodecs, audioCodecs };
};

const formatCodecList = (codecs: string[]) => {
  return codecs
    .map((codec) => videoCodecLabels[codec] || codec)
    .filter((codec, index, all) => all.indexOf(codec) === index)
    .join(", ");
};

export const validateVideoFileCompatibility = (
  input: ArrayBuffer | ArrayBufferView,
  contentType: string,
  filename: string
): VideoCompatibilityResult => {
  const normalized = normalizeContentType(contentType);
  const extension = getFilenameExtension(filename);

  if (!supportedVideoTypes.has(normalized) || extension !== "mp4") {
    return {
      supported: false,
      message:
        "Video no compatible. Sube un archivo MP4 compatible (H.264/AAC), no MOV ni HEVC.",
      videoCodecs: [],
      audioCodecs: [],
    };
  }

  const bytes = toByteView(input);

  if (!hasMp4FileType(bytes)) {
    return {
      supported: false,
      message:
        "Video no compatible. El archivo no parece ser un MP4 valido.",
      videoCodecs: [],
      audioCodecs: [],
    };
  }

  const codecs = detectMp4Codecs(bytes);
  const playableVideoCodecs = codecs.videoCodecs.filter((codec) =>
    browserVideoCodecs.has(codec)
  );

  if (playableVideoCodecs.length > 0) {
    return { supported: true, ...codecs };
  }

  const detectedCodecs = formatCodecList(codecs.videoCodecs);

  return {
    supported: false,
    message: detectedCodecs
      ? `Este video usa ${detectedCodecs}. Sube un MP4 H.264/AAC para que abra en Chrome, Firefox y celulares.`
      : "No pudimos comprobar que este video sea MP4 H.264/AAC. Convierte el archivo a MP4 H.264 y subelo de nuevo.",
    ...codecs,
  };
};
