"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
    text: "Requiere foto de verificacion.",
  },
  {
    level: 2 as BadgeVerificationLevel,
    badge: "silver" as VerificationBadge,
    title: "Plata",
    text: "Requiere video de verificacion.",
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

const uploadFile = async (file: File, token: string) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/upload-profile-photo", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = (await res.json()) as UploadResponse;

  if (!res.ok || !data.url) {
    throw new Error(
      data.details || data.error || "No pudimos subir el archivo"
    );
  }

  return data.url;
};

const getVideoDuration = (file: File) => {
  return new Promise<number>((resolve, reject) => {
    const video = document.createElement("video");
    const objectUrl = URL.createObjectURL(file);

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(Math.ceil(video.duration || 0));
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No pudimos leer la duracion del video"));
    };
    video.src = objectUrl;
  });
};

const formatVideoTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
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

  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
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

  const [expandedMedia, setExpandedMedia] = useState<MediaItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [showPromotionModal, setShowPromotionModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [contentPrice, setContentPrice] = useState("");
  const [contentDescription, setContentDescription] = useState("");
  const [selectedVerificationLevel, setSelectedVerificationLevel] =
    useState<BadgeVerificationLevel>(1);
  const [verificationFile, setVerificationFile] = useState<File | null>(null);
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

  const videoSecondsUsed = useMemo(
    () => getProviderVideoSecondsUsed(media),
    [media]
  );
  const videoSecondsLimit = getProviderVideoSecondsLimit(videoSecondsExtra);
  const hasReachedVideoTimeLimit = videoSecondsUsed >= videoSecondsLimit;
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

  const status = statusCopy[verificationStatus];
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

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

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
      showPromotionModal
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
        { photoUrl: url },
        { merge: true }
      );

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

  const uploadMedia = useCallback(
    async (
      file: File,
      isPrivate: boolean,
      forcedPrice?: number,
      privateDescription?: string
    ) => {
      if (!user) return;

      setUploadingMedia(true);
      setError("");

      try {
        const type = file.type.startsWith("video") ? "video" : "photo";

        const duration = type === "video" ? await getVideoDuration(file) : null;

        if (
          type === "video" &&
          duration &&
          videoSecondsUsed + duration > videoSecondsLimit
        ) {
          setShowVideoTimePurchase(true);
          setError(
            `Este video dura ${formatVideoTime(
              duration
            )} y supera tus ${formatVideoTime(
              videoSecondsLimit
            )} incluidos. Para subirlo debes comprar tiempo extra.`
          );
          return;
        }

        const url = await uploadFile(file, await user.getIdToken());
        const newItem: MediaItem = {
          id: createMediaId(),
          type,
          url,
          private: isPrivate,
          price: isPrivate ? forcedPrice || 0 : null,
          duration,
          description: isPrivate ? privateDescription?.trim() || "" : "",
        };
        const res = await fetch("/api/provider-media", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${await user.getIdToken()}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "add",
            item: newItem,
          }),
        });
        const data = (await res.json()) as ProviderMediaResponse;

        if (!res.ok || !data.media) {
          throw new Error(data.error || "No pudimos guardar el contenido");
        }

        setMedia(data.media);

        showSuccess(isPrivate ? "Contenido privado subido" : "Foto pública subida");
      } catch (uploadError) {
        const text =
          uploadError instanceof Error
            ? uploadError.message
            : "No pudimos subir el contenido";
        setError(text);
      } finally {
        setUploadingMedia(false);
      }
    },
    [user, videoSecondsLimit, videoSecondsUsed]
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

  const handlePrivateUpload = async () => {
    if (!pendingFile) return;

    const priceNum = Number(contentPrice);
    const description = contentDescription.trim();

    if (!priceNum || priceNum <= 0) {
      setError("Ingresa un precio válido para el contenido privado");
      return;
    }

    if (!description) {
      setError("Agrega una descripción breve del contenido privado");
      return;
    }

    await uploadMedia(pendingFile, true, priceNum, description);

    setShowPriceModal(false);
    setPendingFile(null);
    setContentPrice("");
    setContentDescription("");
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
      if (!file.type.startsWith("video")) {
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
    setShowVerificationModal(true);
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
          ? "Sube una foto de verificacion para solicitar bronce"
          : "Sube un video de verificacion para solicitar plata"
      );
      return;
    }

    setRequestingBadgeVerification(true);
    setError("");

    try {
      const evidenceUrl =
        (selectedVerificationLevel === 1 || selectedVerificationLevel === 2) &&
        verificationFile
          ? await uploadFile(verificationFile, await user.getIdToken())
          : null;

      await setDoc(
        doc(db, "users", user.uid),
        {
          badgeVerificationStatus: "pending",
          badgeVerificationLevel: selectedVerificationLevel,
          badgeVerificationVideoUrl: evidenceUrl,
          badgeVerificationRequestedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setBadgeVerificationStatus("pending");
      setBadgeVerificationLevel(selectedVerificationLevel);
      setShowVerificationModal(false);
      setVerificationFile(null);
      showSuccess("Solicitud de verificacion enviada");
    } catch (requestError) {
      const text =
        requestError instanceof Error
          ? requestError.message
          : "No pudimos enviar la solicitud";
      setError(text);
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
    <div className="min-h-screen bg-[#050505] pt-14 text-white sm:pt-16">
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

        <section className="rounded-lg border border-white/[0.08] bg-[#101012] p-4 shadow-2xl shadow-black/25">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            <aside className="flex items-center gap-4 lg:w-[360px]">
              <div className="flex shrink-0 flex-col items-start gap-2">
                <div
                  className="relative h-28 w-28 overflow-hidden rounded-full border border-white/20 bg-zinc-900 shadow-lg shadow-black/30 ring-4 ring-white/[0.04] sm:h-32 sm:w-32"
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
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 text-[11px] font-semibold text-emerald-100 shadow-lg shadow-black/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    {effectiveBadgeLabel}
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
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
                    : profileVisible
                      ? "Visible publicamente"
                      : "Oculto por verificacion"}
                </p>
                {/* legacy visibility copy removed */}
                <p className="hidden" aria-hidden="true">
                  {profileVisible ? "Visible públicamente" : "Oculto por verificación"}
                </p>

                {(
                  <div className="mt-3 rounded-lg border border-white/[0.08] bg-black/20 p-1.5">
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
            </aside>

            <div className="flex-1">
              <div className="rounded-lg border border-white/[0.08] bg-black/25 p-2">
              <div className="grid gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => setEditMode((value) => !value)}
                  className={`group flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-xs font-semibold transition ${
                    editMode
                      ? "border-white/10 bg-white/[0.05] text-neutral-100 hover:bg-white/[0.08]"
                      : "border-white/10 bg-white/[0.035] text-neutral-100 hover:border-blue-300/35 hover:bg-blue-500/10 hover:text-blue-100"
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
                  className={`flex h-11 items-center justify-center gap-2 rounded-md border px-4 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    profilePaused
                      ? "border-emerald-300/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
                      : "border-white/10 bg-white/[0.035] text-neutral-100 hover:border-amber-300/35 hover:bg-amber-400/10 hover:text-amber-100"
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
                  disabled={buyingPromotion || verificationStatus !== "approved"}
                  onClick={() => setShowPromotionModal(true)}
                  className="flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-4 text-xs font-semibold text-neutral-100 transition hover:border-cyan-300/35 hover:bg-cyan-400/10 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
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
              {editMode && (
                <div className="mt-2 border-t border-white/[0.08] pt-2">
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
              </div>

              {editMode && (
              <div className="mt-3 rounded-lg border border-white/[0.08] bg-black/25 p-3">
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
                    onChange={(e) => setCity(e.target.value)}
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
              disabled={buyingPromotion || verificationStatus !== "approved"}
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
          id="video-del-dia"
          className="mt-4 scroll-mt-24 rounded-lg border border-sky-300/15 bg-[linear-gradient(135deg,rgba(14,165,233,0.10),rgba(16,16,18,0.96)_45%,rgba(16,16,18,1))] p-4 shadow-2xl shadow-black/20 sm:p-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-300">
                Video del dia
              </p>
              <h2 className="mt-1 text-lg font-semibold text-white">
                Destaca tu perfil durante 4 horas
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-400">
                Sube un video corto de maximo {DAILY_VIDEO_MAX_SECONDS} segundos.
                Mientras este activo, tu tarjeta aparece primero y los clientes
                veran el boton de video.
              </p>
              {dailyVideoActive && dailyVideoExpiresAt && (
                <p className="mt-2 text-xs font-semibold text-emerald-200">
                  Activo hasta{" "}
                  {new Date(dailyVideoExpiresAt).toLocaleString("es-CO")}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {dailyVideoActive && dailyVideoUrl && (
                <a
                  href={dailyVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Ver activo
                </a>
              )}
              <label
                className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white shadow-lg shadow-sky-950/20 transition ${
                  uploadingDailyVideo || verificationStatus !== "approved"
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
                    : "Subir video del dia"}
                <input
                  type="file"
                  accept="video/*"
                  hidden
                  disabled={uploadingDailyVideo || verificationStatus !== "approved"}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadDailyVideo(file);
                  }}
                />
              </label>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-white/[0.08] bg-[#101012] p-5 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-50">Galería</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Tiempo de video: {formatVideoTime(videoSecondsUsed)} /{" "}
                {formatVideoTime(videoSecondsLimit)} incluido.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {(hasReachedVideoTimeLimit || showVideoTimePurchase) && (
                <button
                  type="button"
                  disabled={buyingVideoTime}
                  onClick={() => void buyExtraVideoTime()}
                  className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-6 py-3 text-center text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {buyingVideoTime
                    ? "Comprando..."
                    : `Comprar 1 min $${EXTRA_VIDEO_TIME_PRICE.toLocaleString(
                        "es-CO"
                      )}`}
                </button>
              )}

              <label className="cursor-pointer rounded-md border border-white/[0.08] bg-white/[0.03] px-6 py-3 text-center text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07]">
                Subir público
                <input
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void uploadMedia(file, false);
                  }}
                />
              </label>

              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md bg-blue-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-lg shadow-blue-950/25 transition hover:bg-blue-500">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-xs">
                  $
                </span>
                Subir privado
                <input
                  type="file"
                  accept="image/*,video/*"
                  hidden
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setPendingFile(file);
                    setContentPrice("");
                    setContentDescription("");
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

          {media.length === 0 ? (
            <div className="mt-5 rounded-md border border-dashed border-white/[0.08] bg-black/20 p-10 text-center text-sm text-neutral-500">
              Todavía no tienes contenido en tu galería.
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {media.map((item, index) => (
                <div
                  key={`${item.url}-${index}`}
                  className="group relative aspect-square overflow-hidden rounded-md border border-white/[0.08] bg-zinc-900"
                >
                  <button
                    type="button"
                    className="absolute inset-0 z-10"
                    aria-label="Ver contenido"
                    onClick={() => openExpanded(index + 1)}
                  />

                  {item.type === "photo" ? (
                    <Image
                      src={item.url}
                      alt="Contenido del perfil"
                      fill
                      className="object-cover transition duration-300 group-hover:scale-105"
                      sizes="(min-width: 1024px) 25vw, 50vw"
                    />
                  ) : (
                    <video
                      src={item.url}
                      muted
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  )}

                  {item.private && (
                    <span className="absolute bottom-2 left-2 z-20 rounded-full border border-white/10 bg-black/70 px-2 py-1 text-xs text-white backdrop-blur">
                      Privado · ${Number(item.price || 0).toLocaleString("es-CO")}
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => void deleteMedia(index)}
                    disabled={deletingIndex === index}
                    className="absolute right-2 top-2 z-20 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-semibold text-white opacity-90 backdrop-blur transition hover:bg-rose-600 disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100"
                  >
                    {deletingIndex === index ? "..." : "Eliminar"}
                  </button>
                </div>
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
            setPendingFile(null);
            setContentPrice("");
            setContentDescription("");
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
            {pendingFile?.type.startsWith("video") && (
              <div className="mt-4 rounded-md border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-100">
                Los primeros 3 minutos de video estan incluidos. Si este video
                supera tu tiempo disponible, deberas comprar tiempo extra para
                poder subirlo.
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
                rows={3}
                maxLength={80}
                value={contentDescription}
                onChange={(e) => setContentDescription(e.target.value)}
                placeholder="Ej: rostro, baile, contenido exclusivo..."
                className="w-full resize-none rounded-md border border-white/10 bg-black/25 px-3 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-blue-400/80 focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="mt-1 text-right text-xs text-neutral-500">
                {contentDescription.length}/80
              </p>
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
                  setPendingFile(null);
                  setContentPrice("");
                  setContentDescription("");
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4"
          onClick={() => {
            setShowVerificationModal(false);
            setVerificationFile(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-white/[0.08] bg-[#101012] p-6 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">
              {currentVerificationLevel > 0
                ? "Subir nivel de verificacion"
                : "Solicitar verificacion"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              {currentVerificationLevel > 0
                ? `Tu nivel actual es ${effectiveBadgeLabel}. Elige un nivel superior para enviar una nueva solicitud.`
                : "Elige el nivel de insignia que quieres solicitar. La solicitud llegara al panel de control para revision."}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {availableVerificationOptions.map((option) => (
                <button
                  key={option.level}
                  type="button"
                  onClick={() => {
                    setSelectedVerificationLevel(option.level);
                    setVerificationFile(null);
                  }}
                  className={`rounded-lg border p-4 text-left transition ${
                    selectedVerificationLevel === option.level
                      ? "border-emerald-300/50 bg-emerald-300/10 text-white"
                      : "border-white/[0.08] bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07]"
                  }`}
                >
                  <span className="text-sm font-semibold">
                    Nivel {option.level}
                  </span>
                  <span className="mt-1 block text-xl font-semibold">
                    {option.title}
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-neutral-400">
                    {option.text}
                  </span>
                </button>
              ))}
            </div>

            {(selectedVerificationLevel === 1 ||
              selectedVerificationLevel === 2) && (
              <label className="mt-5 block cursor-pointer rounded-lg border border-dashed border-white/15 bg-black/20 p-4 text-center text-sm text-neutral-300 transition hover:bg-white/[0.04]">
                {verificationFile
                  ? verificationFile.name
                  : selectedVerificationLevel === 1
                    ? "Subir foto de verificacion"
                    : "Subir video de verificacion"}
                <input
                  type="file"
                  accept={
                    selectedVerificationLevel === 1 ? "image/*" : "video/*"
                  }
                  hidden
                  onChange={(e) => {
                    setVerificationFile(e.target.files?.[0] || null);
                    e.target.value = "";
                  }}
                />
              </label>
            )}

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07]"
                onClick={() => {
                  setShowVerificationModal(false);
                  setVerificationFile(null);
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

