"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import ExpandedMediaModal from "@/app/prestadores/_components/ExpandedMediaModal";
import PurchaseModal from "@/app/prestadores/_components/PurchaseModal";
import type {
  ApiResponse,
  MediaItem,
  PendingPurchase,
} from "@/app/prestadores/_components/types";
import { formatMoney } from "@/app/prestadores/_components/utils";
import { useAuth } from "@/context/AuthContext";

type PublicProfileMediaViewerProps = {
  items: MediaItem[];
  providerId: string;
  name: string;
  city?: string;
  variant: "hero" | "gallery";
};

type ProviderApiResponse = {
  provider?: {
    photoUrl?: string;
    media?: MediaItem[];
  };
};

const getMediaKey = (item: MediaItem, index: number) => {
  return `${item.id || item.url || item.previewUrl || "media"}-${index}`;
};

const visibleMedia = (item: MediaItem) => {
  return Boolean(item.url || item.previewUrl || item.private);
};

export default function PublicProfileMediaViewer({
  items,
  providerId,
  name,
  city,
  variant,
}: PublicProfileMediaViewerProps) {
  const { user } = useAuth();
  const [displayItems, setDisplayItems] = useState(items);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [pendingPurchase, setPendingPurchase] =
    useState<PendingPurchase | null>(null);
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const visibleItems = useMemo(
    () => displayItems.filter(visibleMedia),
    [displayItems]
  );
  const expandableItems = useMemo(
    () => visibleItems.filter((item) => Boolean(item.url)),
    [visibleItems]
  );
  const currentItem =
    currentIndex === null ? null : expandableItems[currentIndex] || null;
  const place = city || "BelaClub";

  useEffect(() => {
    setDisplayItems(items);
  }, [items]);

  useEffect(() => {
    if (!user || !providerId) return;

    let cancelled = false;

    const refreshPurchasedMedia = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch(`/api/providers/${providerId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = (await res.json()) as ProviderApiResponse;

        if (!res.ok || !data.provider) return;

        const nextItems: MediaItem[] = [
          {
            id: "profile-photo",
            type: "photo",
            url: data.provider.photoUrl || items[0]?.url || "",
            description: `Foto principal de ${name}`,
          },
          ...(data.provider.media || []).filter(visibleMedia),
        ];

        if (!cancelled) setDisplayItems(nextItems);
      } catch {
        // Si falla, dejamos el contenido publico renderizado por servidor.
      }
    };

    void refreshPurchasedMedia();

    return () => {
      cancelled = true;
    };
  }, [items, name, providerId, user]);

  const getExpandableIndex = (item: MediaItem) => {
    return expandableItems.findIndex(
      (candidate) =>
        candidate === item ||
        (candidate.id && candidate.id === item.id) ||
        (candidate.url && candidate.url === item.url)
    );
  };

  const openMedia = (item: MediaItem, visibleIndex = 0) => {
    if (item.unavailable) {
      setNotice(item.unavailableReason || "Este contenido no esta disponible.");
      return;
    }

    if (item.private && !item.url) {
      if (!user) {
        setNotice("Inicia sesion para desbloquear contenido privado.");
        return;
      }

      setNotice("");
      setPurchaseError("");
      setPendingPurchase({ item, index: visibleIndex });
      return;
    }

    const index = getExpandableIndex(item);
    if (index >= 0) {
      setNotice("");
      setCurrentIndex(index);
    }
  };

  const handlePurchase = async () => {
    if (!user || !pendingPurchase) return;

    if (!pendingPurchase.item.id) {
      setPurchaseError("No pudimos identificar este contenido privado.");
      return;
    }

    setPurchaseLoading(true);
    setPurchaseError("");

    try {
      const res = await fetch("/api/pay-content", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sellerId: providerId,
          mediaId: pendingPurchase.item.id,
        }),
      });
      const data = (await res.json()) as ApiResponse & {
        mediaUrl?: string;
        mediaId?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "No pudimos desbloquear el contenido");
      }

      const mediaId = data.mediaId || pendingPurchase.item.id;
      const unlockedUrl = data.mediaUrl || "";
      const nextItems = displayItems.map((item) =>
        item.id === mediaId
          ? { ...item, url: unlockedUrl, purchased: true }
          : item
      );
      const nextExpandableItems = nextItems
        .filter(visibleMedia)
        .filter((item) => Boolean(item.url));
      const nextIndex = nextExpandableItems.findIndex(
        (item) => item.id === mediaId
      );

      setDisplayItems(nextItems);
      setPendingPurchase(null);
      setPurchaseError("");
      setNotice("Contenido desbloqueado.");

      if (nextIndex >= 0) {
        setCurrentIndex(nextIndex);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No pudimos desbloquear el contenido";
      setPurchaseError(message);
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleRecharge = () => {
    const amount = Number(pendingPurchase?.item.price || 0);

    setPendingPurchase(null);
    setPurchaseError("");

    window.dispatchEvent(
      new CustomEvent("belaclub:open-balance-modal", {
        detail: {
          mode: "recharge",
          amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
        },
      })
    );
  };

  const moveMedia = (direction: number) => {
    setCurrentIndex((index) => {
      if (index === null || expandableItems.length === 0) return index;

      return (index + direction + expandableItems.length) % expandableItems.length;
    });
  };

  const modal = currentItem ? (
    <ExpandedMediaModal
      item={currentItem}
      canGoNext={expandableItems.length > 1}
      canGoPrevious={expandableItems.length > 1}
      onNext={() => moveMedia(1)}
      onPrevious={() => moveMedia(-1)}
      onClose={() => setCurrentIndex(null)}
    />
  ) : null;

  if (variant === "hero") {
    const hero = expandableItems[0];

    if (!hero?.url) {
      return (
        <div className="overflow-hidden rounded-md border border-white/[0.08] bg-[#101012]">
          <div className="relative aspect-[3/4] bg-zinc-900">
            <Image
              src="/default-avatar.png"
              alt={`${name} en ${place}`}
              fill
              priority
              draggable={false}
              className="pointer-events-none select-none object-cover"
              sizes="(min-width: 1024px) 420px, 100vw"
            />
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="overflow-hidden rounded-md border border-white/[0.08] bg-[#101012]">
          <button
            type="button"
            onClick={() => openMedia(hero, 0)}
            onContextMenu={(event) => event.preventDefault()}
            className="group relative block aspect-[3/4] w-full overflow-hidden bg-zinc-900 text-left"
            aria-label={`Ampliar foto principal de ${name}`}
          >
            <Image
              src={hero.url}
              alt={`${name} en ${place}`}
              fill
              priority
              draggable={false}
              className="pointer-events-none select-none object-cover transition duration-300 group-hover:scale-105"
              sizes="(min-width: 1024px) 420px, 100vw"
            />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-3 text-xs font-semibold text-white/90 opacity-0 transition group-hover:opacity-100">
              Click para ampliar
            </span>
          </button>
        </div>
        {modal}
      </>
    );
  }

  if (visibleItems.length === 0) return null;

  return (
    <>
      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">
            Galeria del perfil
          </h2>
          <span className="text-xs text-neutral-500">
            {visibleItems.length} archivo{visibleItems.length === 1 ? "" : "s"}
          </span>
        </div>

        {notice && (
          <p className="mb-3 rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-sm text-amber-100">
            {notice}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {visibleItems.map((item, index) => {
            const lockedPrivate = Boolean(item.private && !item.url);
            const previewUrl = item.url || item.previewUrl || "";
            const priceLabel = formatMoney(item.price);

            return (
              <button
                key={getMediaKey(item, index)}
                type="button"
                onClick={() => openMedia(item, index)}
                onContextMenu={(event) => event.preventDefault()}
                className={`group relative aspect-[3/4] overflow-hidden rounded-md border border-white/[0.08] bg-zinc-900 text-left transition hover:border-white/20 ${
                  item.unavailable ? "cursor-not-allowed" : "cursor-pointer"
                }`}
                aria-label={
                  lockedPrivate
                    ? `Contenido privado de ${name}`
                    : item.type === "video"
                      ? `Reproducir video de ${name}`
                      : `Ampliar foto de ${name}`
                }
              >
                {previewUrl && item.type === "video" && !lockedPrivate ? (
                  <>
                    <video
                      src={previewUrl}
                      muted
                      playsInline
                      preload="metadata"
                      draggable={false}
                      controlsList="nodownload noplaybackrate"
                      disablePictureInPicture
                      className={`pointer-events-none absolute inset-0 h-full w-full select-none object-cover transition duration-300 group-hover:scale-105 ${
                        lockedPrivate ? "scale-105 opacity-45 blur-[2px] saturate-75" : ""
                      }`}
                    />
                    {!lockedPrivate && (
                      <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-2xl shadow-black/45 backdrop-blur-md transition group-hover:scale-105">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="ml-0.5 h-6 w-6"
                          fill="currentColor"
                        >
                          <path d="M8 5.2v13.6L18.8 12 8 5.2Z" />
                        </svg>
                      </span>
                    )}
                  </>
                ) : previewUrl ? (
                  <Image
                    src={previewUrl}
                    unoptimized={Boolean(item.private) || previewUrl.startsWith("/api/")}
                    alt={item.description || `${name} en ${place}`}
                    fill
                    draggable={false}
                    className={`pointer-events-none select-none object-cover transition duration-300 group-hover:scale-105 ${
                      lockedPrivate ? "scale-105 opacity-80 blur-[2px] saturate-75" : ""
                    }`}
                    sizes="(min-width: 1024px) 25vw, 50vw"
                  />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_rgba(0,0,0,0.18))]" />
                )}

                {lockedPrivate && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/5" />
                    <span className="absolute left-2 top-2 z-10 rounded-full border border-white/10 bg-white/[0.08] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 shadow-lg shadow-black/30 backdrop-blur">
                      Privado
                    </span>
                    <span className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white shadow-lg shadow-black/40 backdrop-blur">
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M7 11V8a5 5 0 0 1 10 0v3" />
                        <rect x="5" y="11" width="14" height="10" rx="2" />
                      </svg>
                    </span>
                    <div className="absolute inset-x-2 bottom-2 z-10 rounded-md border border-white/10 bg-black/62 p-2 text-left shadow-xl shadow-black/35 backdrop-blur">
                      <p className="line-clamp-2 min-h-[2rem] text-[11px] font-medium leading-4 text-white sm:text-xs sm:leading-5">
                        {item.description || "Contenido privado"}
                      </p>
                      {priceLabel && (
                        <span className="mt-1.5 inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/12 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                          {priceLabel}
                        </span>
                      )}
                    </div>
                  </>
                )}

                {item.unavailable && (
                  <div className="absolute inset-0 bg-black/65 p-3 text-xs text-amber-100">
                    {item.unavailableReason || "No disponible"}
                  </div>
                )}

                {!lockedPrivate && !item.unavailable && (
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-2 text-xs font-semibold text-white/90 opacity-0 transition group-hover:opacity-100">
                    {item.type === "video" ? "Reproducir" : "Ampliar"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
      {modal}
      {pendingPurchase && (
        <PurchaseModal
          pendingPurchase={pendingPurchase}
          purchaseError={purchaseError}
          purchaseLoading={purchaseLoading}
          onClose={() => {
            setPendingPurchase(null);
            setPurchaseError("");
          }}
          onPurchase={() => void handlePurchase()}
          onRecharge={handleRecharge}
        />
      )}
    </>
  );
}
