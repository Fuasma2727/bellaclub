"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "@/components/header";
import ProfileOverview from "./_components/ProfileOverview";
import GalleryPanel, { type GalleryFilter } from "./_components/GalleryPanel";
import ProfileIcon from "./_components/ProfileIcon";
import styles from "./profile-dashboard.module.css";
import PlayableVideo from "@/components/PlayableVideo";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { colombia } from "@/lib/colombia";
import {
  EXTRA_VIDEO_TIME_PRICE,
  PRIVATE_CONTENT_PRICE_OPTIONS,
  isAllowedPrivateContentPrice,
  getProviderVideoSecondsLimit,
  getProviderVideoSecondsUsed,
} from "@/lib/providerMediaLimits";
import {
  PROVIDER_PROMOTION_DAYS,
  PROVIDER_PROMOTION_PRICE,
} from "@/lib/providerPromotion";
import {
  DAILY_VIDEO_FORMAT_LABEL,
  DAILY_VIDEO_MAX_SECONDS,
  DAILY_VIDEO_MAX_UPLOAD_BYTES,
  DAILY_VIDEO_MAX_UPLOAD_MB,
  DAILY_VIDEO_REWARD_AMOUNT,
  DAILY_VIDEO_UPLOAD_ACCEPT,
  canReceiveDailyVideoReward,
  getDailyVideoInputFormat,
} from "@/lib/providerDailyVideo";
import {
  MEDIA_UPLOAD_ACCEPT,
  SUPPORTED_UPLOAD_FORMAT_LABEL,
  SUPPORTED_VIDEO_FORMAT_LABEL,
  VIDEO_UPLOAD_ACCEPT,
  getUploadMediaType,
  inferUploadContentType as inferContentTypeFromUpload,
  isSupportedUploadContentType,
  isSupportedVideoFilename,
} from "@/lib/mediaCompatibility";
import {
  PROVIDER_REFERRAL_REWARD,
} from "@/lib/referralCodes";
import { getProviderZoneOptions } from "@/lib/providerZones";
import { DEFAULT_PROVIDER_SUBSCRIPTION_PLAN } from "@/lib/providerSubscriptionPlans";

type VerificationStatus = "pending" | "approved" | "rejected";
type BadgeVerificationStatus = "none" | "pending" | "approved" | "rejected";
type VerificationBadge = "bronze" | "silver" | "gold" | "platinum";
type BadgeVerificationLevel = 1 | 2 | 3 | 4;

type MediaItem = {
  id?: string;
  type: "photo" | "video";
  url: string;
  private?: boolean;
  price?: number | null;
  description?: string;
  duration?: number | null;
  playbackStatus?: "ready" | "failed" | null;
};

type DailyVideo = {
  url?: string;
  duration?: number | null;
  playbackStatus?: "ready" | "failed" | null;
  expiresAt?: {
    toDate?: () => Date;
  } | string | null;
};

type ProviderProfile = {
  role?: string;
  name?: string;
  description?: string;
  price?: string | number;
  department?: string;
  city?: string;
  zone?: string;
  whatsapp?: string;
  photoUrl?: string;
  media?: MediaItem[];
  profileViews?: number;
  dailyVideo?: DailyVideo | null;
  verificationStatus?: VerificationStatus;
  verificationBadge?: VerificationBadge | null;
  badgeVerificationStatus?: BadgeVerificationStatus;
  badgeVerificationLevel?: BadgeVerificationLevel;
  profileVisible?: boolean;
  profilePaused?: boolean;
  subscriptionStatus?: string | null;
  subscriptionNextChargeAt?: {
    toDate?: () => Date;
  } | string | null;
  videoSecondsExtra?: number;
  promotedUntil?: {
    toDate?: () => Date;
  } | string | null;
};

type ProviderFinanceResponse = {
  summary?: {
    privateContentIncome?: number;
  };
};




type UploadResponse = {
  url?: string;
  error?: string;
  details?: string;
};

type UploadProgressStatus = "preparing" | "uploading" | "saving" | "complete" | "error";

type MediaUploadProgressItem = {
  id: string;
  name: string;
  type: MediaItem["type"];
  previewUrl: string;
  progress: number;
  private: boolean;
  status: UploadProgressStatus;
  error?: string;
};

const MAX_IMAGE_UPLOAD_MB = 12;
const MAX_VIDEO_UPLOAD_MB = 150;

type ProviderMediaResponse = {
  media?: MediaItem[];
  error?: string;
};

type VideoSlotResponse = {
  videoSecondsExtra?: number;
  error?: string;
};

type ProviderPromotionResponse = {
  promotedUntil?: string;
  error?: string;
};

type ProviderPauseResponse = {
  paused?: boolean;
  subscriptionResult?: string;
  pauseCountThisMonth?: number;
  maxMonthlyPauses?: number;
  error?: string;
};

type DailyVideoResponse = {
  dailyVideo: {
    url: string;
    duration?: number | null;
    playbackStatus?: "ready" | "failed" | null;
    expiresAt?: string | null;
  };
  rewardAmount?: number;
  rewardEligible?: boolean;
  rewardGranted?: boolean;
  error?: string;
};

const fieldBaseClass =
  "w-full rounded-lg border border-white/10 bg-[#09090a] px-3 py-2 text-[13px] text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-blue-400/70 focus:ring-2 focus:ring-blue-500/15";

const readOnlyFieldClass =
  "rounded-md border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-sm text-neutral-200";

const privatePriceOptions = PRIVATE_CONTENT_PRICE_OPTIONS;

const verificationOptions = [
  {
    level: 1 as BadgeVerificationLevel,
    badge: "bronze" as VerificationBadge,
    title: "Bronce",
    text: "Foto de cuerpo completo sosteniendo un papel que diga BelaClub y la fecha.",
  },
  {
    level: 2 as BadgeVerificationLevel,
    badge: "silver" as VerificationBadge,
    title: "Plata",
    text: "Video de cuerpo completo sosteniendo un papel que diga BelaClub y la fecha.",
  },
  {
    level: 3 as BadgeVerificationLevel,
    badge: "gold" as VerificationBadge,
    title: "Oro",
    text: "Requiere visita presencial.",
  },
  {
    level: 4 as BadgeVerificationLevel,
    badge: "platinum" as VerificationBadge,
    title: "Diamante",
    text: "Requiere verificacion por servicio.",
  },
];

const badgeLevelByType: Record<VerificationBadge, BadgeVerificationLevel> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
};

const createMediaId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const inferUploadContentType = (file: File) => {
  return inferContentTypeFromUpload(file.type, file.name);
};

const validateUploadFile = (file: File) => {
  const contentType = inferUploadContentType(file);
  const mediaType = getUploadMediaType(contentType);

  if (!mediaType || !isSupportedUploadContentType(contentType)) {
    throw new Error(
      `Formato no permitido para "${file.name}". Usa ${SUPPORTED_UPLOAD_FORMAT_LABEL}.`
    );
  }

  if (mediaType === "video" && !isSupportedVideoFilename(file.name)) {
    throw new Error(
      `Formato no permitido para "${file.name}". Usa un ${SUPPORTED_VIDEO_FORMAT_LABEL}.`
    );
  }

  const maxSize = mediaType === "video" ? MAX_VIDEO_UPLOAD_MB : MAX_IMAGE_UPLOAD_MB;

  if (file.size > maxSize * 1024 * 1024) {
    throw new Error(`"${file.name}" supera el limite de ${maxSize} MB.`);
  }

  return { contentType, mediaType };
};

const parseUploadResponseText = (
  status: number,
  responseText: string
): UploadResponse => {
  try {
    return responseText ? (JSON.parse(responseText) as UploadResponse) : {};
  } catch {
    return {
      error:
        status === 413
          ? "El servidor rechazo el archivo por tamano. Debemos aumentar el limite de carga en el servidor."
          : `El servidor respondio con un formato inesperado (${status}). Revisa pm2 logs belaclub o el proxy del servidor.`,
      details: responseText.slice(0, 300),
    };
  }
};

const parseUploadResponse = async (res: Response): Promise<UploadResponse> => {
  return parseUploadResponseText(res.status, await res.text());
};

const uploadWithTimeout = async (
  request: () => Promise<Response>,
  timeoutMs = 10 * 60 * 1000
) => {
  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(
      () =>
        reject(
          new Error(
            "La subida tardo demasiado. Intenta con un video mas liviano o revisa la conexion."
          )
        ),
      timeoutMs
    );
  });

  return Promise.race([request(), timeout]);
};

const createUploadProgressSmoother = (
  onProgress: (progress: number) => void
) => {
  let shown = 0;
  let target = 3;
  let stopped = false;

  const publish = () => {
    onProgress(Math.max(0, Math.min(100, Math.round(shown))));
  };

  const interval = window.setInterval(() => {
    if (stopped || shown >= target) return;

    const gap = target - shown;
    const step = gap > 28 ? 5 : gap > 12 ? 3 : 1;

    shown = Math.min(target, shown + step);
    publish();
  }, 140);

  onProgress(0);

  return {
    setTarget(nextTarget: number) {
      target = Math.max(target, Math.min(99, nextTarget));
    },
    finish() {
      stopped = true;
      window.clearInterval(interval);

      return new Promise<void>((resolve) => {
        const finishInterval = window.setInterval(() => {
          const gap = 100 - shown;

          if (gap <= 0) {
            window.clearInterval(finishInterval);
            onProgress(100);
            resolve();
            return;
          }

          shown = Math.min(100, shown + Math.max(4, Math.ceil(gap / 4)));
          publish();
        }, 70);
      });
    },
    stop() {
      stopped = true;
      window.clearInterval(interval);
    },
  };
};

const uploadFileBinary = async (
  file: File,
  token: string,
  contentType: string
) => {
  return uploadWithTimeout(() =>
    fetch("/api/upload-profile-photo", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType || "application/octet-stream",
        "x-file-name": encodeURIComponent(file.name),
        "x-file-size": file.size.toString(),
        "x-file-type": contentType || "application/octet-stream",
      },
      body: file,
    })
  );
};

const uploadFileMultipart = async (file: File, token: string) => {
  const formData = new FormData();
  formData.append("file", file);

  return uploadWithTimeout(() =>
    fetch("/api/upload-profile-photo", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })
  );
};

const uploadFile = async (file: File, token: string) => {
  const { contentType, mediaType } = validateUploadFile(file);

  let binaryError: unknown = null;
  let res: Response | null = null;

  try {
    res = await uploadFileBinary(file, token, contentType);
  } catch (error) {
    binaryError = error;
  }

  if (!res?.ok) {
    const firstTry = res
      ? await parseUploadResponse(res)
      : {
          error:
            binaryError instanceof Error
              ? binaryError.message
              : "No pudimos conectar con el servidor de subida.",
        };

    if (res && (res.status === 413 || res.status === 401 || res.status === 403)) {
      throw new Error(
        firstTry.error || firstTry.details || "No pudimos subir el archivo"
      );
    }

    if (mediaType === "video") {
      throw new Error(
        firstTry.error || firstTry.details || "No pudimos subir el video"
      );
    }

    try {
      res = await uploadFileMultipart(file, token);
    } catch (fallbackError) {
      throw new Error(
        fallbackError instanceof Error
          ? fallbackError.message
          : firstTry.error || "No pudimos subir el archivo"
      );
    }

    if (!res.ok) {
      const fallbackData = await parseUploadResponse(res);
      throw new Error(
        fallbackData.error ||
          fallbackData.details ||
          firstTry.error ||
          "No pudimos subir el archivo"
      );
    }

    const fallbackData = await parseUploadResponse(res);

    if (!fallbackData.url) {
      throw new Error(
        fallbackData.error ||
          fallbackData.details ||
          "No pudimos subir el archivo"
      );
    }

    return fallbackData.url;
  }

  const data = await parseUploadResponse(res);

  if (!data.url) {
    throw new Error(
      data.error || data.details || "No pudimos subir el archivo"
    );
  }

  return data.url;
};

const uploadFileWithProgress = (
  file: File,
  token: string,
  onProgress: (progress: number) => void
) => {
  const { contentType } = validateUploadFile(file);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const progress = createUploadProgressSmoother(onProgress);

    xhr.open("POST", "/api/upload-profile-photo");
    xhr.timeout = 10 * 60 * 1000;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.setRequestHeader("x-file-size", file.size.toString());
    xhr.setRequestHeader("x-file-type", contentType || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) {
        progress.setTarget(12);
        return;
      }

      const uploadPercent = event.loaded / event.total;
      progress.setTarget(6 + uploadPercent * 68);
    };

    xhr.upload.onload = () => {
      progress.setTarget(88);
    };

    xhr.onload = () => {
      const data = parseUploadResponseText(xhr.status, xhr.responseText || "");

      if (xhr.status >= 200 && xhr.status < 300 && data.url) {
        const uploadedUrl = data.url;

        progress.setTarget(96);
        progress.finish().then(() => resolve(uploadedUrl));
        return;
      }

      progress.stop();
      const error = new Error(
        data.error || data.details || "No pudimos subir el archivo"
      ) as Error & { status?: number };
      error.status = xhr.status;
      reject(
        error
      );
    };

    xhr.onerror = () => {
      progress.stop();
      reject(new Error("No pudimos conectar con el servidor de subida."));
    };

    xhr.ontimeout = () => {
      progress.stop();
      reject(
        new Error(
          "La subida tardo demasiado. Intenta con un video mas liviano o revisa la conexion."
        )
      );
    };

    xhr.send(file);
  });
};

const uploadFileWithProgressFallback = async (
  file: File,
  token: string,
  onProgress: (progress: number) => void
) => {
  const { mediaType } = validateUploadFile(file);
  let progressError: unknown = null;

  try {
    return await uploadFileWithProgress(file, token, onProgress);
  } catch (error) {
    progressError = error;
  }

  const status =
    typeof progressError === "object" &&
    progressError !== null &&
    "status" in progressError
      ? Number((progressError as { status?: number }).status || 0)
      : 0;

  if (status === 401 || status === 403 || status === 413) {
    throw progressError;
  }

  if (mediaType === "video") {
    throw progressError instanceof Error
      ? progressError
      : new Error("No pudimos subir el video");
  }

  let res: Response;

  try {
    res = await uploadFileMultipart(file, token);
  } catch (fallbackError) {
    throw new Error(
      fallbackError instanceof Error
        ? fallbackError.message
        : progressError instanceof Error
          ? progressError.message
          : "No pudimos subir el archivo"
    );
  }

  const data = await parseUploadResponse(res);

  if (!res.ok || !data.url) {
    throw new Error(
      data.error ||
        data.details ||
        (progressError instanceof Error ? progressError.message : "") ||
        "No pudimos subir el archivo"
    );
  }

  onProgress(100);
  return data.url;
};

const publishDailyVideoFile = (
  file: File,
  format: string,
  token: string,
  onProgress: (percent: number | null) => void
) => new Promise<DailyVideoResponse>((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/provider-daily-video");
  xhr.responseType = "json";
  xhr.timeout = 10 * 60 * 1000;
  xhr.setRequestHeader("Authorization", `Bearer ${token}`);
  xhr.setRequestHeader("Content-Type", "application/octet-stream");
  xhr.setRequestHeader("x-video-format", format);

  xhr.upload.onprogress = ({ lengthComputable, loaded, total }) => {
    if (lengthComputable && total > 0) onProgress(Math.min(99, Math.round(loaded * 100 / total)));
  };
  xhr.upload.onload = () => onProgress(null);
  xhr.onload = () => {
    const data = xhr.response as DailyVideoResponse | null;
    if (xhr.status >= 200 && xhr.status < 300 && data?.dailyVideo?.url) {
      resolve(data);
      return;
    }

    const fallback = xhr.status === 413
      ? `El servidor rechazó el tamaño del video. Intenta con un archivo de menos de ${DAILY_VIDEO_MAX_UPLOAD_MB} MB.`
      : "No pudimos publicar el video del día. Intenta de nuevo.";
    reject(new Error(data?.error || fallback));
  };
  xhr.onerror = () => reject(new Error("Se perdió la conexión durante la subida. Intenta de nuevo."));
  xhr.ontimeout = () => reject(new Error("La subida tardó demasiado. Intenta con un video más liviano."));
  xhr.send(file);
});

const getVideoDuration = (file: File) => {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const timeout = window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          `No pudimos leer la duracion del video. Usa un ${SUPPORTED_VIDEO_FORMAT_LABEL}.`
        )
      );
    }, 15000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
    };

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.onloadedmetadata = () => {
      cleanup();

      if (!Number.isFinite(video.duration) || video.duration <= 0) {
        reject(
          new Error(
            `No pudimos leer la duracion del video. Usa un ${SUPPORTED_VIDEO_FORMAT_LABEL}.`
          )
        );
        return;
      }

      resolve(Math.ceil(video.duration));
    };
    video.onerror = () => {
      cleanup();
      reject(
        new Error(
          `No pudimos leer la duracion del video. Usa un ${SUPPORTED_VIDEO_FORMAT_LABEL}.`
        )
      );
    };
    video.src = objectUrl;
    video.load();
  });
};

const formatVideoTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

function VerificationGem({
  badge,
  className,
}: {
  badge: VerificationBadge;
  className?: string;
}) {
  const fill =
    badge === "bronze"
      ? "#b8734c"
      : badge === "silver"
        ? "#d7dde7"
        : badge === "gold"
          ? "#f3bd3e"
          : "#dff8ff";
  const glow =
    badge === "bronze"
      ? "rgba(184,115,76,0.45)"
      : badge === "silver"
        ? "rgba(226,232,240,0.55)"
        : badge === "gold"
          ? "rgba(251,191,36,0.7)"
          : "rgba(125,211,252,0.95)";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      style={{ filter: `drop-shadow(0 0 5px ${glow})` }}
    >
      <path
        d="M7.2 4.5h9.6l3.2 4.4L12 20 4 8.9l3.2-4.4Z"
        fill={fill}
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {badge === "platinum" && (
        <path
          d="M8.2 5.7h7.6l2.1 2.9L12 17.2 6.1 8.6l2.1-2.9Z"
          fill="url(#profileDiamondTopShine)"
          opacity="0.95"
        />
      )}
      <path
        d="M4.2 8.9h15.6M7.2 4.5l2.2 4.4L12 4.5l2.6 4.4 2.2-4.4M9.4 8.9 12 20l2.6-11.1"
        stroke="white"
        strokeOpacity={badge === "bronze" ? "0.58" : "0.82"}
        strokeWidth="0.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {badge === "platinum" && (
        <defs>
          <linearGradient
            id="profileDiamondTopShine"
            x1="7"
            x2="17"
            y1="5"
            y2="16"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#ffffff" />
            <stop offset="0.42" stopColor="#bae6fd" />
            <stop offset="1" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
}

function ProfileGalleryItem({
  item,
  isDeleting,
  onOpen,
  onDelete,
}: {
  item: MediaItem;
  isDeleting: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [failed, setFailed] = useState(false);

  const retrySrc =
    retryCount > 0
      ? `${item.url}${item.url.includes("?") ? "&" : "?"}retry=${retryCount}`
      : item.url;

  const retryImage = () => {
    if (retryCount >= 3) {
      setFailed(true);
      return;
    }

    window.setTimeout(() => {
      setRetryCount((value) => value + 1);
    }, 900 * (retryCount + 1));
  };

  return (
    <div className="group relative aspect-square overflow-hidden rounded-md border border-white/[0.08] bg-zinc-900">
      <button
        type="button"
        className="absolute inset-0 z-10"
        aria-label="Ver contenido"
        onClick={onOpen}
      />

      {item.type === "photo" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={retrySrc}
          alt=""
          draggable={false}
          onLoad={() => {
            setLoaded(true);
            setFailed(false);
          }}
          onError={retryImage}
          className={`absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105 ${
            loaded && !failed ? "opacity-100" : "opacity-0"
          }`}
        />
      ) : (
        <video
          src={item.url}
          muted
          preload="metadata"
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          onLoadedData={() => setLoaded(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {(!loaded || failed) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/[0.025] px-4 text-center">
          <div className="h-8 w-8 rounded-full border border-white/10 border-t-blue-300/80 animate-spin" />
          <p className="mt-3 text-xs font-semibold text-neutral-300">
            {failed ? "Procesando imagen" : "Cargando contenido"}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-neutral-500">
            {failed
              ? "Puede tardar unos segundos en aparecer."
              : "Preparando vista previa..."}
          </p>
        </div>
      )}

      {item.private && (
        <span className="absolute bottom-2 left-2 z-20 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-xs text-white backdrop-blur">
          Privado · ${Number(item.price || 0).toLocaleString("es-CO")}
        </span>
      )}

      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
        className="absolute right-2 top-2 z-20 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-semibold text-white opacity-90 backdrop-blur transition hover:bg-rose-600 disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100"
      >
        {isDeleting ? "..." : "Eliminar"}
      </button>
    </div>
  );
}

function UploadProgressGalleryItem({ item }: { item: MediaUploadProgressItem }) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(item.progress)));
  const isError = item.status === "error";
  const statusLabel =
    item.status === "preparing"
      ? "Preparando"
      : item.status === "saving"
        ? "Guardando"
        : item.status === "complete"
          ? "Completado"
          : isError
            ? "Error"
            : "Subiendo";

  return (
    <div
      className={`relative aspect-square overflow-hidden rounded-md border bg-zinc-900 ${
        isError ? "border-rose-400/40" : "border-blue-300/25"
      }`}
    >
      {item.type === "photo" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.previewUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
      ) : (
        <video
          src={item.previewUrl}
          muted
          playsInline
          preload="metadata"
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
      )}

      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="rounded-md border border-white/10 bg-black/70 p-2.5 backdrop-blur">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-white">
            <span className="truncate">{statusLabel}</span>
            <span>{safeProgress}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                isError ? "bg-rose-400" : "bg-blue-300"
              }`}
              style={{ width: `${safeProgress}%` }}
            />
          </div>
          <p className="mt-2 truncate text-[11px] text-neutral-300">
            {isError ? item.error || "No pudimos subir el archivo" : item.name}
          </p>
        </div>
      </div>

      {item.private && (
        <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
          Privado
        </span>
      )}
    </div>
  );
}

const revokeMediaUploadPreviews = (items: MediaUploadProgressItem[]) => {
  for (const item of items) {
    if (item.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(item.previewUrl);
    }
  }
};

const getDateValue = (value: ProviderProfile["promotedUntil"]) => {
  if (!value) return null;
  if (typeof value === "string") return value;

  return value.toDate?.().toISOString() || null;
};

export default function PerfilPrestador() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [pageLoading, setPageLoading] = useState(true);
  const [role, setRole] = useState("");
  const [verificationStatus, setVerificationStatus] =
    useState<VerificationStatus>("pending");
  const [verificationBadge, setVerificationBadge] =
    useState<VerificationBadge | null>(null);
  const [badgeVerificationStatus, setBadgeVerificationStatus] =
    useState<BadgeVerificationStatus>("none");
  const [badgeVerificationLevel, setBadgeVerificationLevel] =
    useState<BadgeVerificationLevel | null>(null);
  const [profileVisible, setProfileVisible] = useState(false);
  const [profilePaused, setProfilePaused] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(
    null
  );

  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const [zone, setZone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [profileViews, setProfileViews] = useState(0);
  const [privateContentIncome, setPrivateContentIncome] = useState(0);
  const [videoSecondsExtra, setVideoSecondsExtra] = useState(0);

  const [saving, setSaving] = useState(false);
  const [requestingBadgeVerification, setRequestingBadgeVerification] =
    useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [buyingVideoTime, setBuyingVideoTime] = useState(false);
  const [buyingPromotion, setBuyingPromotion] = useState(false);
  const [updatingPause, setUpdatingPause] = useState(false);
  const [showVideoTimePurchase, setShowVideoTimePurchase] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [mediaUploadError, setMediaUploadError] = useState("");
  const [promotionError, setPromotionError] = useState("");
  const [mediaUploadItems, setMediaUploadItems] = useState<
    MediaUploadProgressItem[]
  >([]);
  const mediaUploadItemsRef = useRef<MediaUploadProgressItem[]>([]);

  const [expandedMedia, setExpandedMedia] = useState<MediaItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [showDailyVideoUploadModal, setShowDailyVideoUploadModal] =
    useState(false);
  const [showDailyVideoModal, setShowDailyVideoModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>("all");
  const publicUploadRef = useRef<HTMLInputElement>(null);
  const privateUploadRef = useRef<HTMLInputElement>(null);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingError, setOnboardingError] = useState("");
  const [inviteCopyMessage, setInviteCopyMessage] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [contentPrice, setContentPrice] = useState("");
  const [contentDescription, setContentDescription] = useState("");
  const [privateDescriptionError, setPrivateDescriptionError] = useState("");
  const privateDescriptionRef = useRef<HTMLTextAreaElement | null>(null);
  const [selectedVerificationLevel, setSelectedVerificationLevel] =
    useState<BadgeVerificationLevel>(1);
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
  const [verificationUploadProgress, setVerificationUploadProgress] =
    useState<MediaUploadProgressItem | null>(null);
  const verificationUploadProgressRef =
    useRef<MediaUploadProgressItem | null>(null);
  const verificationFileAreaRef = useRef<HTMLDivElement | null>(null);
  const [promotedUntil, setPromotedUntil] = useState<string | null>(null);
  const [dailyVideoUrl, setDailyVideoUrl] = useState("");
  const [dailyVideoExpiresAt, setDailyVideoExpiresAt] = useState<string | null>(
    null
  );
  const [uploadingDailyVideo, setUploadingDailyVideo] = useState(false);
  const [dailyVideoUploadProgress, setDailyVideoUploadProgress] = useState<number | null>(0);
  const [dailyVideoUploadError, setDailyVideoUploadError] = useState("");
  const onboardingInitializedRef = useRef(false);

  const mediaList = useMemo<MediaItem[]>(() => {
    return [
      { type: "photo", url: photoUrl || "/default-avatar.png" },
      ...media,
    ];
  }, [photoUrl, media]);

  useEffect(() => {
    mediaUploadItemsRef.current = mediaUploadItems;
  }, [mediaUploadItems]);

  useEffect(() => {
    verificationUploadProgressRef.current = verificationUploadProgress;
  }, [verificationUploadProgress]);

  useEffect(() => {
    return () => {
      revokeMediaUploadPreviews(mediaUploadItemsRef.current);
      const verificationProgress = verificationUploadProgressRef.current;

      if (verificationProgress) {
        revokeMediaUploadPreviews([verificationProgress]);
      }
    };
  }, []);

  const videoSecondsUsed = useMemo(
    () => getProviderVideoSecondsUsed(media),
    [media]
  );
  const videoSecondsLimit = getProviderVideoSecondsLimit(videoSecondsExtra);
  const hasReachedVideoTimeLimit = videoSecondsUsed >= videoSecondsLimit;
  const showVideoTimeAction = hasReachedVideoTimeLimit || showVideoTimePurchase;
  const promotionActive = promotedUntil
    ? new Date(promotedUntil).getTime() > Date.now()
    : false;
  const dailyVideoActive = dailyVideoExpiresAt
    ? new Date(dailyVideoExpiresAt).getTime() > Date.now()
    : false;

  const cities = useMemo(() => {
    return (
      colombia.departments.find((item) => item.name === department)?.cities ||
      []
    );
  }, [department]);
  const zoneOptions = useMemo(() => getProviderZoneOptions(city), [city]);

  const hasProfilePhoto = Boolean(photoUrl);
  const whatsappDigits = whatsapp.replace(/\D/g, "");
  const onboardingPriceNumber = Number(price);
  const hasRequiredIdentity = Boolean(
    name.trim().length >= 2 && whatsappDigits.length >= 10
  );
  const hasRequiredService = Boolean(
    department &&
      city &&
      price &&
      Number.isFinite(onboardingPriceNumber) &&
      onboardingPriceNumber > 0
  );
  const hasRequiredProfileInfo =
    hasRequiredIdentity && hasRequiredService && hasProfilePhoto;
  const firstIncompleteOnboardingStep = !hasRequiredIdentity
    ? 0
    : !hasRequiredService
      ? 1
      : 2;
  const onboardingProgress = [
    hasRequiredIdentity,
    hasRequiredService,
    hasProfilePhoto,
  ].filter(Boolean).length;
  const onboardingStepValid =
    onboardingStep === 0
      ? hasRequiredIdentity
      : onboardingStep === 1
        ? hasRequiredService
        : hasProfilePhoto;
  const visiblePublicly = profileVisible && hasProfilePhoto;
  const hasBasicInfo = Boolean(
    name.trim() &&
      price &&
      department &&
      city &&
      whatsapp.trim() &&
      description.trim()
  );
  const hasGalleryContent = media.length > 0;
  const profileReadiness = [
    hasBasicInfo,
    verificationStatus === "approved",
    hasGalleryContent,
    visiblePublicly,
  ].filter(Boolean).length;
  const subscriptionLabel =
    subscriptionStatus === "active"
      ? "Plan activo"
      : subscriptionStatus === "paused"
        ? "Plan pausado"
        : subscriptionStatus === "past_due"
          ? "Plan pendiente"
          : subscriptionStatus === "admin_override"
            ? "Activada por admin"
            : "Activar plan";
  const subscriptionIsOk =
    subscriptionStatus === "active" ||
    subscriptionStatus === "admin_override" ||
    subscriptionStatus === "paused";
  const profileIndicatorIsOk = visiblePublicly && !profilePaused;
  const profileIndicatorLabel = profileIndicatorIsOk
    ? "Perfil visible"
    : profilePaused
      ? "Perfil pausado"
      : !hasProfilePhoto
        ? "Falta foto de perfil"
        : verificationStatus === "rejected"
          ? "Verificacion rechazada"
          : verificationStatus === "pending"
            ? "Verificacion pendiente"
            : "Perfil oculto";
  const profileIndicatorText = profileIndicatorIsOk
    ? "Perfil visible"
    : profilePaused
      ? "Pausado"
      : !hasProfilePhoto
        ? "Falta foto"
        : verificationStatus === "rejected"
          ? "Rechazado"
          : verificationStatus === "pending"
            ? "En revisión"
            : "Oculto";
  const profileIndicatorTone = profileIndicatorIsOk
    ? "ok"
    : verificationStatus === "rejected"
      ? "error"
      : "warning";
  const profilePriceNumber = Number(price);
  const profilePriceLabel =
    price && Number.isFinite(profilePriceNumber)
      ? `$${profilePriceNumber.toLocaleString("es-CO")}`
      : "";
  const profileLocationLabel = [zone, city || department]
    .filter(Boolean)
    .join(", ");
  const galleryCounts = {
    all: media.length,
    public: media.filter((item) => !item.private).length,
    private: media.filter((item) => item.private).length,
  };
  const filteredMedia = media
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => galleryFilter === "all" || (galleryFilter === "private" ? item.private : !item.private));
  const filteredUploads = mediaUploadItems.filter((item) =>
    galleryFilter === "all" || (galleryFilter === "private" ? item.private : !item.private)
  );
  const inviteLink =
    typeof window !== "undefined" && user?.uid
      ? `${window.location.origin}/register?ref=${encodeURIComponent(user.uid)}`
      : "";
  const onboardingSteps = [
    {
      label: "Datos del perfil",
      description: hasBasicInfo
        ? "Nombre, ubicacion, precio y WhatsApp completos."
        : "Completa nombre, ubicacion, precio, WhatsApp y descripcion.",
      done: hasBasicInfo,
      action: "profile",
      cta: "Completar datos",
    },
    {
      label: "Verificación",
      description:
        verificationStatus === "approved"
          ? "Tu perfil ya fue aprobado."
          : "Solicita una verificacion para activar tu perfil.",
      done: verificationStatus === "approved",
      action: "verification",
      cta: "Solicitar",
    },
    {
      label: "Contenido",
      description: hasGalleryContent
        ? "Ya tienes contenido visible para clientes."
        : "Sube contenido publico o privado para mejorar tu perfil.",
      done: hasGalleryContent,
      action: "gallery",
      cta: "Ir a galeria",
    },
    {
      label: "Publicación",
      description: visiblePublicly
        ? "Tu perfil esta visible publicamente."
        : "Cuando todo este listo aparecera en la pagina principal.",
      done: visiblePublicly,
      action: "status",
      cta: "Ver estado",
    },
  ];
  const effectiveVerificationBadge = verificationBadge;
  const currentVerificationLevel = effectiveVerificationBadge
    ? badgeLevelByType[effectiveVerificationBadge]
    : 0;
  const dailyVideoRewardEligible = canReceiveDailyVideoReward({
    verificationBadge,
    badgeVerificationStatus,
    badgeVerificationLevel,
  });
  const availableVerificationOptions = verificationOptions.filter(
    (option) => option.level > currentVerificationLevel
  );
  const canUpgradeVerification = currentVerificationLevel > 0 &&
    currentVerificationLevel < 4 &&
    badgeVerificationStatus !== "pending";
  const effectiveBadgeLabel =
    effectiveVerificationBadge === "bronze"
      ? "Bronce"
      : effectiveVerificationBadge === "silver"
        ? "Plata"
        : effectiveVerificationBadge === "gold"
          ? "Oro"
          : "Diamante";
  const showSuccess = (text: string) => {
    setMessage(text);
    setError("");
    window.setTimeout(() => setMessage(""), 2500);
  };
  const openRechargeBalanceModal = () => {
    window.dispatchEvent(
      new CustomEvent("belaclub:open-balance-modal", {
        detail: {
          mode: "recharge",
          context: "subscription",
          amount: DEFAULT_PROVIDER_SUBSCRIPTION_PLAN.amount,
          providerSubscriptionPlanId: DEFAULT_PROVIDER_SUBSCRIPTION_PLAN.id,
        },
      })
    );
  };
  const copyInviteLink = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteCopyMessage("Link copiado");
    } catch {
      setInviteCopyMessage("No pudimos copiarlo. Selecciona el link manualmente.");
    }

    window.setTimeout(() => setInviteCopyMessage(""), 2200);
  };
  const clearVerificationUploadProgress = useCallback(() => {
    setVerificationUploadProgress((current) => {
      if (current) {
        revokeMediaUploadPreviews([current]);
      }

      return null;
    });
  }, []);
  const closeVerificationModal = useCallback(() => {
    setShowVerificationModal(false);
    setVerificationFile(null);
    clearVerificationUploadProgress();
  }, [clearVerificationUploadProgress]);
  const scrollToVerificationFileArea = () => {
    window.setTimeout(() => {
      verificationFileAreaRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 90);
  };
  const scrollToProfileSection = (id: string) => {
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  };
  const handleOnboardingAction = (action: string) => {
    if (action === "profile") {
      setEditMode(true);
      scrollToProfileSection("datos-publicos");
      return;
    }

    if (action === "verification") {
      openVerificationRequest();
      return;
    }

    if (action === "gallery") {
      scrollToProfileSection("galeria-perfil");
      return;
    }

    scrollToProfileSection("estado-perfil");
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (
      pageLoading ||
      role !== "prestador" ||
      onboardingInitializedRef.current
    ) {
      return;
    }

    setOnboardingStep(firstIncompleteOnboardingStep);
    onboardingInitializedRef.current = true;
  }, [firstIncompleteOnboardingStep, pageLoading, role]);

  useEffect(() => {
    if (zone && !zoneOptions.includes(zone)) {
      setZone("");
    }
  }, [zone, zoneOptions]);

  useEffect(() => {
    if (!showVerificationModal) return;

    const selectedIsAvailable = availableVerificationOptions.some(
      (option) => option.level === selectedVerificationLevel
    );
    const firstAvailableLevel = availableVerificationOptions[0]?.level;

    if (!selectedIsAvailable && firstAvailableLevel) {
      setSelectedVerificationLevel(firstAvailableLevel);
      setVerificationFile(null);
      clearVerificationUploadProgress();
    }
  }, [
    availableVerificationOptions,
    clearVerificationUploadProgress,
    selectedVerificationLevel,
    showVerificationModal,
  ]);

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      setPageLoading(true);
      setError("");

      try {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          setPageLoading(false);
          return;
        }

        const data = snap.data() as ProviderProfile;

        setRole(data.role || "");
        setName(data.name || "");
        setDescription(data.description || "");
        setPrice(data.price ? String(data.price) : "");
        setDepartment(data.department || "");
        setCity(data.city || "");
        setZone(data.zone || "");
        setWhatsapp(data.whatsapp || "");
        setPhotoUrl(data.photoUrl || "");
        setMedia(Array.isArray(data.media) ? data.media : []);
        setProfileViews(Number(data.profileViews || 0));
        setVerificationStatus(data.verificationStatus || "pending");
        setVerificationBadge(data.verificationBadge || null);
        setBadgeVerificationStatus(data.badgeVerificationStatus || "none");
        setBadgeVerificationLevel(data.badgeVerificationLevel || null);
        setProfileVisible(Boolean(data.profileVisible));
        setProfilePaused(Boolean(data.profilePaused));
        setSubscriptionStatus(data.subscriptionStatus || null);
        setVideoSecondsExtra(Number(data.videoSecondsExtra || 0));
        setPromotedUntil(getDateValue(data.promotedUntil));
        setDailyVideoUrl(data.dailyVideo?.url || "");
        setDailyVideoExpiresAt(getDateValue(data.dailyVideo?.expiresAt));

        try {
          const financeRes = await fetch("/api/provider-finances", {
            headers: {
              Authorization: `Bearer ${await user.getIdToken()}`,
            },
          });

          if (financeRes.ok) {
            const financeData =
              (await financeRes.json()) as ProviderFinanceResponse;
            setPrivateContentIncome(
              Number(financeData.summary?.privateContentIncome || 0)
            );
          }
        } catch {
          setPrivateContentIncome(0);
        }
      } catch (loadError) {
        const text =
          loadError instanceof Error
            ? loadError.message
            : "No pudimos cargar tu perfil";
        setError(text);
      } finally {
        setPageLoading(false);
      }
    };

    void loadData();
  }, [user]);

  useEffect(() => {
    document.body.style.overflow =
      expandedMedia ||
      showPriceModal ||
      showVerificationModal ||
      showPauseModal ||
      showPromotionModal ||
      showDailyVideoUploadModal ||
      showDailyVideoModal ||
      showInviteModal
        ? "hidden"
        : "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [
    expandedMedia,
    showPriceModal,
    showVerificationModal,
    showPauseModal,
    showPromotionModal,
    showDailyVideoUploadModal,
    showDailyVideoModal,
    showInviteModal,
  ]);

  useEffect(() => {
    if (!expandedMedia || mediaList.length === 0) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setCurrentIndex((i) => (i + 1) % mediaList.length);
      }
      if (e.key === "ArrowLeft") {
        setCurrentIndex((i) => (i === 0 ? mediaList.length - 1 : i - 1));
      }
      if (e.key === "Escape") {
        setExpandedMedia(null);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [expandedMedia, mediaList.length]);

  const saveProfile = async () => {
    if (!user) return;

    setSaving(true);
    setError("");

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          name: name.trim(),
          description: description.trim(),
          price: price ? Number(price) : "",
          department,
          city,
          zone: zoneOptions.length > 0 ? zone.trim() : "",
          whatsapp: whatsapp.trim(),
          profileUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setEditMode(false);
      showSuccess("Perfil actualizado");
    } catch (saveError) {
      const text =
        saveError instanceof Error
          ? saveError.message
          : "No pudimos guardar los cambios";
      setError(text);
    } finally {
      setSaving(false);
    }
  };

  const saveOnboardingStep = async (step: number) => {
    if (!user) return;

    setSaving(true);
    setError("");
    setOnboardingError("");

    try {
      const payload =
        step === 0
          ? {
              name: name.trim(),
              whatsapp: whatsapp.trim(),
              profileUpdatedAt: serverTimestamp(),
            }
          : {
              name: name.trim(),
              whatsapp: whatsapp.trim(),
              price: Number(price),
              department,
              city,
              zone: zoneOptions.length > 0 ? zone.trim() : "",
              profileUpdatedAt: serverTimestamp(),
            };

      await setDoc(doc(db, "users", user.uid), payload, { merge: true });
    } catch (saveError) {
      const text =
        saveError instanceof Error
          ? saveError.message
          : "No pudimos guardar este paso";
      setOnboardingError(text);
      throw saveError;
    } finally {
      setSaving(false);
    }
  };

  const continueOnboarding = async () => {
    if (!onboardingStepValid) return;

    try {
      await saveOnboardingStep(onboardingStep);

      if (onboardingStep < 2) {
        setOnboardingStep((step) => Math.min(step + 1, 2));
        return;
      }

      showSuccess("Perfil base completado");
    } catch {
      // saveOnboardingStep already published the visible error.
    }
  };

  const handleProfilePhoto = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file || !user) return;

    setUploadingProfile(true);
    setError("");

    try {
      const url = await uploadFile(file, await user.getIdToken());
      setPhotoUrl(url);

      await setDoc(
        doc(db, "users", user.uid),
        {
          photoUrl: url,
          profileVisible:
            verificationStatus === "approved" &&
            !profilePaused &&
            subscriptionStatus !== "past_due",
          profileUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      if (
        verificationStatus === "approved" &&
        !profilePaused &&
        subscriptionStatus !== "past_due"
      ) {
        setProfileVisible(true);
      }

      showSuccess("Foto de perfil actualizada");
    } catch (uploadError) {
      const text =
        uploadError instanceof Error
          ? uploadError.message
          : "No pudimos subir la foto";
      setError(text);
    } finally {
      setUploadingProfile(false);
    }
  };

  const updateMediaUploadItem = useCallback(
    (id: string, changes: Partial<MediaUploadProgressItem>) => {
      setMediaUploadItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...changes } : item
        )
      );
    },
    []
  );

  const updateMediaUploadItems = useCallback(
    (ids: string[], changes: Partial<MediaUploadProgressItem>) => {
      const idSet = new Set(ids);

      setMediaUploadItems((current) =>
        current.map((item) =>
          idSet.has(item.id) ? { ...item, ...changes } : item
        )
      );
    },
    []
  );

  const removeMediaUploadItems = useCallback((ids: string[], delayMs = 0) => {
    const remove = () => {
      const idSet = new Set(ids);

      setMediaUploadItems((current) => {
        const removed = current.filter((item) => idSet.has(item.id));
        revokeMediaUploadPreviews(removed);
        return current.filter((item) => !idSet.has(item.id));
      });
    };

    if (delayMs > 0) {
      window.setTimeout(remove, delayMs);
      return;
    }

    remove();
  }, []);

  const createMediaUploadItems = useCallback(
    (
      preparedFiles: { file: File; type: MediaItem["type"] }[],
      isPrivate: boolean
    ) => {
      const items = preparedFiles.map((item) => ({
        id: createMediaId(),
        name: item.file.name,
        type: item.type,
        previewUrl: URL.createObjectURL(item.file),
        progress: 0,
        private: isPrivate,
        status: "preparing" as UploadProgressStatus,
      }));

      setMediaUploadItems((current) => [...items, ...current]);
      return items;
    },
    []
  );

  const uploadMediaBatch = useCallback(
    async (
      files: File[],
      isPrivate: boolean,
      forcedPrice?: number,
      privateDescription?: string
    ) => {
      if (!user || files.length === 0) return 0;

      setUploadingMedia(true);
      setError("");
      setMediaUploadError("");

      let progressItems: MediaUploadProgressItem[] = [];
      let savedCount = 0;
      const completedProgressIds = new Set<string>();

      try {
        const token = await user.getIdToken();
        const initialPreparedFiles = files.map((file) => {
          const { mediaType } = validateUploadFile(file);
          return { file, type: mediaType };
        });

        progressItems = createMediaUploadItems(initialPreparedFiles, isPrivate);

        const preparedFiles = await Promise.all(
          initialPreparedFiles.map(async (item) => {
            const duration =
              item.type === "video"
                ? await getVideoDuration(item.file).catch(() => {
                    throw new Error(
                      `No pudimos leer la duracion de "${item.file.name}". Usa un ${SUPPORTED_VIDEO_FORMAT_LABEL}.`
                    );
                  })
                : null;

            return { ...item, duration };
          })
        );
        const progressIds = progressItems.map((item) => item.id);

        const incomingVideoSeconds = preparedFiles.reduce(
          (total, item) => total + (item.duration || 0),
          0
        );

        if (
          incomingVideoSeconds > 0 &&
          videoSecondsUsed + incomingVideoSeconds > videoSecondsLimit
        ) {
          const text = `Estos videos suman ${formatVideoTime(
            incomingVideoSeconds
          )} y superan tus ${formatVideoTime(
            videoSecondsLimit
          )} incluidos. Para subirlos debes comprar tiempo extra.`;

          setShowVideoTimePurchase(true);
          setError(text);
          setMediaUploadError(text);
          updateMediaUploadItems(progressIds, {
            error: text,
            status: "error",
          });
          return 0;
        }

        const hasVideos = preparedFiles.some((item) => item.type === "video");
        const uploadBatchSize = hasVideos ? 1 : 4;

        for (let index = 0; index < preparedFiles.length; index += uploadBatchSize) {
          const group = preparedFiles.slice(index, index + uploadBatchSize);
          const groupProgressItems = progressItems.slice(
            index,
            index + uploadBatchSize
          );
          const uploadResults = await Promise.allSettled(
            group.map(async (item, groupIndex) => {
              const progressItem = groupProgressItems[groupIndex];

              if (progressItem) {
                updateMediaUploadItem(progressItem.id, {
                  progress: 0,
                  status: "uploading",
                });
              }

              const url = await uploadFileWithProgressFallback(
                item.file,
                token,
                (progress) => {
                  if (!progressItem) return;
                  updateMediaUploadItem(progressItem.id, {
                    progress,
                    status: progress >= 100 ? "saving" : "uploading",
                  });
                }
              );

              if (progressItem) {
                updateMediaUploadItem(progressItem.id, {
                  progress: 100,
                  status: "saving",
                });
              }

              return {
                id: createMediaId(),
                type: item.type,
                url,
                private: isPrivate,
                price: isPrivate ? forcedPrice || 0 : null,
                duration: item.duration,
                description: isPrivate ? privateDescription?.trim() || "" : "",
              };
            })
          );
          const groupItems: MediaItem[] = [];
          const successfulProgressIds: string[] = [];
          const failedProgressIds: string[] = [];
          let firstUploadError: unknown = null;

          uploadResults.forEach((result, resultIndex) => {
            const progressItemId = groupProgressItems[resultIndex]?.id;

            if (result.status === "fulfilled") {
              groupItems.push(result.value);
              if (progressItemId) successfulProgressIds.push(progressItemId);
              return;
            }

            if (progressItemId) failedProgressIds.push(progressItemId);
            firstUploadError = firstUploadError || result.reason;
          });

          if (groupItems.length > 0) {
            const res = await fetch("/api/provider-media", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "addMany",
                items: groupItems,
              }),
            });
            const data = (await res.json()) as ProviderMediaResponse;

            if (!res.ok || !data.media) {
              throw new Error(data.error || "No pudimos guardar el contenido");
            }

            setMedia(data.media);
            savedCount += groupItems.length;

            updateMediaUploadItems(successfulProgressIds, {
              progress: 100,
              status: "complete",
            });
            successfulProgressIds.forEach((id) => completedProgressIds.add(id));
            removeMediaUploadItems(successfulProgressIds, 900);
          }

          if (firstUploadError) {
            const text =
              firstUploadError instanceof Error
                ? firstUploadError.message
                : "No pudimos subir uno de los archivos";

            updateMediaUploadItems(failedProgressIds, {
              error: text,
              status: "error",
            });
            throw new Error(text);
          }
        }

        return savedCount;
      } catch (uploadError) {
        const text =
          uploadError instanceof Error
            ? uploadError.message
            : "No pudimos subir el contenido";

        const partialText =
          savedCount > 0
            ? `${savedCount} archivo${
                savedCount === 1 ? "" : "s"
              } subido${savedCount === 1 ? "" : "s"}. ${text}`
            : text;

        setError(partialText);
        setMediaUploadError(partialText);
        if (progressItems.length > 0) {
          const failedProgressIds = progressItems
            .filter((item) => !completedProgressIds.has(item.id))
            .map((item) => item.id);

          updateMediaUploadItems(
            failedProgressIds,
            {
              error: partialText,
              status: "error",
            }
          );
        }
        return savedCount;
      } finally {
        setUploadingMedia(false);
      }
    },
    [
      createMediaUploadItems,
      removeMediaUploadItems,
      updateMediaUploadItem,
      updateMediaUploadItems,
      user,
      videoSecondsLimit,
      videoSecondsUsed,
    ]
  );

  const deleteMedia = async (index: number) => {
    if (!user) return;

    setDeletingIndex(index);
    setError("");

    try {
      const target = media[index];
      const res = await fetch("/api/provider-media", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "delete",
          mediaId: target?.id || `legacy-${index}`,
        }),
      });
      const data = (await res.json()) as ProviderMediaResponse;

      if (!res.ok || !data.media) {
        throw new Error(data.error || "No pudimos eliminar el contenido");
      }

      setMedia(data.media);
      showSuccess("Contenido eliminado");
    } catch (deleteError) {
      const text =
        deleteError instanceof Error
          ? deleteError.message
          : "No pudimos eliminar el contenido";
      setError(text);
    } finally {
      setDeletingIndex(null);
    }
  };

  const openExpanded = (index: number) => {
    setCurrentIndex(index);
    setExpandedMedia(mediaList[index]);
  };

  const handlePublicUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const uploadedCount = await uploadMediaBatch(files, false);

    if (uploadedCount > 0) {
      showSuccess(
        uploadedCount === 1
          ? "Contenido publico subido"
          : `${uploadedCount} contenidos publicos subidos`
      );
    }
  };

  const handlePrivateUpload = async () => {
    if (pendingFiles.length === 0) return;

    const priceNum = Number(contentPrice);
    const description = contentDescription.trim();

    if (!isAllowedPrivateContentPrice(priceNum)) {
      const text = "Ingresa un precio valido para el contenido privado";
      setError(text);
      setMediaUploadError(text);
      return;
    }

    if (!description) {
      const text = "Agrega una descripcion breve del contenido privado";
      setPrivateDescriptionError(
        "Agrega una descripcion breve para que el cliente sepa que desbloquea."
      );
      setError(text);
      setMediaUploadError(text);
      privateDescriptionRef.current?.focus();
      return;
    }

    setPrivateDescriptionError("");
    setMediaUploadError("");
    const files = pendingFiles;
    setShowPriceModal(false);
    setPendingFiles([]);
    setContentPrice("");
    setContentDescription("");

    const uploadedCount = await uploadMediaBatch(
      files,
      true,
      priceNum,
      description
    );

    if (uploadedCount > 0) {
      showSuccess(
        uploadedCount === 1
          ? "Contenido privado subido"
          : `${uploadedCount} contenidos privados subidos`
      );
    }

    if (uploadedCount > 0) {
      setMediaUploadError("");
    }
  };

  const buyExtraVideoTime = async () => {
    if (!user) return;

    setBuyingVideoTime(true);
    setError("");

    try {
      const res = await fetch("/api/provider-video-slots", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
      });
      const data = (await res.json()) as VideoSlotResponse;

      if (!res.ok || typeof data.videoSecondsExtra !== "number") {
        throw new Error(data.error || "No pudimos comprar tiempo extra");
      }

      setVideoSecondsExtra(data.videoSecondsExtra);
      setShowVideoTimePurchase(false);
      showSuccess("Minuto extra de video activado");
    } catch (slotError) {
      const text =
        slotError instanceof Error
          ? slotError.message
          : "No pudimos comprar tiempo extra";
      setError(text);
    } finally {
      setBuyingVideoTime(false);
    }
  };

  const buyPromotion = async () => {
    if (!user) return;

    setBuyingPromotion(true);
    setError("");
    setPromotionError("");

    try {
      const res = await fetch("/api/provider-promotion", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
      });
      const data = (await res.json()) as ProviderPromotionResponse;

      if (!res.ok || !data.promotedUntil) {
        throw new Error(data.error || "No pudimos promocionar el perfil");
      }

      setPromotedUntil(data.promotedUntil);
      setShowPromotionModal(false);
      setPromotionError("");
      showSuccess("Perfil promocionado por 3 dias");
    } catch (promotionPurchaseError) {
      const text =
        promotionPurchaseError instanceof Error
          ? promotionPurchaseError.message
          : "No pudimos promocionar el perfil";
      setPromotionError(text);
    } finally {
      setBuyingPromotion(false);
    }
  };

  const uploadDailyVideo = async (file: File) => {
    if (!user) return;

    const format = getDailyVideoInputFormat(file);
    if (!format) {
      setDailyVideoUploadError(`Selecciona un video en formato ${DAILY_VIDEO_FORMAT_LABEL}.`);
      return;
    }
    if (!file.size || file.size > DAILY_VIDEO_MAX_UPLOAD_BYTES) {
      setDailyVideoUploadError(file.size
        ? `El video supera el límite de ${DAILY_VIDEO_MAX_UPLOAD_MB} MB.`
        : "El archivo está vacío. Selecciona otro video.");
      return;
    }

    setUploadingDailyVideo(true);
    setDailyVideoUploadProgress(0);
    setDailyVideoUploadError("");

    try {
      const data = await publishDailyVideoFile(file, format, await user.getIdToken(), setDailyVideoUploadProgress);
      setDailyVideoUrl(data.dailyVideo.url);
      setDailyVideoExpiresAt(data.dailyVideo.expiresAt || null);
      setShowDailyVideoUploadModal(false);
      showSuccess(
        data.rewardEligible === false
          ? "Video del dia publicado por 4 horas. El bono se activa desde verificacion bronce."
          : data.rewardGranted
          ? `Video del dia publicado por 4 horas. Bono de $${Number(
              data.rewardAmount || DAILY_VIDEO_REWARD_AMOUNT
            ).toLocaleString("es-CO")} agregado a tu saldo.`
          : "Video del dia publicado por 4 horas. El bono de hoy ya fue pagado."
      );
    } catch (dailyVideoError) {
      const text =
        dailyVideoError instanceof Error
          ? dailyVideoError.message
          : "No pudimos publicar el video del día.";
      setDailyVideoUploadError(text);
    } finally {
      setUploadingDailyVideo(false);
    }
  };

  const toggleProfilePause = async () => {
    if (!user) return;

    const nextPaused = !profilePaused;

    setUpdatingPause(true);
    setError("");

    try {
      const res = await fetch("/api/provider-profile-pause", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paused: nextPaused }),
      });
      const data = (await res.json()) as ProviderPauseResponse;

      if (!res.ok) {
        throw new Error(data.error || "No pudimos actualizar tu perfil");
      }

      setProfilePaused(Boolean(data.paused));
      setProfileVisible(
        !data.paused && verificationStatus === "approved" &&
          data.subscriptionResult !== "blocked"
      );
      setSubscriptionStatus(
        data.paused
          ? "paused"
          : data.subscriptionResult === "blocked"
            ? "past_due"
            : "active"
      );
      setShowPauseModal(false);
      showSuccess(
        data.paused
          ? `Perfil pausado${
              data.pauseCountThisMonth && data.maxMonthlyPauses
                ? ` (${data.pauseCountThisMonth}/${data.maxMonthlyPauses} este mes)`
                : ""
            }`
          : "Perfil reactivado"
      );
    } catch (pauseError) {
      const text =
        pauseError instanceof Error
          ? pauseError.message
          : "No pudimos actualizar tu perfil";
      setError(text);
    } finally {
      setUpdatingPause(false);
    }
  };

  const openVerificationRequest = () => {
    const firstAvailableLevel = availableVerificationOptions[0]?.level;

    if (!firstAvailableLevel) return;

    setSelectedVerificationLevel(firstAvailableLevel);
    setVerificationFile(null);
    clearVerificationUploadProgress();
    setShowVerificationModal(true);

    if (firstAvailableLevel === 1 || firstAvailableLevel === 2) {
      scrollToVerificationFileArea();
    }
  };

  const requestBadgeVerification = async () => {
    if (!user) return;

    if (selectedVerificationLevel <= currentVerificationLevel) {
      setError("Selecciona un nivel superior al que ya tienes aprobado");
      return;
    }

    if (
      (selectedVerificationLevel === 1 || selectedVerificationLevel === 2) &&
      !verificationFile
    ) {
      setError(
        selectedVerificationLevel === 1
          ? "Sube una foto sosteniendo un papel que diga BelaClub y la fecha de hoy"
          : "Sube un video sosteniendo un papel que diga BelaClub y la fecha de hoy"
      );
      scrollToVerificationFileArea();
      return;
    }

    setRequestingBadgeVerification(true);
    setError("");
    clearVerificationUploadProgress();

    let progressItem: MediaUploadProgressItem | null = null;

    try {
      let evidenceUrl: string | null = null;

      if (
        (selectedVerificationLevel === 1 || selectedVerificationLevel === 2) &&
        verificationFile
      ) {
        const expectedType =
          selectedVerificationLevel === 1 ? "photo" : "video";
        const { mediaType } = validateUploadFile(verificationFile);

        if (mediaType !== expectedType) {
          throw new Error(
            selectedVerificationLevel === 1
              ? "Selecciona una foto para esta verificacion"
              : "Selecciona un video para esta verificacion"
          );
        }

        progressItem = {
          id: createMediaId(),
          name: verificationFile.name,
          type: mediaType,
          previewUrl: URL.createObjectURL(verificationFile),
          progress: 0,
          private: false,
          status: "preparing",
        };
        setVerificationUploadProgress(progressItem);
        scrollToVerificationFileArea();

        evidenceUrl = await uploadFileWithProgressFallback(
          verificationFile,
          await user.getIdToken(),
          (progress) => {
            setVerificationUploadProgress((current) =>
              current && progressItem && current.id === progressItem.id
                ? {
                    ...current,
                    progress,
                    status: progress >= 100 ? "saving" : "uploading",
                  }
                : current
            );
          }
        );

        setVerificationUploadProgress((current) =>
          current && progressItem && current.id === progressItem.id
            ? { ...current, progress: 100, status: "saving" }
            : current
        );
      }

      await setDoc(
        doc(db, "users", user.uid),
        {
          badgeVerificationStatus: "pending",
          badgeVerificationLevel: selectedVerificationLevel,
          badgeVerificationVideoUrl: evidenceUrl,
          badgeVerificationEvidenceType:
            selectedVerificationLevel === 1
              ? "photo"
              : selectedVerificationLevel === 2
                ? "video"
                : null,
          badgeVerificationRequestedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setBadgeVerificationStatus("pending");
      setBadgeVerificationLevel(selectedVerificationLevel);
      setVerificationUploadProgress((current) =>
        current && progressItem && current.id === progressItem.id
          ? { ...current, progress: 100, status: "complete" }
          : current
      );
      window.setTimeout(() => {
        closeVerificationModal();
      }, progressItem ? 650 : 0);
      showSuccess("Solicitud de verificacion enviada");
    } catch (requestError) {
      const text =
        requestError instanceof Error
          ? requestError.message
          : "No pudimos enviar la solicitud";
      setError(text);
      setVerificationUploadProgress((current) =>
        current && progressItem && current.id === progressItem.id
          ? { ...current, error: text, status: "error" }
          : current
      );
      scrollToVerificationFileArea();
    } finally {
      setRequestingBadgeVerification(false);
    }
  };

  if (authLoading || pageLoading) {
    return (
      <div className="min-h-screen bg-[#050505] pt-14 text-white sm:pt-16">
        <Header />
        <div className="mx-auto max-w-5xl px-6 py-12 text-sm text-neutral-400">
          Cargando perfil...
        </div>
      </div>
    );
  }

  if (role && role !== "prestador") {
    return (
      <div className="min-h-screen bg-[#050505] pt-14 text-white sm:pt-16">
        <Header />
        <div className="mx-auto max-w-3xl px-6 py-12">
          <div className="rounded-lg border border-white/[0.08] bg-[#101012] p-8 text-center shadow-2xl shadow-black/30">
            <h1 className="text-2xl font-semibold">
              Este perfil es solo para escorts
            </h1>
            <p className="mt-2 text-sm text-neutral-400">
              Tu cuenta actual está registrada como cliente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (role === "prestador" && !hasRequiredProfileInfo) {
    const onboardingItems = [
      {
        title: "Identidad",
        text: "Nombre publico y WhatsApp",
        done: hasRequiredIdentity,
      },
      {
        title: "Servicio",
        text: "Precio, departamento y ciudad",
        done: hasRequiredService,
      },
      {
        title: "Foto",
        text: "Imagen principal del perfil",
        done: hasProfilePhoto,
      },
    ];
    const currentOnboardingItem =
      onboardingItems[onboardingStep] || onboardingItems[0];
    const continueLabel =
      uploadingProfile
        ? "Subiendo foto..."
        : saving
          ? "Guardando..."
          : onboardingStep === 2
            ? hasProfilePhoto
              ? "Entrar al panel"
              : "Foto pendiente"
            : "Continuar";

    return (
      <div className="min-h-screen bg-[#050505] pt-14 text-white sm:pt-16">
        <Header />

        <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[320px_1fr] lg:px-8 lg:py-8">
          {(message || error || onboardingError) && (
            <div
              className={`lg:col-span-2 rounded-md border px-4 py-3 text-sm ${
                error || onboardingError
                  ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                  : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
              }`}
            >
              {error || onboardingError || message}
            </div>
          )}

          <aside className="rounded-lg border border-white/[0.08] bg-[#101012] p-5 shadow-xl shadow-black/25">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              Creacion de perfil
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-white">
              Configura tu perfil profesional
            </h1>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Completa la informacion minima para entrar a tu panel y solicitar
              verificacion.
            </p>

            <div className="mt-5 rounded-md border border-white/[0.08] bg-white/[0.03] p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-neutral-400">
                  Progreso
                </span>
                <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-2.5 py-1 text-xs font-semibold text-blue-100">
                  {onboardingProgress}/3
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-blue-400 transition-all"
                  style={{ width: `${(onboardingProgress / 3) * 100}%` }}
                />
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {onboardingItems.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => {
                    if (index <= onboardingStep) {
                      setOnboardingStep(index);
                    }
                  }}
                  className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition ${
                    index === onboardingStep
                      ? "border-blue-300/35 bg-blue-400/[0.08]"
                      : item.done
                        ? "border-emerald-300/20 bg-emerald-400/[0.06]"
                        : "border-white/[0.08] bg-black/20"
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                      item.done
                        ? "border-emerald-300/35 bg-emerald-400/15 text-emerald-100"
                        : index === onboardingStep
                          ? "border-blue-300/35 bg-blue-400/15 text-blue-100"
                          : "border-white/10 bg-white/[0.04] text-neutral-500"
                    }`}
                  >
                    {item.done ? "OK" : index + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-neutral-500">
                      {item.text}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-lg border border-white/[0.08] bg-[#101012] p-5 shadow-xl shadow-black/25">
            <div className="flex flex-col gap-3 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                  Paso {onboardingStep + 1} de 3
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {currentOnboardingItem.title}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {currentOnboardingItem.text}
                </p>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-black/25 px-3 py-2 text-xs font-semibold text-neutral-300">
                {onboardingStepValid ? "Listo para continuar" : "Pendiente"}
              </div>
            </div>

            {onboardingStep === 0 && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="onboarding-name"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                  >
                    Nombre publico
                  </label>
                  <input
                    id="onboarding-name"
                    value={name}
                    onChange={(event) => {
                      setName(event.target.value);
                      setOnboardingError("");
                    }}
                    className={fieldBaseClass}
                    placeholder="Nombre artistico"
                    autoFocus
                  />
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Minimo 2 caracteres.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="onboarding-whatsapp"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                  >
                    WhatsApp
                  </label>
                  <div className="flex items-center rounded-lg border border-white/10 bg-[#09090a] px-3 transition focus-within:border-emerald-400/70 focus-within:ring-2 focus-within:ring-emerald-500/15">
                    <span className="text-sm font-semibold text-emerald-300">
                      WA
                    </span>
                    <input
                      id="onboarding-whatsapp"
                      type="tel"
                      value={whatsapp}
                      onChange={(event) => {
                        setWhatsapp(event.target.value);
                        setOnboardingError("");
                      }}
                      className="w-full bg-transparent px-2 py-2 text-[13px] outline-none placeholder:text-neutral-600"
                      placeholder="3001234567"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-neutral-500">
                    Usa un numero real para que puedan contactarte.
                  </p>
                </div>
              </div>
            )}

            {onboardingStep === 1 && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="onboarding-price"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                  >
                    Precio base
                  </label>
                  <div className="flex items-center rounded-lg border border-white/10 bg-[#09090a] px-3 transition focus-within:border-blue-400/70 focus-within:ring-2 focus-within:ring-blue-500/15">
                    <span className="text-neutral-500">$</span>
                    <input
                      id="onboarding-price"
                      type="number"
                      min={0}
                      step={10000}
                      value={price}
                      onChange={(event) => {
                        setPrice(event.target.value);
                        setOnboardingError("");
                      }}
                      className="w-full bg-transparent px-2 py-2 text-[13px] outline-none"
                      placeholder="50000"
                      autoFocus
                    />
                    <span className="text-sm text-neutral-500">COP</span>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="onboarding-department"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                  >
                    Departamento
                  </label>
                  <select
                    id="onboarding-department"
                    value={department}
                    onChange={(event) => {
                      setDepartment(event.target.value);
                      setCity("");
                      setZone("");
                      setOnboardingError("");
                    }}
                    className={fieldBaseClass}
                  >
                    <option value="">Selecciona</option>
                    {colombia.departments.map((item) => (
                      <option key={item.name} value={item.name}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="onboarding-city"
                    className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                  >
                    Ciudad
                  </label>
                  <select
                    id="onboarding-city"
                    value={city}
                    onChange={(event) => {
                      setCity(event.target.value);
                      setZone("");
                      setOnboardingError("");
                    }}
                    disabled={!department}
                    className={`${fieldBaseClass} disabled:cursor-not-allowed disabled:opacity-50`}
                  >
                    <option value="">Selecciona</option>
                    {cities.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                {zoneOptions.length > 0 && (
                  <div>
                    <label
                      htmlFor="onboarding-zone"
                      className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                    >
                      Zona
                    </label>
                    <select
                      id="onboarding-zone"
                      value={zone}
                      onChange={(event) => {
                        setZone(event.target.value);
                        setOnboardingError("");
                      }}
                      className={fieldBaseClass}
                    >
                      <option value="">Opcional</option>
                      {zoneOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="mt-5 grid gap-5 lg:grid-cols-[220px_1fr] lg:items-center">
                <div className="flex justify-center lg:justify-start">
                  <div className="relative h-44 w-44 overflow-hidden rounded-full border border-white/15 bg-zinc-900 shadow-2xl shadow-black/35 ring-4 ring-white/[0.04]">
                    <Image
                      src={photoUrl || "/default-avatar.png"}
                      alt="Foto de perfil"
                      fill
                      className="object-cover"
                      sizes="176px"
                      priority
                    />
                    {uploadingProfile && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm font-semibold text-white">
                        Subiendo...
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white">
                    Sube una foto principal clara
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-400">
                    Esta imagen sera la primera impresion de tu perfil. Usa una
                    foto vertical, nitida y reciente.
                  </p>
                  <label className="mt-4 inline-flex h-11 cursor-pointer items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
                    {photoUrl ? "Cambiar foto" : "Subir foto de perfil"}
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      disabled={uploadingProfile}
                      onChange={handleProfilePhoto}
                    />
                  </label>
                  <p className="mt-3 text-xs text-neutral-500">
                    Al completarla entraras al panel para solicitar verificacion
                    y subir galeria.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() =>
                  setOnboardingStep((step) => Math.max(step - 1, 0))
                }
                disabled={onboardingStep === 0 || saving || uploadingProfile}
                className="inline-flex h-11 items-center justify-center rounded-md border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Atras
              </button>

              <button
                type="button"
                onClick={() => void continueOnboarding()}
                disabled={!onboardingStepValid || saving || uploadingProfile}
                className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {continueLabel}
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#050505] pt-14 text-white sm:pt-16"
      suppressHydrationWarning
    >
      <Header />

      <main
        className={`${styles.dashboard} mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-9`}
      >
        {(message || error) && (
          <div
            className={`mb-4 rounded-md border px-4 py-3 text-sm ${
              error
                ? "border-rose-500/30 bg-rose-500/10 text-rose-100"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
            }`}
          >
            {error || message}
          </div>
        )}

        <section id="estado-perfil" className="scroll-mt-24">
          <ProfileOverview
            name={name}
            photoUrl={photoUrl}
            location={profileLocationLabel}
            price={profilePriceLabel}
            uploadingPhoto={uploadingProfile}
            editMode={editMode}
            onPhotoChange={handleProfilePhoto}
            onPhotoOpen={() => openExpanded(0)}
            onEdit={() => {
              setEditMode((value) => !value);
              if (!editMode) scrollToProfileSection("datos-publicos");
            }}
            status={profileIndicatorText}
            statusDetail={profileIndicatorLabel}
            statusTone={profileIndicatorTone}
            subscription={subscriptionLabel}
            subscriptionOk={subscriptionIsOk}
            onRecharge={openRechargeBalanceModal}
            views={profileViews.toLocaleString("es-CO")}
            income={`$${privateContentIncome.toLocaleString("es-CO")}`}
            badge={
              effectiveVerificationBadge && (
                <span className={styles.badge}>
                  <VerificationGem
                    badge={effectiveVerificationBadge}
                    className={
                      effectiveVerificationBadge === "gold"
                        ? "text-amber-200"
                        : effectiveVerificationBadge === "bronze"
                          ? "text-[#d79263]"
                          : "text-slate-100"
                    }
                  />
                  Nivel {effectiveBadgeLabel}
                </span>
              )
            }
            verificationLabel={
              requestingBadgeVerification
                ? "Procesando…"
                : badgeVerificationStatus === "pending"
                  ? "Nivel en revisión"
                  : effectiveVerificationBadge
                    ? canUpgradeVerification
                      ? "Subir de nivel"
                      : `Nivel ${effectiveBadgeLabel}`
                    : "Verificar perfil"
            }
            verificationDisabled={
              requestingBadgeVerification ||
              badgeVerificationStatus === "pending" ||
              (!!effectiveVerificationBadge && !canUpgradeVerification)
            }
            onVerification={openVerificationRequest}
            promotionActive={promotionActive}
            promotionDisabled={
              buyingPromotion || verificationStatus !== "approved" || !hasProfilePhoto
            }
            promotionHint={
              verificationStatus !== "approved"
                ? "Disponible con tu perfil aprobado"
                : !hasProfilePhoto
                  ? "Agrega tu foto principal para promocionar"
                  : promotionActive
                    ? "Extender tu promoción"
                    : "Destaca tu perfil"
            }
            onPromote={() => {
              setPromotionError("");
              setShowPromotionModal(true);
            }}
            onInvite={() => setShowInviteModal(true)}
            paused={profilePaused}
            pauseDisabled={updatingPause || verificationStatus !== "approved"}
            onPause={() => setShowPauseModal(true)}
          >
            <div
              className={
                editMode ? "border-t border-white/[0.08] p-4 sm:p-6" : undefined
              }
            >
              {editMode && (
                <div className="rounded-lg border border-white/[0.08] bg-black/25 p-2">
                  <button
                    type="button"
                    onClick={saveProfile}
                    disabled={saving}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[180px]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
                      <path d="M17 21v-8H7v8" />
                      <path d="M7 3v5h8" />
                    </svg>
                    {saving ? "Guardando..." : "Guardar cambios"}
                  </button>
                </div>
              )}

              {editMode && (
                <div
                  id="datos-publicos"
                  className="mt-3 scroll-mt-24 rounded-lg border border-white/[0.08] bg-black/25 p-3"
                >
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="name"
                        className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                      >
                        Nombre público
                      </label>
                      {editMode ? (
                        <input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={fieldBaseClass}
                          placeholder="Tu nombre o nombre artístico"
                        />
                      ) : (
                        <p className={readOnlyFieldClass}>
                          {name || "Sin completar"}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="department"
                        className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                      >
                        Departamento
                      </label>
                      {editMode ? (
                        <select
                          id="department"
                          value={department}
                          onChange={(e) => {
                            setDepartment(e.target.value);
                            setCity("");
                            setZone("");
                          }}
                          className={fieldBaseClass}
                        >
                          <option value="">Selecciona</option>
                          {colombia.departments.map((item) => (
                            <option key={item.name} value={item.name}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className={readOnlyFieldClass}>
                          {department || "Sin completar"}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="city"
                        className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                      >
                        Ciudad
                      </label>
                      {editMode ? (
                        <select
                          id="city"
                          value={city}
                          onChange={(e) => {
                            setCity(e.target.value);
                            setZone("");
                          }}
                          disabled={!department}
                          className={`${fieldBaseClass} disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          <option value="">Selecciona</option>
                          {cities.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className={readOnlyFieldClass}>
                          {city || "Sin completar"}
                        </p>
                      )}
                    </div>

                    {zoneOptions.length > 0 && (
                      <div>
                        <label
                          htmlFor="zone"
                          className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                        >
                          Zona
                        </label>
                        <select
                          id="zone"
                          value={zone}
                          onChange={(e) => setZone(e.target.value)}
                          className={fieldBaseClass}
                        >
                          <option value="">Selecciona</option>
                          {zoneOptions.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="price"
                        className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                      >
                        Precio base
                      </label>
                      {editMode ? (
                        <div className="flex items-center rounded-lg border border-white/10 bg-[#09090a] px-3 transition focus-within:border-blue-400/70 focus-within:ring-2 focus-within:ring-blue-500/15">
                          <span className="text-neutral-500">$</span>
                          <input
                            id="price"
                            type="number"
                            min={0}
                            step={10000}
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="w-full bg-transparent px-2 py-2 text-[13px] outline-none"
                            placeholder="50000"
                          />
                          <span className="text-sm text-neutral-500">COP</span>
                        </div>
                      ) : (
                        <p className={readOnlyFieldClass}>
                          {price
                            ? `$${Number(price).toLocaleString("es-CO")}`
                            : "Sin completar"}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="whatsapp"
                        className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                      >
                        WhatsApp
                      </label>
                      {editMode ? (
                        <div className="flex items-center rounded-lg border border-white/10 bg-[#09090a] px-3 transition focus-within:border-emerald-400/70 focus-within:ring-2 focus-within:ring-emerald-500/15">
                          <span className="text-sm font-semibold text-emerald-300">
                            WA
                          </span>
                          <input
                            id="whatsapp"
                            type="tel"
                            value={whatsapp}
                            onChange={(e) => setWhatsapp(e.target.value)}
                            className="w-full bg-transparent px-2 py-2 text-[13px] outline-none placeholder:text-neutral-600"
                            placeholder="3001234567"
                          />
                        </div>
                      ) : (
                        <p className={readOnlyFieldClass}>
                          {whatsapp || "Sin completar"}
                        </p>
                      )}
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="description"
                        className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500"
                      >
                        Descripción
                      </label>
                      {editMode ? (
                        <textarea
                          id="description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          rows={4}
                          className={`${fieldBaseClass} resize-none leading-6`}
                          placeholder="Cuenta qué servicios ofreces y qué pueden esperar los clientes."
                        />
                      ) : (
                        <p className="min-h-20 rounded-md border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-sm leading-6 text-neutral-300 lg:min-h-0">
                          {description || "Sin descripción"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ProfileOverview>
        </section>

        {profileReadiness < onboardingSteps.length && (
          <section className={styles.progress} aria-label="Progreso del perfil">
            <button
              type="button"
              className={styles.progressToggle}
              onClick={() => setShowQuickGuide((value) => !value)}
              aria-expanded={showQuickGuide}
              aria-controls="profile-steps"
            >
              <span className={styles.progressSymbol}>
                <ProfileIcon name="shield" />
              </span>
              <span className={styles.progressTitle}>
                Completa tu perfil{" "}
                <small>
                  {profileReadiness} de {onboardingSteps.length} pasos
                </small>
              </span>
              <span className={styles.progressRight}>
                <span className={styles.progressTrack} aria-hidden="true">
                  {onboardingSteps.map((step) => (
                    <i
                      key={step.label}
                      className={step.done ? styles.stepComplete : undefined}
                    />
                  ))}
                </span>
                <span>{showQuickGuide ? "Ocultar" : "Ver pasos"}</span>
                <ProfileIcon
                  name="chevron"
                  className={showQuickGuide ? styles.expandedChevron : undefined}
                />
              </span>
            </button>
            {showQuickGuide && (
              <div id="profile-steps" className={styles.steps}>
                {onboardingSteps.map((step, index) => (
                  <button
                    key={step.label}
                    type="button"
                    className={styles.step}
                    disabled={step.done}
                    onClick={() => handleOnboardingAction(step.action)}
                    title={step.description}
                  >
                    <span className={styles.stepNumber}>
                      {step.done ? <ProfileIcon name="check" /> : index + 1}
                    </span>
                    <span>
                      <strong>{step.label}</strong>
                      <small>
                        {step.done
                          ? "Listo"
                          : step.action === "verification" &&
                              verificationStatus === "pending"
                            ? "Solicitar revisión"
                            : step.action === "status"
                              ? "Ver estado"
                              : "Completar"}
                      </small>
                    </span>
                    {!step.done && <ProfileIcon name="arrow" />}
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        <input
          ref={publicUploadRef}
          type="file"
          accept={MEDIA_UPLOAD_ACCEPT}
          hidden
          multiple
          disabled={uploadingMedia}
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length > 0) {
              setGalleryFilter("all");
              void handlePublicUpload(files);
            }
          }}
        />
        <input
          ref={privateUploadRef}
          type="file"
          accept={MEDIA_UPLOAD_ACCEPT}
          hidden
          multiple
          disabled={uploadingMedia}
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length === 0) return;
            setGalleryFilter("all");
            setPendingFiles(files);
            setContentPrice("");
            setContentDescription("");
            setPrivateDescriptionError("");
            setMediaUploadError("");
            setShowPriceModal(true);
          }}
        />
        <GalleryPanel
          filter={galleryFilter}
          onFilter={setGalleryFilter}
          counts={galleryCounts}
          videoUsed={formatVideoTime(videoSecondsUsed)}
          videoLimit={formatVideoTime(videoSecondsLimit)}
          videoPercent={
            videoSecondsLimit > 0 ? (videoSecondsUsed / videoSecondsLimit) * 100 : 0
          }
          videoTimeAction={
            showVideoTimeAction && (
              <button
                type="button"
                disabled={buyingVideoTime}
                onClick={() => void buyExtraVideoTime()}
              >
                {buyingVideoTime
                  ? "Comprando…"
                  : `+1 min · $${EXTRA_VIDEO_TIME_PRICE.toLocaleString("es-CO")}`}
              </button>
            )
          }
          dailyVideoDisabled={
            uploadingDailyVideo ||
            verificationStatus !== "approved" ||
            !hasProfilePhoto
          }
          dailyVideoActive={dailyVideoActive}
          dailyVideoUploading={uploadingDailyVideo}
          dailyVideoHint={
            verificationStatus !== "approved" || !hasProfilePhoto
              ? "Disponible con tu perfil aprobado y tu foto principal."
              : dailyVideoActive
                ? "Tu video está destacado durante 4 horas."
                : dailyVideoRewardEligible
                  ? `Destácate por 4 horas · Bono de $${DAILY_VIDEO_REWARD_AMOUNT.toLocaleString("es-CO")}`
                  : "Destácate por 4 horas · Bono desde nivel Bronce."
          }
          onDailyVideo={() => {
            setDailyVideoUploadError("");
            setShowDailyVideoUploadModal(true);
          }}
          onPublicUpload={() => publicUploadRef.current?.click()}
          onPrivateUpload={() => privateUploadRef.current?.click()}
          uploading={uploadingMedia}
        >
          {uploadingMedia && (
            <div className="mt-4 rounded-md border border-blue-500/25 bg-blue-500/10 p-3 text-sm text-blue-100">
              Subiendo contenido...
            </div>
          )}

          {mediaUploadError && !showPriceModal && (
            <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-sm leading-6 text-rose-100">
              {mediaUploadError}
            </div>
          )}

          {filteredUploads.length === 0 && filteredMedia.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyArtwork} aria-hidden="true">
                <span>
                  <ProfileIcon
                    name={galleryFilter === "private" ? "lock" : "image"}
                  />
                </span>
              </div>
              <h3>
                {galleryFilter === "all"
                  ? "Tu galería empieza aquí"
                  : galleryFilter === "private"
                    ? "Tu espacio de contenido exclusivo"
                    : "Muestra lo mejor de ti"}
              </h3>
              <p>
                {galleryFilter === "private"
                  ? "Comparte contenido exclusivo y elige tu precio."
                  : "Agrega fotos o videos para que conozcan tu perfil."}
              </p>
              <button
                type="button"
                disabled={uploadingMedia}
                onClick={() =>
                  galleryFilter === "private"
                    ? privateUploadRef.current?.click()
                    : publicUploadRef.current?.click()
                }
              >
                <ProfileIcon name="plus" />
                {galleryFilter === "private"
                  ? "Subir contenido privado"
                  : "Agregar fotos o videos"}
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filteredUploads.map((item) => (
                <UploadProgressGalleryItem key={item.id} item={item} />
              ))}

              {filteredMedia.map(({ item, index }) => (
                <ProfileGalleryItem
                  key={`${item.url}-${index}`}
                  item={item}
                  isDeleting={deletingIndex === index}
                  onOpen={() => openExpanded(index + 1)}
                  onDelete={() => void deleteMedia(index)}
                />
              ))}
            </div>
          )}
        </GalleryPanel>
      </main>

      {showInviteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-white/[0.09] bg-[#101012] shadow-2xl shadow-black/45"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.20),transparent_38%),#111113] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">
                Programa de referidos
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Invita prestadores y gana saldo
              </h3>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Comparte tu link con otro prestador. El bono se acredita cuando
                cree su perfil y alcance minimo nivel bronce.
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-3">
                <div className="rounded-lg border border-violet-300/20 bg-violet-400/[0.08] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-violet-200">
                    Prestador referido
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-white">
                    ${PROVIDER_REFERRAL_REWARD.toLocaleString("es-CO")}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-neutral-300">
                    Se libera una sola vez cuando su perfil alcanza minimo
                    nivel bronce.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="invite-link"
                  className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500"
                >
                  Link de invitacion
                </label>
                <div className="flex gap-2">
                  <input
                    id="invite-link"
                    readOnly
                    value={inviteLink}
                    className="min-w-0 flex-1 rounded-md border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-neutral-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void copyInviteLink()}
                    className="rounded-md border border-violet-300/25 bg-violet-400/10 px-4 text-sm font-semibold text-violet-100 transition hover:border-violet-200/40 hover:bg-violet-400/15"
                  >
                    Copiar
                  </button>
                </div>
                {inviteCopyMessage && (
                  <p className="mt-2 text-xs text-violet-200">
                    {inviteCopyMessage}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-amber-300/20 bg-amber-400/[0.07] p-3 text-xs leading-5 text-amber-50/90">
                Las cuentas de cliente no generan bono. Para proteger el
                programa, solo se paga por prestadores reales verificados al
                menos en bronce.
              </div>

              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="w-full rounded-md border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.08] hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showPauseModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4"
          onClick={() => setShowPauseModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-white/[0.08] bg-[#101012] p-6 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
              Pausa temporal
            </p>
            <h3 className="mt-2 text-xl font-semibold">
              {profilePaused ? "Reactivar perfil" : "Pausar perfil"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              {profilePaused
                ? "Tu perfil volvera a aparecer si esta aprobado y la mensualidad se reactivara inmediatamente."
                : "Tu perfil dejara de aparecer en escorts y la mensualidad quedara detenida hasta que lo reactives. Puedes pausar maximo 6 veces por mes."}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowPauseModal(false)}
                className="rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={updatingPause}
                onClick={() => void toggleProfilePause()}
                className={`rounded-md px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  profilePaused
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-amber-500 hover:bg-amber-400"
                }`}
              >
                {updatingPause
                  ? "Procesando..."
                  : profilePaused
                    ? "Reactivar"
                    : "Pausar"}
              </button>
            </div>
          </div>
        </div>
      )}

        {showPromotionModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4"
          onClick={() => {
            setShowPromotionModal(false);
            setPromotionError("");
          }}
        >
          <div
            className="w-full max-w-md rounded-lg border border-white/[0.08] bg-[#101012] p-6 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">
              Visibilidad
            </p>
            <h3 className="mt-2 text-xl font-semibold">
              {promotionActive ? "Extender promocion" : "Promocionar perfil"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Por ${PROVIDER_PROMOTION_PRICE.toLocaleString("es-CO")} tu perfil
              aparecera entre los primeros durante {PROVIDER_PROMOTION_DAYS} dias.
              El valor se descontara de tu saldo.
            </p>
            {promotionActive && promotedUntil && (
              <p className="mt-3 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-100">
                Promocion activa hasta{" "}
                {new Date(promotedUntil).toLocaleString("es-CO")}
              </p>
            )}
            {promotionError && (
              <div
                role="alert"
                className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm leading-6 text-rose-100"
              >
                {promotionError}
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPromotionModal(false);
                  setPromotionError("");
                }}
                className="rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={buyingPromotion}
                onClick={() => void buyPromotion()}
                className="rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {buyingPromotion ? "Procesando..." : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDailyVideoUploadModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4"
          onClick={() => {
            if (!uploadingDailyVideo) {
              setShowDailyVideoUploadModal(false);
            }
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-lg border border-white/[0.08] bg-[#101012] shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/[0.08] bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_42%),#111113] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">
                Video del dia
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Publica y gana visibilidad
              </h3>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                El video aparecerá destacado durante 4 horas. Máximo{" "}
                {DAILY_VIDEO_MAX_SECONDS} segundos y {DAILY_VIDEO_MAX_UPLOAD_MB} MB.
              </p>
              <p className="mt-1 text-xs text-neutral-400">{DAILY_VIDEO_FORMAT_LABEL}</p>
            </div>

            <div className="space-y-4 p-5">
              <div
                className={`rounded-lg border p-4 ${
                  dailyVideoRewardEligible
                    ? "border-emerald-300/20 bg-emerald-400/[0.08]"
                    : "border-amber-300/20 bg-amber-400/[0.08]"
                }`}
              >
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.14em] ${
                    dailyVideoRewardEligible
                      ? "text-emerald-200"
                      : "text-amber-100"
                  }`}
                >
                  Bono diario
                </p>
                <p className="mt-2 text-2xl font-semibold text-white">
                  {dailyVideoRewardEligible
                    ? `+$${DAILY_VIDEO_REWARD_AMOUNT.toLocaleString("es-CO")}`
                    : "Desde nivel bronce"}
                </p>
                <p className="mt-2 text-xs leading-5 text-neutral-300">
                  {dailyVideoRewardEligible
                    ? "Se paga solo por el primer video que publiques cada dia. Puedes subir o reemplazar mas videos hoy, pero no generan otro bono."
                    : "Puedes publicar video del dia, pero el bono de saldo solo se paga a perfiles con verificacion bronce o superior."}
                </p>
              </div>

              {dailyVideoActive && (
                <div className="rounded-md border border-sky-300/20 bg-sky-400/[0.08] px-3 py-2 text-xs leading-5 text-sky-100">
                  Ya tienes un video activo. Si eliges otro archivo, el video
                  actual se reemplazara.
                </div>
              )}

              {uploadingDailyVideo && (
                <div className="space-y-2 text-xs text-sky-100">
                  <p role="status">
                    {dailyVideoUploadProgress === null ? "Preparando el video para publicarlo…" : "Subiendo el video…"}
                  </p>
                  <progress
                    aria-label="Progreso de subida del video"
                    className="block h-2 w-full accent-sky-400"
                    max={100}
                    value={dailyVideoUploadProgress ?? undefined}
                  />
                </div>
              )}

              {dailyVideoUploadError && (
                <p role="alert" className="rounded-md bg-red-400/10 px-3 py-2 text-sm text-red-200">
                  {dailyVideoUploadError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={uploadingDailyVideo}
                  onClick={() => setShowDailyVideoUploadModal(false)}
                  className="rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancelar
                </button>
                <label
                  className={`rounded-md px-4 py-3 text-center text-sm font-semibold text-white transition ${
                    uploadingDailyVideo
                      ? "cursor-not-allowed bg-sky-700 opacity-70"
                      : "cursor-pointer bg-sky-600 hover:bg-sky-500"
                  }`}
                >
                  {uploadingDailyVideo ? "Publicando…" : "Elegir video"}
                  <input
                    type="file"
                    accept={DAILY_VIDEO_UPLOAD_ACCEPT}
                    hidden
                    disabled={uploadingDailyVideo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void uploadDailyVideo(file);
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPriceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4"
          onClick={() => {
            setShowPriceModal(false);
            setPendingFiles([]);
            setContentPrice("");
            setContentDescription("");
            setPrivateDescriptionError("");
            setMediaUploadError("");
          }}
        >
          <div
            className="w-full max-w-md rounded-lg border border-white/[0.08] bg-[#101012] p-6 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">
              Contenido privado
            </h3>
            <p className="mt-2 text-sm text-neutral-400">
              Define qué hay detrás y cuánto deberá pagar el cliente para
              desbloquearlo.
            </p>
            {pendingFiles.some(
              (file) =>
                getUploadMediaType(inferUploadContentType(file)) === "video"
            ) && (
              <div className="mt-4 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
                Los primeros 3 minutos de video estan incluidos. Si alguno de
                estos videos supera tu tiempo disponible, deberas comprar
                tiempo extra para poder subirlo.
              </div>
            )}

            {pendingFiles.length > 0 && (
              <div className="mt-4 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-neutral-300">
                {pendingFiles.length === 1
                  ? pendingFiles[0]?.name
                  : `${pendingFiles.length} archivos seleccionados`}
              </div>
            )}

            {mediaUploadError && (
              <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm leading-6 text-rose-100">
                {mediaUploadError}
              </div>
            )}

            <div className="mt-5">
              <label
                htmlFor="privateDescription"
                className="mb-2 block text-sm font-medium text-neutral-300"
              >
                Descripción
              </label>
              <textarea
                id="privateDescription"
                ref={privateDescriptionRef}
                rows={3}
                maxLength={80}
                value={contentDescription}
                onChange={(e) => {
                  setContentDescription(e.target.value);
                  if (privateDescriptionError) {
                    setPrivateDescriptionError("");
                  }
                }}
                placeholder="Ej: rostro, baile, contenido exclusivo..."
                className={`w-full resize-none rounded-md border bg-black/25 px-3 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 ${
                  privateDescriptionError
                    ? "border-rose-400/70 focus:border-rose-300 focus:ring-2 focus:ring-rose-500/25"
                    : "border-white/10 focus:border-blue-400/80 focus:ring-2 focus:ring-blue-500/20"
                }`}
              />
              <div className="mt-1 flex items-center justify-between gap-3">
                <p
                  className={`text-xs ${
                    privateDescriptionError
                      ? "text-rose-300"
                      : "text-neutral-500"
                  }`}
                >
                  {privateDescriptionError || "Describe brevemente el contenido."}
                </p>
                <p className="shrink-0 text-xs text-neutral-500">
                  {contentDescription.length}/80
                </p>
              </div>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-neutral-300">
                Precio
              </p>
              <div className="grid grid-cols-2 gap-2">
                {privatePriceOptions.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setContentPrice(String(amount))}
                    className={`rounded-md border px-3 py-3 text-sm font-semibold transition ${
                      Number(contentPrice) === amount
                        ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-100"
                        : "border-white/[0.08] bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07]"
                    }`}
                  >
                    ${amount.toLocaleString("es-CO")}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07]"
                onClick={() => {
                  setShowPriceModal(false);
                  setPendingFiles([]);
                  setContentPrice("");
                  setContentDescription("");
                  setPrivateDescriptionError("");
                  setMediaUploadError("");
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                disabled={uploadingMedia}
                onClick={() => void handlePrivateUpload()}
              >
                {uploadingMedia ? "Subiendo..." : "Subir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVerificationModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/85 px-3 py-4 backdrop-blur-sm sm:items-center sm:px-4 sm:py-6"
          onClick={() => {
            if (!requestingBadgeVerification) {
              closeVerificationModal();
            }
          }}
        >
          <div
            className="my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#101012] shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/[0.08] px-4 py-4 sm:px-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                Verificacion BelaClub
              </p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                {currentVerificationLevel > 0
                  ? "Subir nivel"
                  : "Solicitar verificacion"}
              </h3>
              <p className="mt-1 text-sm leading-5 text-neutral-400">
                {currentVerificationLevel > 0
                  ? `Nivel actual: ${effectiveBadgeLabel}. Elige un nivel superior para enviar una nueva solicitud.`
                  : "Elige el nivel que quieres solicitar. Lo revisaremos desde el panel de control."}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6">
              <div className="grid gap-2.5 sm:grid-cols-2">
                {availableVerificationOptions.map((option) => (
                  <button
                    key={option.level}
                    type="button"
                    disabled={requestingBadgeVerification}
                    onClick={() => {
                      setSelectedVerificationLevel(option.level);
                      setVerificationFile(null);
                      clearVerificationUploadProgress();
                      if (option.level === 1 || option.level === 2) {
                        scrollToVerificationFileArea();
                      }
                    }}
                    className={`rounded-lg border p-3 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${
                      selectedVerificationLevel === option.level
                        ? "border-emerald-300/50 bg-emerald-300/10 text-white shadow-lg shadow-emerald-950/25"
                        : "border-white/[0.08] bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07]"
                    }`}
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Nivel {option.level}
                    </span>
                    <span className="mt-1 block text-base font-semibold">
                      {option.title}
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 text-neutral-400">
                      {option.text}
                    </span>
                  </button>
                ))}
              </div>

              {(selectedVerificationLevel === 1 ||
                selectedVerificationLevel === 2) && (
                <div className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 p-3 text-xs leading-5 text-amber-50">
                  {selectedVerificationLevel === 1 ? (
                    <>
                      Sube una foto sosteniendo un papel que diga BelaClub y la
                      fecha del dia. Debe verse con claridad tu rostro y cuerpo
                      completo para verificar la veracidad del perfil.
                    </>
                  ) : (
                    <>
                      Sube un video sosteniendo un papel que diga BelaClub y la
                      fecha del dia, y di: soy parte de BelaClub. Debe verse con
                      claridad tu rostro y cuerpo completo para verificar la
                      veracidad del perfil.
                    </>
                  )}
                </div>
              )}

              {(selectedVerificationLevel === 1 ||
                selectedVerificationLevel === 2) && (
                <div
                  ref={verificationFileAreaRef}
                  className="mt-4 scroll-mt-24 rounded-xl border border-white/[0.08] bg-black/20 p-3"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                      Archivo requerido
                    </p>
                    <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-100">
                      {selectedVerificationLevel === 1 ? "Foto" : "Video"}
                    </span>
                  </div>
                  <label
                    className={`relative flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-emerald-300/30 bg-emerald-300/[0.06] px-4 py-5 text-center transition hover:border-emerald-200/50 hover:bg-emerald-300/[0.1] ${
                      requestingBadgeVerification
                        ? "cursor-not-allowed opacity-70"
                        : ""
                    }`}
                  >
                    <span className="text-sm font-semibold text-white">
                      {verificationFile
                        ? "Archivo seleccionado"
                        : selectedVerificationLevel === 1
                          ? "Subir foto de verificacion"
                          : "Subir video de verificacion"}
                    </span>
                    <span className="mt-1 max-w-full break-words text-xs leading-5 text-neutral-400">
                      {verificationFile
                        ? verificationFile.name
                        : "Toca aqui para elegir desde tu galeria o camara."}
                    </span>
                    <input
                      type="file"
                      accept={
                        selectedVerificationLevel === 1
                          ? "image/*"
                          : VIDEO_UPLOAD_ACCEPT
                      }
                      disabled={requestingBadgeVerification}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      onChange={(e) => {
                        setVerificationFile(e.target.files?.[0] || null);
                        clearVerificationUploadProgress();
                        e.target.value = "";
                      }}
                    />
                  </label>

                  {verificationUploadProgress && (
                    <div className="mt-3 overflow-hidden rounded-lg border border-emerald-300/20 bg-emerald-300/[0.06]">
                      <div className="relative aspect-video max-h-56 bg-black/40">
                        {verificationUploadProgress.type === "photo" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={verificationUploadProgress.previewUrl}
                            alt=""
                            className="h-full w-full object-cover opacity-80"
                          />
                        ) : (
                          <video
                            src={verificationUploadProgress.previewUrl}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover opacity-80"
                          />
                        )}
                        <div className="absolute inset-0 bg-black/35" />
                      </div>
                      <div className="p-3">
                        <div className="flex items-center justify-between gap-3 text-xs font-semibold text-white">
                          <span className="truncate">
                            {verificationUploadProgress.status === "preparing"
                              ? "Preparando archivo"
                              : verificationUploadProgress.status === "saving"
                                ? "Guardando solicitud"
                                : verificationUploadProgress.status === "complete"
                                  ? "Solicitud enviada"
                                  : verificationUploadProgress.status === "error"
                                    ? "Error"
                                    : "Subiendo verificacion"}
                          </span>
                          <span>
                            {Math.max(
                              0,
                              Math.min(
                                100,
                                Math.round(verificationUploadProgress.progress)
                              )
                            )}
                            %
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full transition-all duration-200 ${
                              verificationUploadProgress.status === "error"
                                ? "bg-rose-400"
                                : "bg-emerald-300"
                            }`}
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  Math.round(verificationUploadProgress.progress)
                                )
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="mt-2 truncate text-xs text-neutral-300">
                          {verificationUploadProgress.status === "error"
                            ? verificationUploadProgress.error ||
                              "No pudimos subir el archivo"
                            : verificationUploadProgress.name}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-white/[0.08] bg-[#101012] px-4 py-4 sm:px-6">
              <button
                type="button"
                className="rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07]"
                disabled={requestingBadgeVerification}
                onClick={() => {
                  closeVerificationModal();
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded-md bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={requestingBadgeVerification}
                onClick={() => void requestBadgeVerification()}
              >
                {requestingBadgeVerification ? "Enviando..." : "Enviar solicitud"}
              </button>
            </div>
          </div>
        </div>
        )}

        {showDailyVideoModal && dailyVideoUrl && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
            onClick={() => setShowDailyVideoModal(false)}
          >
            <div
              className="relative w-full max-w-4xl overflow-hidden rounded-xl border border-white/10 bg-black text-white shadow-2xl shadow-black/60"
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowDailyVideoModal(false)}
                className="absolute right-3 top-3 z-30 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/60 text-neutral-200 shadow-lg shadow-black/40 backdrop-blur transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar video"
              >
                X
              </button>
              <PlayableVideo
                src={dailyVideoUrl}
                controls
                autoPlay
                playsInline
                className="min-h-[220px] w-full bg-black"
                videoClassName="max-h-[82vh] w-full bg-black object-contain"
              />
            </div>
          </div>
        )}

        {expandedMedia && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
            onClick={() => setExpandedMedia(null)}
          >
            <div
              className="relative inline-flex"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                aria-label="Cerrar"
                onClick={() => setExpandedMedia(null)}
                className="absolute right-2 top-2 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-xl text-white"
              >
                ×
              </button>

              {mediaList[currentIndex]?.type === "photo" ? (
                <Image
                  src={mediaList[currentIndex].url}
                  unoptimized
                  alt="Contenido ampliado"
                  width={1400}
                  height={1400}
                  className="h-auto max-h-[90dvh] max-w-[calc(100vw-2rem)] w-auto rounded-lg object-contain"
                />
              ) : (
                <PlayableVideo
                  src={mediaList[currentIndex].url}
                  controls
                  autoPlay
                  playsInline
                  className="flex max-h-[90dvh] min-h-[220px] w-[calc(100vw-2rem)] max-w-[960px] items-center justify-center overflow-hidden rounded-lg bg-black"
                  videoClassName="h-auto max-h-[90dvh] w-full bg-black object-contain"
                />
              )}
            </div>
          </div>
        )}
    </div>
  );
}
