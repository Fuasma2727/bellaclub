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
  EXTRA_VIDEO_SLOT_PRICE,
  getProviderVideoLimit,
} from "@/lib/providerMediaLimits";

type VerificationStatus = "pending" | "approved" | "rejected";
type BadgeVerificationStatus = "none" | "pending" | "approved" | "rejected";
type VerificationBadge = "gold" | "diamond";
type BadgeVerificationLevel = 1 | 2;

type MediaItem = {
  id?: string;
  type: "photo" | "video";
  url: string;
  private?: boolean;
  price?: number | null;
  description?: string;
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
  verificationStatus?: VerificationStatus;
  verificationBadge?: VerificationBadge | null;
  badgeVerificationStatus?: BadgeVerificationStatus;
  badgeVerificationLevel?: BadgeVerificationLevel;
  profileVisible?: boolean;
  videoSlotsExtra?: number;
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
  videoSlotsExtra?: number;
  error?: string;
};

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
      "Tu perfil puede aparecer en la página pública de prestadores.",
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
  "w-full rounded-md border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-neutral-100 outline-none transition placeholder:text-neutral-600 focus:border-blue-400/80 focus:ring-2 focus:ring-blue-500/20";

const readOnlyFieldClass =
  "rounded-md border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-sm text-neutral-200";

const privatePriceOptions = [10000, 50000, 100000, 200000];

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

  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [videoSlotsExtra, setVideoSlotsExtra] = useState(0);

  const [saving, setSaving] = useState(false);
  const [requestingBadgeVerification, setRequestingBadgeVerification] =
    useState(false);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [buyingVideoSlot, setBuyingVideoSlot] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [expandedMedia, setExpandedMedia] = useState<MediaItem | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [showPriceModal, setShowPriceModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [contentPrice, setContentPrice] = useState("");
  const [contentDescription, setContentDescription] = useState("");
  const [selectedVerificationLevel, setSelectedVerificationLevel] =
    useState<BadgeVerificationLevel>(1);
  const [verificationVideoFile, setVerificationVideoFile] =
    useState<File | null>(null);

  const mediaList = useMemo<MediaItem[]>(() => {
    return [
      { type: "photo", url: photoUrl || "/default-avatar.png" },
      ...media,
    ];
  }, [photoUrl, media]);

  const videoCount = useMemo(
    () => media.filter((item) => item.type === "video").length,
    [media]
  );
  const videoLimit = getProviderVideoLimit(videoSlotsExtra);
  const hasReachedVideoLimit = videoCount >= videoLimit;

  const cities = useMemo(() => {
    return (
      colombia.departments.find((item) => item.name === department)?.cities ||
      []
    );
  }, [department]);

  const status = statusCopy[verificationStatus];
  const effectiveVerificationBadge =
    badgeVerificationLevel === 2 ? "diamond" : verificationBadge;

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
        setVideoSlotsExtra(Number(data.videoSlotsExtra || 0));
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
      expandedMedia || showPriceModal || showVerificationModal
        ? "hidden"
        : "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [expandedMedia, showPriceModal, showVerificationModal]);

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

        if (type === "video" && hasReachedVideoLimit) {
          setError(
            `Llegaste al limite de ${videoLimit} videos. Compra un cupo extra por $${EXTRA_VIDEO_SLOT_PRICE.toLocaleString(
              "es-CO"
            )}.`
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
    [hasReachedVideoLimit, user, videoLimit]
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

  const buyExtraVideoSlot = async () => {
    if (!user) return;

    setBuyingVideoSlot(true);
    setError("");

    try {
      const res = await fetch("/api/provider-video-slots", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
      });
      const data = (await res.json()) as VideoSlotResponse;

      if (!res.ok || typeof data.videoSlotsExtra !== "number") {
        throw new Error(data.error || "No pudimos comprar el cupo extra");
      }

      setVideoSlotsExtra(data.videoSlotsExtra);
      showSuccess("Cupo extra de video activado");
    } catch (slotError) {
      const text =
        slotError instanceof Error
          ? slotError.message
          : "No pudimos comprar el cupo extra";
      setError(text);
    } finally {
      setBuyingVideoSlot(false);
    }
  };

  const requestBadgeVerification = async () => {
    if (!user) return;

    if (verificationStatus !== "approved") {
      setError("Primero tu perfil debe estar aprobado para aparecer publico");
      return;
    }

    if (selectedVerificationLevel === 1 && !verificationVideoFile) {
      setError("Sube un video diciendo: yo soy parte de BellaClub");
      return;
    }

    setRequestingBadgeVerification(true);
    setError("");

    try {
      const videoUrl =
        selectedVerificationLevel === 1 && verificationVideoFile
          ? await uploadFile(verificationVideoFile, await user.getIdToken())
          : null;

      await setDoc(
        doc(db, "users", user.uid),
        {
          badgeVerificationStatus: "pending",
          badgeVerificationLevel: selectedVerificationLevel,
          badgeVerificationVideoUrl: videoUrl,
          badgeVerificationRequestedAt: serverTimestamp(),
        },
        { merge: true }
      );

      setBadgeVerificationStatus("pending");
      setBadgeVerificationLevel(selectedVerificationLevel);
      setShowVerificationModal(false);
      setVerificationVideoFile(null);
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
              Este perfil es solo para prestadores
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
            <aside className="flex items-center gap-4 lg:w-80">
              <div
                className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-white/20 bg-zinc-900 shadow-lg shadow-black/30 ring-4 ring-white/[0.04] sm:h-28 sm:w-28"
                onClick={() => openExpanded(0)}
              >
                <Image
                  src={photoUrl || "/default-avatar.png"}
                  alt="Foto principal del perfil"
                  fill
                  className="object-cover"
                  sizes="112px"
                  priority
                />
                {uploadingProfile && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-xs">
                    Subiendo...
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-neutral-400">Perfil</p>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusPillClass[status.tone]}`}
                  >
                    {status.label}
                  </span>
                </div>
                <h1 className="mt-1 truncate text-2xl font-semibold">
                  {name || "Completa tu perfil"}
                </h1>
                <p className="mt-1 text-xs text-neutral-500">
                  {profileVisible ? "Visible públicamente" : "Oculto por verificación"}
                </p>

                {verificationStatus === "approved" && (
                  <div className="mt-3">
                    {effectiveVerificationBadge ? (
                      <span
                        className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold ${
                          effectiveVerificationBadge === "diamond"
                            ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-100"
                            : "border-yellow-300/30 bg-yellow-300/10 text-yellow-100"
                        }`}
                      >
                        Aprobado:{" "}
                        {effectiveVerificationBadge === "diamond" ? "💎" : "✦"}
                      </span>
                    ) : badgeVerificationStatus === "pending" ? (
                      <span className="inline-flex rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-200">
                        Nivel {badgeVerificationLevel || ""} en revision
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowVerificationModal(true)}
                        disabled={requestingBadgeVerification}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 shadow-lg shadow-emerald-950/10 transition duration-200 hover:-translate-y-0.5 hover:border-emerald-300/60 hover:bg-emerald-400/20 hover:shadow-emerald-950/30 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 transition group-hover:scale-125 group-hover:bg-emerald-200" />
                        Solicitar verificacion
                      </button>
                    )}
                  </div>
                )}

                <label className="mt-3 inline-flex cursor-pointer rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.07]">
                  Editar foto
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={handleProfilePhoto}
                  />
                </label>
              </div>
            </aside>

            <div className="flex-1">
              <div className="flex justify-end">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditMode((value) => !value)}
                    className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                      editMode
                        ? "border border-white/[0.08] bg-white/[0.03] text-neutral-200 hover:bg-white/[0.07]"
                        : "bg-blue-600 text-white shadow-lg shadow-blue-950/25 hover:bg-blue-500"
                    }`}
                  >
                    {editMode ? "Cancelar" : "Editar"}
                  </button>
                  {editMode && (
                    <button
                      type="button"
                      onClick={saveProfile}
                      disabled={saving}
                      className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label
                  htmlFor="name"
                  className="mb-1.5 block text-sm font-medium text-neutral-300"
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
                  className="mb-1.5 block text-sm font-medium text-neutral-300"
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
                  className="mb-1.5 block text-sm font-medium text-neutral-300"
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
                  className="mb-1.5 block text-sm font-medium text-neutral-300"
                >
                  Precio base
                </label>
                {editMode ? (
                  <div className="flex items-center rounded-md border border-white/10 bg-black/25 px-3 focus-within:border-blue-400/80 focus-within:ring-2 focus-within:ring-blue-500/20">
                    <span className="text-neutral-500">$</span>
                    <input
                      id="price"
                      type="number"
                      min={0}
                      step={10000}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full bg-transparent px-2 py-2.5 text-sm outline-none"
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
                  className="mb-1.5 block text-sm font-medium text-neutral-300"
                >
                  WhatsApp
                </label>
                {editMode ? (
                  <div className="flex items-center rounded-md border border-white/10 bg-black/25 px-3 focus-within:border-emerald-400/80 focus-within:ring-2 focus-within:ring-emerald-500/20">
                    <span className="text-sm font-semibold text-emerald-300">
                      WA
                    </span>
                    <input
                      id="whatsapp"
                      type="tel"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      className="w-full bg-transparent px-2 py-2.5 text-sm outline-none placeholder:text-neutral-600"
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
                  className="mb-1.5 block text-sm font-medium text-neutral-300"
                >
                  Descripción
                </label>
                {editMode ? (
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
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
          </div>
        </section>

        <section className="mt-4 rounded-lg border border-white/[0.08] bg-[#101012] p-5 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-50">Galería</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Videos: {videoCount}/{videoLimit} incluidos. Cupos extra:{" "}
                {videoSlotsExtra}. Cada cupo adicional cuesta $
                {EXTRA_VIDEO_SLOT_PRICE.toLocaleString("es-CO")}.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                disabled={buyingVideoSlot}
                onClick={() => void buyExtraVideoSlot()}
                className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-6 py-3 text-center text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {buyingVideoSlot ? "Comprando..." : "Comprar cupo video"}
              </button>

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
            setVerificationVideoFile(null);
          }}
        >
          <div
            className="w-full max-w-lg rounded-lg border border-white/[0.08] bg-[#101012] p-6 shadow-2xl shadow-black/40"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">Solicitar verificacion</h3>
            <p className="mt-2 text-sm leading-6 text-neutral-400">
              Elige el nivel de insignia que quieres solicitar. La solicitud
              llegara al panel de control para revision.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setSelectedVerificationLevel(1)}
                className={`rounded-lg border p-4 text-left transition ${
                  selectedVerificationLevel === 1
                    ? "border-zinc-200/50 bg-zinc-200/10 text-white"
                    : "border-white/[0.08] bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07]"
                }`}
              >
                <span className="text-sm font-semibold">Nivel 1</span>
                <span className="mt-1 block text-xl font-semibold">
                  Insignia oro
                </span>
                <span className="mt-2 block text-xs leading-5 text-neutral-400">
                  Requiere video diciendo: yo soy parte de BellaClub.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedVerificationLevel(2)}
                className={`rounded-lg border p-4 text-left transition ${
                  selectedVerificationLevel === 2
                    ? "border-yellow-300/50 bg-yellow-300/10 text-white"
                    : "border-white/[0.08] bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07]"
                }`}
              >
                <span className="text-sm font-semibold">Nivel 2</span>
                <span className="mt-1 block text-xl font-semibold">
                  Insignia diamante
                </span>
                <span className="mt-2 block text-xs leading-5 text-neutral-400">
                  Requiere verificacion presencial por servicio.
                </span>
              </button>
            </div>

            {selectedVerificationLevel === 1 && (
              <label className="mt-5 block cursor-pointer rounded-lg border border-dashed border-white/15 bg-black/20 p-4 text-center text-sm text-neutral-300 transition hover:bg-white/[0.04]">
                {verificationVideoFile
                  ? verificationVideoFile.name
                  : "Subir video de verificacion"}
                <input
                  type="file"
                  accept="video/*"
                  hidden
                  onChange={(e) => {
                    setVerificationVideoFile(e.target.files?.[0] || null);
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
                  setVerificationVideoFile(null);
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
