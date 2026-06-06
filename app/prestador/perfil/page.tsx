"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Header from "@/components/header";
import { useAuth } from "@/context/AuthContext";
import { app } from "@/lib/firebase";
import { colombia } from "@/lib/colombia";
import {
  EXTRA_VIDEO_TIME_PRICE,
  getProviderVideoSecondsLimit,
  getProviderVideoSecondsUsed,
} from "@/lib/providerMediaLimits";
import {
  PROVIDER_PROMOTION_DAYS,
  PROVIDER_PROMOTION_PRICE,
} from "@/lib/providerPromotion";
import { getProviderZoneOptions } from "@/lib/providerZones";

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
};

type DailyVideo = {
  url?: string;
  duration?: number | null;
  expiresAt?: {
    toDate?: () => Date;
  } | string | null;
};

type StatusTone = "approved" | "pending" | "rejected";

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
const MAX_VIDEO_UPLOAD_MB = 80;

const uploadContentTypeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  qt: "video/quicktime",
  m4v: "video/x-m4v",
  "3gp": "video/3gpp",
  "3gpp": "video/3gpp",
  "3g2": "video/3gpp2",
};

const supportedUploadTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
  "video/3gpp",
  "video/3gpp2",
]);

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
  dailyVideo?: {
    url: string;
    duration?: number | null;
    expiresAt?: string | null;
  };
  error?: string;
};

const DAILY_VIDEO_MAX_SECONDS = 30;

const statusCopy: Record<
  VerificationStatus,
  { label: string; description: string; tone: StatusTone }
> = {
  pending: {
    label: "Pendiente de verificación",
    description:
      "Puedes completar tu perfil mientras revisamos tu solicitud. Aún no aparece públicamente.",
    tone: "pending",
  },
  approved: {
    label: "Perfil aprobado",
    description:
      "Tu perfil puede aparecer en la pagina publica de escorts.",
    tone: "approved",
  },
  rejected: {
    label: "Verificación rechazada",
    description:
      "Tu perfil no aparece públicamente. Contacta soporte o vuelve a solicitar revisión.",
    tone: "rejected",
  },
};

const statusPillClass: Record<StatusTone, string> = {
  approved: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  pending: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  rejected: "border-rose-400/25 bg-rose-400/10 text-rose-200",
};

const fieldBaseClass =
  "w-full rounded-lg border border-white/10 bg-[#09090a] px-3 py-2 text-[13px] text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-blue-400/70 focus:ring-2 focus:ring-blue-500/15";

const readOnlyFieldClass =
  "rounded-md border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-sm text-neutral-200";

const privatePriceOptions = [10000, 50000, 100000, 200000];

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

const normalizeContentType = (value: string) => {
  return value.split(";")[0]?.trim().toLowerCase() || "";
};

const inferUploadContentType = (file: File) => {
  const browserType = normalizeContentType(file.type);
  const extension = file.name.split(".").pop()?.toLowerCase();
  const extensionType = extension
    ? uploadContentTypeByExtension[extension] || ""
    : "";

  if (browserType && supportedUploadTypes.has(browserType)) {
    return browserType;
  }

  return extensionType || browserType;
};

const getUploadMediaType = (contentType: string): MediaItem["type"] | null => {
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("image/")) return "photo";
  return null;
};

const validateUploadFile = (file: File) => {
  const contentType = inferUploadContentType(file);
  const mediaType = getUploadMediaType(contentType);

  if (!mediaType || !supportedUploadTypes.has(contentType)) {
    throw new Error(
      `Formato no permitido para "${file.name}". Usa JPG, PNG, WEBP, GIF, MP4, WEBM, MOV, M4V o 3GP.`
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
  timeoutMs = 5 * 60 * 1000
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
  const { contentType } = validateUploadFile(file);

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

    xhr.open("POST", "/api/upload-profile-photo");
    xhr.timeout = 5 * 60 * 1000;
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", contentType || "application/octet-stream");
    xhr.setRequestHeader("x-file-name", encodeURIComponent(file.name));
    xhr.setRequestHeader("x-file-size", file.size.toString());
    xhr.setRequestHeader("x-file-type", contentType || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) {
        onProgress(5);
        return;
      }

      onProgress(Math.min(99, Math.max(1, Math.round((event.loaded / event.total) * 100))));
    };

    xhr.onload = () => {
      const data = parseUploadResponseText(xhr.status, xhr.responseText || "");

      if (xhr.status >= 200 && xhr.status < 300 && data.url) {
        onProgress(100);
        resolve(data.url);
        return;
      }

      reject(
        new Error(data.error || data.details || "No pudimos subir el archivo")
      );
    };

    xhr.onerror = () => {
      reject(new Error("No pudimos conectar con el servidor de subida."));
    };

    xhr.ontimeout = () => {
      reject(
        new Error(
          "La subida tardo demasiado. Intenta con un video mas liviano o revisa la conexion."
        )
      );
    };

    onProgress(0);
    xhr.send(file);
  });
};

const getVideoDuration = (file: File) => {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);
    const timeout = window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(
        new Error(
          "No pudimos leer la duracion del video. Intenta con un MP4 mas liviano."
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
            "No pudimos leer la duracion del video. Intenta con un MP4 mas liviano."
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
          "No pudimos leer la duracion del video. Intenta con un MP4 mas liviano."
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
  const db = getFirestore(app);

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
  const [subscriptionNextChargeAt, setSubscriptionNextChargeAt] = useState<
    string | null
  >(null);

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
  const [showDailyVideoModal, setShowDailyVideoModal] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
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

  const status = statusCopy[verificationStatus];
  const hasProfilePhoto = Boolean(photoUrl);
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
    hasProfilePhoto,
    hasBasicInfo,
    verificationStatus === "approved",
    hasGalleryContent,
    visiblePublicly,
  ].filter(Boolean).length;
  const subscriptionLabel =
    subscriptionStatus === "active"
      ? "Mensualidad activa"
      : subscriptionStatus === "paused"
        ? "Mensualidad pausada"
        : subscriptionStatus === "past_due"
          ? "Mensualidad pendiente"
          : subscriptionStatus === "admin_override"
            ? "Activada por admin"
            : "Pendiente de activar";
  const subscriptionTone =
    subscriptionStatus === "active" || subscriptionStatus === "admin_override"
      ? "emerald"
      : subscriptionStatus === "paused"
        ? "amber"
        : subscriptionStatus === "past_due"
          ? "rose"
          : "blue";
  const subscriptionStatusClass =
    subscriptionTone === "emerald"
      ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-100"
      : subscriptionTone === "amber"
        ? "border-amber-400/20 bg-amber-400/[0.07] text-amber-100"
        : subscriptionTone === "rose"
          ? "border-rose-400/20 bg-rose-400/[0.07] text-rose-100"
          : "border-blue-400/20 bg-blue-400/[0.07] text-blue-100";
  const formatProfileDate = (value: string | null) => {
    if (!value) return "";
    return new Date(value).toLocaleDateString("es-CO", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };
  const onboardingSteps = [
    {
      label: "Foto principal",
      description: hasProfilePhoto
        ? "Tu tarjeta ya tiene portada."
        : "Sube una foto para poder aparecer en escorts.",
      done: hasProfilePhoto,
      action: "photo",
      cta: "Subir foto",
    },
    {
      label: "Datos publicos",
      description: hasBasicInfo
        ? "Nombre, ubicacion, precio y WhatsApp completos."
        : "Completa nombre, ubicacion, precio, WhatsApp y descripcion.",
      done: hasBasicInfo,
      action: "profile",
      cta: "Completar datos",
    },
    {
      label: "Verificacion",
      description:
        verificationStatus === "approved"
          ? "Tu perfil ya fue aprobado."
          : "Solicita una verificacion para activar tu perfil.",
      done: verificationStatus === "approved",
      action: "verification",
      cta: "Solicitar",
    },
    {
      label: "Galeria",
      description: hasGalleryContent
        ? "Ya tienes contenido visible para clientes."
        : "Sube contenido publico o privado para mejorar tu perfil.",
      done: hasGalleryContent,
      action: "gallery",
      cta: "Ir a galeria",
    },
    {
      label: "Publicacion",
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
        setVerificationStatus(data.verificationStatus || "pending");
        setVerificationBadge(data.verificationBadge || null);
        setBadgeVerificationStatus(data.badgeVerificationStatus || "none");
        setBadgeVerificationLevel(data.badgeVerificationLevel || null);
        setProfileVisible(Boolean(data.profileVisible));
        setProfilePaused(Boolean(data.profilePaused));
        setSubscriptionStatus(data.subscriptionStatus || null);
        setSubscriptionNextChargeAt(getDateValue(data.subscriptionNextChargeAt));
        setVideoSecondsExtra(Number(data.videoSecondsExtra || 0));
        setPromotedUntil(getDateValue(data.promotedUntil));
        setDailyVideoUrl(data.dailyVideo?.url || "");
        setDailyVideoExpiresAt(getDateValue(data.dailyVideo?.expiresAt));
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
  }, [user, db]);

  useEffect(() => {
    document.body.style.overflow =
      expandedMedia ||
      showPriceModal ||
      showVerificationModal ||
      showPauseModal ||
      showPromotionModal ||
      showDailyVideoModal
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
    showDailyVideoModal,
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
                      `No pudimos leer la duracion de "${item.file.name}". Intenta con un MP4 mas liviano o grabado en H.264.`
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

        const uploadedItems: MediaItem[] = [];
        const hasVideos = preparedFiles.some((item) => item.type === "video");
        const uploadBatchSize = hasVideos ? 1 : 4;

        for (let index = 0; index < preparedFiles.length; index += uploadBatchSize) {
          const group = preparedFiles.slice(index, index + uploadBatchSize);
          const groupProgressItems = progressItems.slice(
            index,
            index + uploadBatchSize
          );
          const groupItems = await Promise.all(
            group.map(async (item, groupIndex) => {
              const progressItem = groupProgressItems[groupIndex];

              if (progressItem) {
                updateMediaUploadItem(progressItem.id, {
                  progress: 0,
                  status: "uploading",
                });
              }

              const url = await uploadFileWithProgress(
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

          uploadedItems.push(...groupItems);
        }

        const res = await fetch("/api/provider-media", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "addMany",
            items: uploadedItems,
          }),
        });
        const data = (await res.json()) as ProviderMediaResponse;

        if (!res.ok || !data.media) {
          throw new Error(data.error || "No pudimos guardar el contenido");
        }

        setMedia(data.media);
        updateMediaUploadItems(progressIds, {
          progress: 100,
          status: "complete",
        });
        removeMediaUploadItems(progressIds, 900);
        return uploadedItems.length;
      } catch (uploadError) {
        const text =
          uploadError instanceof Error
            ? uploadError.message
            : "No pudimos subir el contenido";
        setError(text);
        setMediaUploadError(text);
        if (progressItems.length > 0) {
          updateMediaUploadItems(
            progressItems.map((item) => item.id),
            {
              error: text,
              status: "error",
            }
          );
        }
        return 0;
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

    if (!priceNum || priceNum <= 0) {
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
      showSuccess("Perfil promocionado por 3 dias");
    } catch (promotionError) {
      const text =
        promotionError instanceof Error
          ? promotionError.message
          : "No pudimos promocionar el perfil";
      setError(text);
    } finally {
      setBuyingPromotion(false);
    }
  };

  const uploadDailyVideo = async (file: File) => {
    if (!user) return;

    setUploadingDailyVideo(true);
    setError("");

    try {
      const { mediaType } = validateUploadFile(file);

      if (mediaType !== "video") {
        throw new Error("Selecciona un video para publicar como video del dia");
      }

      const duration = await getVideoDuration(file);

      if (duration > DAILY_VIDEO_MAX_SECONDS) {
        throw new Error(
          `El video del dia debe durar maximo ${DAILY_VIDEO_MAX_SECONDS} segundos`
        );
      }

      const url = await uploadFile(file, await user.getIdToken());
      const res = await fetch("/api/provider-daily-video", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, duration }),
      });
      const data = (await res.json()) as DailyVideoResponse;

      if (!res.ok || !data.dailyVideo) {
        throw new Error(data.error || "No pudimos guardar el video del dia");
      }

      setDailyVideoUrl(data.dailyVideo.url);
      setDailyVideoExpiresAt(data.dailyVideo.expiresAt || null);
      showSuccess("Video del dia publicado por 4 horas");
    } catch (dailyVideoError) {
      const text =
        dailyVideoError instanceof Error
          ? dailyVideoError.message
          : "No pudimos publicar el video del dia";
      setError(text);
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

        evidenceUrl = await uploadFileWithProgress(
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

  return (
    <div
      className="min-h-screen bg-[#050505] pt-14 text-white sm:pt-16"
      suppressHydrationWarning
    >
      <Header />

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
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

        {!hasProfilePhoto && (
          <div className="mb-4 rounded-lg border border-amber-300/25 bg-amber-300/10 p-4 shadow-lg shadow-black/20">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-100">
                  Sube una foto de perfil para aparecer en escorts
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-50/75">
                  Tu perfil puede estar aprobado, pero no se mostrara en la
                  pagina principal hasta que tengas una foto principal.
                </p>
              </div>
              <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md border border-amber-200/30 bg-amber-300/15 px-4 text-xs font-semibold text-amber-50 transition hover:bg-amber-300/20">
                {uploadingProfile ? "Subiendo..." : "Subir foto"}
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  disabled={uploadingProfile}
                  onChange={handleProfilePhoto}
                />
              </label>
            </div>
          </div>
        )}

        {profileReadiness < onboardingSteps.length && (
          <section className="mb-4 rounded-lg border border-white/[0.08] bg-[#101012] p-3 shadow-xl shadow-black/20">
            <button
              type="button"
              onClick={() => setShowQuickGuide((value) => !value)}
              className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left transition hover:bg-white/[0.035]"
            >
              <span>
                <span className="block text-sm font-semibold text-white">
                  Guia rapida para completar perfil
                </span>
                <span className="mt-0.5 block text-xs text-neutral-500">
                  {profileReadiness}/5 pasos listos
                </span>
              </span>
              <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-100">
                {Math.round((profileReadiness / onboardingSteps.length) * 100)}%
              </span>
            </button>

            {showQuickGuide && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {onboardingSteps.map((step) => (
                  <div
                    key={step.label}
                    className={`rounded-md border p-3 ${
                      step.done
                        ? "border-emerald-400/15 bg-emerald-400/[0.05]"
                        : "border-white/[0.08] bg-black/25"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold ${
                          step.done
                            ? "border-emerald-300/40 bg-emerald-400/20 text-emerald-100"
                            : "border-white/10 bg-white/[0.04] text-neutral-500"
                        }`}
                      >
                        {step.done ? "OK" : "-"}
                      </span>
                      <p className="text-sm font-semibold text-neutral-100">
                        {step.label}
                      </p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-neutral-500">
                      {step.description}
                    </p>
                    {!step.done &&
                      (step.action === "photo" ? (
                        <label className="mt-3 inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-amber-300/25 bg-amber-300/10 px-3 text-xs font-semibold text-amber-100 transition hover:border-amber-200/40 hover:bg-amber-300/15">
                          {uploadingProfile ? "Subiendo..." : step.cta}
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            disabled={uploadingProfile}
                            onChange={handleProfilePhoto}
                          />
                        </label>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOnboardingAction(step.action)}
                          className="mt-3 inline-flex h-8 items-center justify-center rounded-md border border-blue-300/20 bg-blue-400/10 px-3 text-xs font-semibold text-blue-100 transition hover:border-blue-200/35 hover:bg-blue-400/15"
                        >
                          {step.cta}
                        </button>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section
          id="estado-perfil"
          className="scroll-mt-24 rounded-lg border border-white/[0.08] bg-[#101012] p-4 shadow-2xl shadow-black/25"
        >
          <div className="flex flex-col gap-4">
            <aside className="flex flex-col gap-4 lg:flex-row lg:items-start">
              <div className="flex shrink-0 flex-col items-start gap-3 sm:w-40 sm:items-center">
                <div
                  className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-white/80 bg-zinc-900 shadow-xl shadow-black/35 ring-4 ring-white/[0.04] sm:h-36 sm:w-36"
                  onClick={() => openExpanded(0)}
                >
                  <Image
                    src={photoUrl || "/default-avatar.png"}
                    alt="Foto principal del perfil"
                    fill
                    className="object-cover"
                    sizes="128px"
                    priority
                  />
                  {uploadingProfile && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs">
                      Subiendo...
                    </div>
                  )}
                </div>
                {effectiveVerificationBadge && (
                  <span
                    className="inline-flex h-7 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 text-[11px] font-semibold text-neutral-100 shadow-lg shadow-black/20"
                    aria-label={`Nivel ${effectiveBadgeLabel}`}
                    title={`Nivel ${effectiveBadgeLabel}`}
                  >
                    <VerificationGem
                      badge={effectiveVerificationBadge}
                      className={
                        effectiveVerificationBadge === "platinum"
                          ? "h-4.5 w-4.5 text-white"
                          : effectiveVerificationBadge === "gold"
                            ? "h-4 w-4 text-amber-200"
                            : effectiveVerificationBadge === "silver"
                              ? "h-4 w-4 text-slate-100"
                              : "h-4 w-4 text-[#d79263]"
                      }
                    />
                    <span className="text-neutral-300">Aprobado</span>
                  </span>
                )}
                <div
                  className={`w-full rounded-md border px-3 py-2 text-left shadow-lg shadow-black/15 ${subscriptionStatusClass}`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">
                    Mensualidad
                  </p>
                  <p className="mt-1 text-xs font-semibold">
                    {subscriptionLabel}
                  </p>
                  {subscriptionNextChargeAt && (
                    <p className="mt-1 text-[11px] opacity-70">
                      Cobro: {formatProfileDate(subscriptionNextChargeAt)}
                    </p>
                  )}
                </div>
              </div>

              <div className="min-w-0 flex-1 pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-medium text-neutral-500">Perfil</p>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusPillClass[status.tone]}`}
                  >
                    {status.label}
                  </span>
                </div>
                <h1 className="mt-1 truncate text-xl font-semibold text-neutral-50">
                  {name || "Completa tu perfil"}
                </h1>
                <p className="mt-1 text-xs text-neutral-500">
                  {profilePaused
                    ? "Pausado por ti"
                    : visiblePublicly
                      ? "Visible publicamente"
                      : hasProfilePhoto
                        ? "Oculto por verificacion"
                        : "Oculto: falta foto de perfil"}
                </p>
                {/* legacy visibility copy removed */}
                <p className="hidden" aria-hidden="true">
                  {visiblePublicly ? "Visible públicamente" : "Oculto"}
                </p>

                <div className="mt-3 grid max-w-sm gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEditMode((value) => !value)}
                    className={`group inline-flex h-7 items-center justify-start gap-2 rounded-md px-2 text-sm font-semibold transition ${
                      editMode
                        ? "bg-white/[0.06] text-neutral-100 hover:bg-white/[0.09]"
                        : "text-neutral-100 hover:bg-blue-500/10 hover:text-blue-100"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-blue-300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    {editMode ? "Cerrar edicion" : "Editar perfil"}
                  </button>

                  <button
                    type="button"
                    disabled={updatingPause || verificationStatus !== "approved"}
                    onClick={() => setShowPauseModal(true)}
                    className={`inline-flex h-7 items-center justify-start gap-2 rounded-md px-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      profilePaused
                        ? "text-emerald-100 hover:bg-emerald-400/10"
                        : "text-neutral-100 hover:bg-amber-400/10 hover:text-amber-100"
                    }`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 ${
                        profilePaused ? "text-emerald-300" : "text-amber-300"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {profilePaused ? (
                        <path d="m5 3 14 9-14 9V3Z" />
                      ) : (
                        <>
                          <path d="M10 4H6v16h4V4Z" />
                          <path d="M18 4h-4v16h4V4Z" />
                        </>
                      )}
                    </svg>
                    {profilePaused ? "Reactivar perfil" : "Pausar perfil"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      buyingPromotion ||
                      verificationStatus !== "approved" ||
                      !hasProfilePhoto
                    }
                    onClick={() => setShowPromotionModal(true)}
                    className="inline-flex h-7 items-center justify-start gap-2 rounded-md px-2 text-sm font-semibold text-neutral-100 transition hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4 text-cyan-300"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3v18" />
                      <path d="m6 9 6-6 6 6" />
                      <path d="M5 21h14" />
                    </svg>
                    {promotionActive ? "Extender promocion" : "Promocionar perfil"}
                  </button>
                </div>

                {(
                  <div className="mt-3 max-w-sm rounded-lg border border-white/[0.08] bg-black/20 p-1.5">
                    {effectiveVerificationBadge ? (
                      <div className="grid gap-1.5">
                        {badgeVerificationStatus === "pending" && (
                          <span className="inline-flex h-10 w-full items-center justify-center rounded-md border border-amber-400/25 bg-amber-400/10 px-3 text-xs font-semibold text-amber-200">
                            Nivel {badgeVerificationLevel || ""} en revision
                          </span>
                        )}
                        {canUpgradeVerification && (
                          <button
                            type="button"
                            onClick={openVerificationRequest}
                            disabled={requestingBadgeVerification}
                            className="group inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-neutral-100 transition hover:border-blue-300/35 hover:bg-blue-500/10 hover:text-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4 text-blue-300"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 3v18" />
                              <path d="m6 9 6-6 6 6" />
                            </svg>
                            Subir de nivel
                          </button>
                        )}
                      </div>
                    ) : badgeVerificationStatus === "pending" ? (
                      <span className="inline-flex h-10 w-full items-center justify-center rounded-md border border-amber-400/25 bg-amber-400/10 px-3 text-xs font-semibold text-amber-200">
                        Nivel {badgeVerificationLevel || ""} en revision
                      </span>
                    ) : (
                      <button
                        type="button"
                      onClick={openVerificationRequest}
                      disabled={requestingBadgeVerification}
                        className="group inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100 transition hover:border-emerald-300/45 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 transition group-hover:scale-125 group-hover:bg-emerald-200" />
                        Solicitar verificacion
                      </button>
                    )}
                  </div>
                )}

                {editMode && (
                <label className="mt-2 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-neutral-100 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 text-neutral-300"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  Editar foto
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleProfilePhoto}
                  />
                </label>
                )}
              </div>

              <div
                id="video-del-dia"
                className="scroll-mt-24 rounded-lg border border-sky-300/12 bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(10,10,11,0.96)_42%,rgba(10,10,11,1))] p-4 shadow-xl shadow-black/20 lg:ml-auto lg:min-h-[190px] lg:flex-1"
              >
                <div className="flex h-full flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full border border-sky-300/20 bg-sky-400/10 text-sky-200">
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4"
                          fill="currentColor"
                        >
                          <path d="M8 5.2v13.6L18.8 12 8 5.2Z" />
                        </svg>
                      </span>
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-300">
                          Video del dia
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-400">
                          Activo por 4 horas en tu tarjeta.
                        </p>
                      </div>
                    </div>

                    {dailyVideoActive && dailyVideoExpiresAt ? (
                      <p className="mt-3 rounded-md border border-emerald-300/15 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100">
                        Activo hasta{" "}
                        {new Date(dailyVideoExpiresAt).toLocaleString("es-CO")}
                      </p>
                    ) : (
                      <p className="mt-3 max-w-md text-xs leading-5 text-neutral-500">
                        Sube un video corto de maximo{" "}
                        {DAILY_VIDEO_MAX_SECONDS} segundos para destacar tu
                        perfil.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    {dailyVideoActive && dailyVideoUrl && (
                      <button
                        type="button"
                        onClick={() => setShowDailyVideoModal(true)}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.08] hover:text-white"
                      >
                        Ver activo
                      </button>
                    )}
                    <label
                      className={`inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-white shadow-lg shadow-sky-950/20 transition ${
                        uploadingDailyVideo ||
                        verificationStatus !== "approved" ||
                        !hasProfilePhoto
                          ? "cursor-not-allowed bg-sky-700/60 opacity-60"
                          : "bg-sky-600 hover:bg-sky-500"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="currentColor"
                      >
                        <path d="M8 5.2v13.6L18.8 12 8 5.2Z" />
                      </svg>
                      {uploadingDailyVideo
                        ? "Subiendo..."
                        : dailyVideoActive
                          ? "Reemplazar video"
                          : "Subir video"}
                      <input
                        type="file"
                        accept="video/*"
                        hidden
                        disabled={
                          uploadingDailyVideo ||
                          verificationStatus !== "approved" ||
                          !hasProfilePhoto
                        }
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
            </aside>

            <div>
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
          </div>
        </section>

        <section className="hidden">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-300">
                Pausa temporal
              </p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-50">
                {profilePaused ? "Perfil pausado" : "Pausar mi perfil"}
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
                Si vas a tomar vacaciones o no quieres aparecer por unos dias,
                puedes pausar tu perfil. Mientras este pausado no aparece en
                escorts y la mensualidad queda detenida. Puedes usar esta
                opcion maximo 6 veces por mes.
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                Estado de mensualidad:{" "}
                <span className="font-semibold text-neutral-300">
                  {subscriptionStatus === "paused"
                    ? "Pausada"
                    : subscriptionStatus === "past_due"
                      ? "Pendiente"
                      : subscriptionStatus === "admin_override"
                        ? "Desactivada"
                        : "Activa"}
                </span>
              </p>
            </div>

            <button
              type="button"
              disabled={updatingPause || verificationStatus !== "approved"}
              onClick={() => void toggleProfilePause()}
              className={`rounded-full px-5 py-3 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${
                profilePaused
                  ? "border border-emerald-300/30 bg-emerald-600 text-white shadow-emerald-950/25 hover:bg-emerald-500"
                  : "border border-amber-300/30 bg-amber-400/10 text-amber-100 shadow-amber-950/15 hover:bg-amber-400/15"
              }`}
            >
              {updatingPause
                ? "Procesando..."
                : profilePaused
                  ? "Reactivar perfil"
                  : "Pausar perfil"}
            </button>
          </div>
        </section>

        <section className="hidden">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">
                Visibilidad
              </p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-50">
                Promocionar mi perfil
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
                Por ${PROVIDER_PROMOTION_PRICE.toLocaleString("es-CO")} tu
                perfil aparecera entre los primeros durante{" "}
                {PROVIDER_PROMOTION_DAYS} dias. Primero se muestran los perfiles
                promocionados y luego el orden va de Diamante a no verificados.
              </p>
              {promotionActive && promotedUntil && (
                <p className="mt-2 text-xs font-semibold text-emerald-200">
                  Promocion activa hasta{" "}
                  {new Date(promotedUntil).toLocaleString("es-CO")}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={
                buyingPromotion ||
                verificationStatus !== "approved" ||
                !hasProfilePhoto
              }
              onClick={() => void buyPromotion()}
              className="rounded-full border border-blue-300/30 bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/25 transition hover:-translate-y-0.5 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
            >
              {buyingPromotion
                ? "Procesando..."
                : promotionActive
                  ? "Extender promocion"
                  : "Promocionar perfil"}
            </button>
          </div>
        </section>

        <section
          id="galeria-perfil"
          className="mt-4 scroll-mt-24 rounded-lg border border-white/[0.08] bg-[#101012] p-5 shadow-2xl shadow-black/20"
        >
          <div className="relative flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:min-h-[92px] sm:block">
            <div className="sm:pr-[470px]">
              <h2 className="text-2xl font-semibold text-neutral-50">Galería</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Tiempo de video: {formatVideoTime(videoSecondsUsed)} /{" "}
                {formatVideoTime(videoSecondsLimit)} incluido.
              </p>
            </div>

            <div
              className={`grid w-full gap-2 sm:absolute sm:right-0 sm:top-0 sm:w-auto sm:grid-cols-2 ${
                showVideoTimeAction ? "sm:min-w-[420px] lg:grid-cols-3" : "sm:min-w-[310px]"
              }`}
            >
              {showVideoTimeAction && (
                <button
                  type="button"
                  disabled={buyingVideoTime}
                  onClick={() => void buyExtraVideoTime()}
                  className="inline-flex h-12 items-center justify-center rounded-md border border-emerald-400/30 bg-emerald-400/10 px-4 text-center text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {buyingVideoTime
                    ? "Comprando..."
                    : `Comprar 1 min $${EXTRA_VIDEO_TIME_PRICE.toLocaleString(
                        "es-CO"
                      )}`}
                </button>
              )}

              <label className="group flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.035] px-4 text-center text-xs font-semibold text-neutral-200 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white">
                <span className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-neutral-300 transition group-hover:border-white/20 group-hover:text-white">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <path d="m17 8-5-5-5 5" />
                    <path d="M12 3v12" />
                  </svg>
                </span>
                <span className="flex flex-col items-start leading-tight">
                  <span>Subir publico</span>
                  <span className="text-[10px] font-medium text-neutral-500">
                    Visible gratis
                  </span>
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    e.target.value = "";
                    if (files.length > 0) void handlePublicUpload(files);
                  }}
                />
              </label>

              <label className="group relative flex h-12 cursor-pointer items-center justify-center gap-2 overflow-hidden rounded-md border border-emerald-300/30 bg-emerald-500 px-4 text-center text-xs font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:-translate-y-0.5 hover:border-emerald-100/50 hover:bg-emerald-400">
                <span className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.22),transparent_34%)] opacity-80" />
                <span className="relative flex h-7 w-7 items-center justify-center rounded-full border border-white/25 bg-black/15 text-sm shadow-inner">
                  $
                </span>
                <span className="relative flex flex-col items-start leading-tight">
                  <span>Subir privado</span>
                  <span className="text-[10px] font-medium text-emerald-950/80">
                    Contenido pago
                  </span>
                </span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    e.target.value = "";
                    if (files.length === 0) return;
                    setPendingFiles(files);
                    setContentPrice("");
                    setContentDescription("");
                    setPrivateDescriptionError("");
                    setMediaUploadError("");
                    setShowPriceModal(true);
                  }}
                />
              </label>
            </div>
          </div>

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

          {mediaUploadItems.length === 0 && media.length === 0 ? (
            <div className="mt-5 rounded-md border border-dashed border-white/[0.08] bg-black/20 p-10 text-center text-sm text-neutral-500">
              Todavía no tienes contenido en tu galería.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {mediaUploadItems.map((item) => (
                <UploadProgressGalleryItem key={item.id} item={item} />
              ))}

              {media.map((item, index) => (
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
        </section>
      </main>

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
          onClick={() => setShowPromotionModal(false)}
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
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setShowPromotionModal(false)}
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
                        selectedVerificationLevel === 1 ? "image/*" : "video/*"
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
                className="absolute right-3 top-3 z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/60 text-neutral-200 shadow-lg shadow-black/40 backdrop-blur transition hover:bg-white/10 hover:text-white"
                aria-label="Cerrar video"
              >
                X
              </button>
              <video
                src={dailyVideoUrl}
                controls
                autoPlay
                playsInline
                className="max-h-[82vh] w-full bg-black object-contain"
              />
            </div>
          </div>
        )}

        {expandedMedia && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setExpandedMedia(null)}
        >
          <div className="relative inline-flex" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setExpandedMedia(null)}
              className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-xl text-white"
            >
              ×
            </button>

            {mediaList[currentIndex]?.type === "photo" ? (
              <Image
                src={mediaList[currentIndex].url}
                alt="Contenido ampliado"
                width={1400}
                height={1400}
                className="max-h-[90vh] w-auto rounded-lg object-contain"
              />
            ) : (
              <video
                src={mediaList[currentIndex].url}
                controls
                autoPlay
                className="max-h-[90vh] w-auto rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
