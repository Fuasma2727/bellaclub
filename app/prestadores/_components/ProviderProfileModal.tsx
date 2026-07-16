"use client";

import { useState } from "react";
import Image from "next/image";
import { getPhoneSeoValues } from "@/lib/providerPhoneSeo";
import { MediaItem, Prestador } from "./types";
import {
  formatMoney,
  getDisplayName,
  getWhatsAppUrl,
} from "./utils";

type ProviderProfileModalProps = {
  provider: Prestador;
  mediaList: MediaItem[];
  userLoggedIn: boolean;
  hasPurchased: (item: MediaItem) => boolean;
  onClose: () => void;
  onRequestAuth: () => void;
  onOpenDeposit: () => void;
  onReport: () => void;
  onOpenMedia: (index: number) => void;
  onMediaClick: (item: MediaItem, index: number) => void;
};

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
    >
      <path
        d="M5.2 18.8 6.3 15.5A7 7 0 1 1 8.6 17.7L5.2 18.8Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M9.3 8.2c.2-.4.4-.4.7-.4h.5c.2 0 .4.1.5.4l.5 1.2c.1.2.1.4 0 .6l-.4.5c-.1.2-.1.3 0 .5.4.8 1.2 1.5 2 1.9.2.1.3.1.5-.1l.6-.7c.1-.2.3-.2.6-.1l1.3.6c.2.1.4.3.4.5 0 .4-.2 1.2-.8 1.6-.5.4-1.4.5-2.7 0-2.4-.9-4-2.8-4.5-4.4-.3-.9-.2-1.6.2-2.1Z"
        fill="#101012"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.7.6 2.5a2 2 0 0 1-.4 2.1L8 9.6a16 16 0 0 0 6.4 6.4l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.6.5 2.5.6a2 2 0 0 1 1.7 2Z" />
    </svg>
  );
}

function LockIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="6" y="10" width="12" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 15-4.5-4.5L11 16l-2-2-4 4" />
    </svg>
  );
}

function PlayIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path d="M8 5.2v13.6L18.8 12 8 5.2Z" />
    </svg>
  );
}

const formatDuration = (seconds?: number | null) => {
  const safeSeconds = Math.max(0, Math.ceil(Number(seconds || 0)));

  if (!safeSeconds) return "";

  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
};

export default function ProviderProfileModal({
  provider,
  mediaList,
  userLoggedIn,
  hasPurchased,
  onClose,
  onRequestAuth,
  onOpenDeposit,
  onReport,
  onOpenMedia,
  onMediaClick,
}: ProviderProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"gallery" | "description">(
    "gallery"
  );
  const providerName = getDisplayName(provider);
  const whatsappUrl = getWhatsAppUrl(provider.whatsapp);
  const phoneSeo = getPhoneSeoValues(provider.whatsapp);
  const displayPhone = phoneSeo.canonicalDigits
    ? phoneSeo.formattedLocal ||
      phoneSeo.formattedInternational ||
      phoneSeo.canonicalDigits
    : "";
  const isPrivateMediaUrl = (url?: string) =>
    Boolean(url?.includes("/api/private-media"));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6"
      onClick={onClose}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <div
        className="relative max-h-[calc(100dvh-24px)] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-lg border border-white/[0.08] bg-[#101012] shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-48px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-black/70 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 backdrop-blur sm:left-4 sm:top-4">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Aprobado
        </span>

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/70 text-xl text-white backdrop-blur transition hover:bg-white/10 sm:right-4 sm:top-4"
        >
          x
        </button>

        <section className="grid gap-0 lg:grid-cols-[340px_1fr]">
          <div className="border-b border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent p-4 sm:p-5 lg:border-b-0 lg:border-r">
            <div
              className="relative mx-auto h-32 w-32 overflow-hidden rounded-full border border-white/15 bg-zinc-900 shadow-2xl shadow-black/40 ring-4 ring-white/[0.04] sm:h-44 sm:w-44"
              onClick={() => onOpenMedia(0)}
            >
              <Image
                src={provider.photoUrl || "/default-avatar.png"}
                alt={providerName}
                fill
                draggable={false}
                onContextMenu={(event) => event.preventDefault()}
                className="object-cover"
                sizes="176px"
                priority
              />
            </div>

            <div className="mt-4 sm:mt-5">
              <div className="flex items-center justify-center gap-2 text-center">
                <h2 className="min-w-0 max-w-[210px] truncate text-lg font-semibold sm:max-w-[230px] sm:text-xl">
                  {providerName}
                </h2>
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Contactar a ${providerName} por WhatsApp`}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-500 text-white shadow-lg shadow-emerald-950/25 transition hover:bg-emerald-400"
                  >
                    <WhatsAppIcon />
                  </a>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!userLoggedIn) {
                  onRequestAuth();
                  return;
                }

                onOpenDeposit();
              }}
              className="mt-4 w-full rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 sm:mt-5"
            >
              Abonar al servicio
            </button>

            <div
              className={`mt-3 grid gap-2 ${
                displayPhone ? "sm:grid-cols-[minmax(0,1fr)_150px]" : ""
              }`}
            >
              {displayPhone && (
                <div
                  aria-label={`Telefono de ${providerName}: ${displayPhone}`}
                  className="flex min-h-[48px] min-w-0 items-center gap-3 rounded-md border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-left text-neutral-200"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300/20 bg-emerald-400/10 text-emerald-100">
                    <PhoneIcon />
                  </span>
                  <span className="min-w-0 whitespace-nowrap text-sm font-semibold leading-5 text-white">
                    {displayPhone}
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!userLoggedIn) {
                    onRequestAuth();
                    return;
                  }

                  onReport();
                }}
                className="min-h-[48px] rounded-md border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.07] hover:text-white"
              >
                Reportar perfil
              </button>
            </div>

          </div>

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-2 rounded-md border border-white/[0.08] bg-black/25 p-1 sm:inline-flex">
                <button
                  type="button"
                  onClick={() => setActiveTab("gallery")}
                  className={`rounded px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "gallery"
                      ? "bg-white text-[#101012]"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Galeria
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("description")}
                  className={`rounded px-4 py-2 text-sm font-semibold transition ${
                    activeTab === "description"
                      ? "bg-white text-[#101012]"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  Descripcion
                </button>
              </div>

            </div>

            {activeTab === "gallery" && (
              <>
                {mediaList.length <= 1 ? (
                  <div className="mt-4 rounded-md border border-dashed border-white/[0.08] p-8 text-center text-sm text-neutral-500">
                    Este perfil aun no tiene contenido en galeria.
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                    {mediaList.slice(1).map((item, index) => {
                      const realIndex = index + 1;
                      const alreadyUnlocked = hasPurchased(item);
                      const isPrivate = Boolean(
                        item.private && !alreadyUnlocked
                      );
                      const previewUrl = isPrivate
                        ? item.previewUrl || item.url || ""
                        : item.url || "";
                      const durationLabel =
                        item.type === "video"
                          ? formatDuration(item.duration)
                          : "";
                      const privateDescription = item.description?.trim() || "";
                      const priceLabel = formatMoney(item.price);

                      return (
                        <button
                          key={`${item.id || item.url || "media"}-${index}`}
                          type="button"
                          aria-label={
                            isPrivate
                              ? "Desbloquear contenido privado"
                              : "Ampliar contenido"
                          }
                          className="group relative aspect-square overflow-hidden rounded-md border border-white/[0.08] bg-zinc-900"
                          onClick={() => onMediaClick(item, realIndex)}
                          onContextMenu={(event) => event.preventDefault()}
                        >
                          {previewUrl &&
                          item.type === "photo" &&
                          (isPrivate || isPrivateMediaUrl(previewUrl)) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={previewUrl}
                              alt="Contenido"
                              draggable={false}
                              onContextMenu={(event) => event.preventDefault()}
                              className={`absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105 ${
                                isPrivate
                                  ? "scale-105 opacity-45 blur-[2px] saturate-75"
                                  : ""
                              }`}
                            />
                          ) : previewUrl && item.type === "photo" ? (
                            <Image
                              src={previewUrl}
                              alt="Contenido"
                              fill
                              draggable={false}
                              onContextMenu={(event) => event.preventDefault()}
                              className={`object-cover transition duration-300 group-hover:scale-105 ${
                                isPrivate
                                  ? "scale-105 opacity-45 blur-[2px] saturate-75"
                                  : ""
                              }`}
                              sizes="(min-width: 1024px) 220px, 33vw"
                            />
                          ) : previewUrl ? (
                            <video
                              src={previewUrl}
                              muted
                              playsInline
                              preload="metadata"
                              draggable={false}
                              controlsList="nodownload noplaybackrate"
                              disablePictureInPicture
                              onContextMenu={(event) => event.preventDefault()}
                              className={`absolute inset-0 h-full w-full object-cover ${
                                isPrivate
                                  ? "scale-105 opacity-45 blur-[2px] saturate-75"
                                  : ""
                              }`}
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_rgba(0,0,0,0.15))]" />
                          )}

                          {item.type === "video" && !isPrivate && (
                            <>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/36 via-transparent to-black/10 opacity-90 transition group-hover:from-black/45" />
                              <span
                                aria-hidden="true"
                                className="absolute left-1/2 top-1/2 z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-2xl shadow-black/45 backdrop-blur-md ring-1 ring-white/10 transition duration-300 group-hover:scale-105 group-hover:border-sky-200/55 group-hover:bg-black/62 sm:h-14 sm:w-14"
                              >
                                <span className="absolute inset-0 rounded-full bg-sky-300/10 blur-md" />
                                <PlayIcon className="relative ml-0.5 h-5 w-5 drop-shadow sm:h-6 sm:w-6" />
                              </span>
                              {durationLabel && (
                                <span className="absolute bottom-2 right-2 z-10 rounded-full border border-white/10 bg-black/65 px-2 py-1 text-[11px] font-semibold tabular-nums text-white shadow-lg shadow-black/35 backdrop-blur">
                                  {durationLabel}
                                </span>
                              )}
                            </>
                          )}

                          {isPrivate && (
                            <>
                              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10 transition group-hover:from-black/80 group-hover:via-black/38" />
                              <span
                                aria-label="Contenido bloqueado"
                                className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white shadow-lg shadow-black/40 backdrop-blur"
                              >
                                <LockIcon />
                              </span>
                              <span className="absolute left-2 top-2 z-10 rounded-full border border-white/10 bg-white/[0.08] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/90 shadow-lg shadow-black/30 backdrop-blur">
                                Privado
                              </span>
                              <span className="absolute left-1/2 top-[40%] z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/45 text-white shadow-xl shadow-black/40 backdrop-blur transition group-hover:scale-105 sm:h-14 sm:w-14">
                                {item.type === "video" ? (
                                  <PlayIcon className="ml-0.5 h-6 w-6" />
                                ) : (
                                  <PhotoIcon />
                                )}
                              </span>
                              <div className="absolute inset-x-2 bottom-2 z-10 rounded-md border border-white/10 bg-black/62 p-2 text-left shadow-xl shadow-black/35 backdrop-blur">
                                <p className="line-clamp-2 min-h-[2rem] text-[11px] font-medium leading-4 text-white sm:text-xs sm:leading-5">
                                  {privateDescription || "Contenido privado"}
                                </p>
                                <div className="mt-1.5 flex min-h-6 items-center justify-between gap-2">
                                  {priceLabel && (
                                    <span className="min-w-0 truncate rounded-full border border-emerald-300/20 bg-emerald-400/12 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                                      {priceLabel}
                                    </span>
                                  )}
                                  {item.type === "video" && durationLabel && (
                                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.08] px-2 py-1 text-[11px] font-semibold tabular-nums text-white">
                                      {durationLabel}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {activeTab === "description" && (
              <div className="mt-4 min-h-56 rounded-md border border-white/[0.08] bg-white/[0.025] p-5">
                {provider.description ? (
                  <p className="text-sm leading-7 text-neutral-300">
                    {provider.description}
                  </p>
                ) : (
                  <p className="text-sm text-neutral-500">
                    Este perfil aun no agrego una descripcion.
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
