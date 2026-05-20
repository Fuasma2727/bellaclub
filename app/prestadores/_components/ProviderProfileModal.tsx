"use client";

import { useState } from "react";
import Image from "next/image";
import { MediaItem, Prestador } from "./types";
import {
  formatMoney,
  getDisplayName,
  getLocation,
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
  const providerLocation = getLocation(provider) || "Ubicacion por confirmar";
  const whatsappUrl = getWhatsAppUrl(provider.whatsapp);
  const verificationBadge =
    Number(provider.badgeVerificationLevel) === 2
      ? "diamond"
      : provider.verificationBadge;
  const profileBadgeLabel = verificationBadge
    ? `Aprobado: ${verificationBadge === "diamond" ? "💎" : "✦"}`
    : "Perfil aprobado";
  const isPrivateMediaUrl = (url?: string) =>
    Boolean(url?.includes("/api/private-media"));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 px-3 py-3 backdrop-blur-sm sm:px-4 sm:py-6"
      onClick={onClose}
    >
      <div
        className="relative max-h-[calc(100dvh-24px)] w-full max-w-5xl overflow-y-auto overscroll-contain rounded-lg border border-white/[0.08] bg-[#101012] shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-48px)]"
        onClick={(e) => e.stopPropagation()}
      >
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
                className="object-cover"
                sizes="176px"
                priority
              />
            </div>

            <div className="mt-4 text-center sm:mt-5">
              <div className="flex justify-center">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                  {profileBadgeLabel}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <h2 className="min-w-0 truncate text-xl font-semibold sm:text-2xl">
                  {providerName}
                </h2>
                {whatsappUrl && (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Contactar a ${providerName} por WhatsApp`}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-500 text-white shadow-lg shadow-emerald-950/25 transition hover:bg-emerald-400"
                  >
                    <WhatsAppIcon />
                  </a>
                )}
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-md border border-white/[0.08] bg-black/20 p-2.5 sm:mt-5 sm:space-y-3 sm:p-3">
              <div className="flex items-center gap-3 rounded-md bg-white/[0.025] px-3 py-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-neutral-200"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 21s7-5.3 7-11a7 7 0 1 0-14 0c0 5.7 7 11 7 11Z" />
                    <circle cx="12" cy="10" r="2.5" />
                  </svg>
                </span>
                <div className="min-w-0 text-left">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                    Ubicacion
                  </p>
                  <p className="truncate text-sm font-medium text-neutral-200">
                    {providerLocation}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-md border border-emerald-400/20 bg-emerald-400/10 px-3 py-3 shadow-lg shadow-emerald-950/20">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-[#07130d]"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  >
                    <path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7" />
                    <path d="M7 7h10l2 13H5L7 7Z" />
                    <path d="M9.5 12.5c.6.7 1.4 1 2.5 1s1.9-.3 2.5-1" />
                  </svg>
                </span>
                <div className="min-w-0 text-left">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-200/70">
                    Desde
                  </p>
                  <p className="text-lg font-semibold text-emerald-50">
                    {provider.price ? formatMoney(provider.price) : "Por acordar"}
                  </p>
                </div>
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

            <button
              type="button"
              onClick={() => {
                if (!userLoggedIn) {
                  onRequestAuth();
                  return;
                }

                onReport();
              }}
              className="mt-3 w-full rounded-md border border-white/[0.08] bg-white/[0.03] px-5 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.07] hover:text-white"
            >
              Reportar perfil
            </button>

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

                      return (
                        <button
                          key={`${item.id || item.url || "media"}-${index}`}
                          type="button"
                          className="group relative aspect-square overflow-hidden rounded-md border border-white/[0.08] bg-zinc-900"
                          onClick={() => onMediaClick(item, realIndex)}
                        >
                          {item.url &&
                          item.type === "photo" &&
                          isPrivateMediaUrl(item.url) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.url}
                              alt="Contenido"
                              draggable={false}
                              className={`absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105 ${
                                isPrivate ? "scale-110 blur-md" : ""
                              }`}
                            />
                          ) : item.url && item.type === "photo" ? (
                            <Image
                              src={item.url}
                              alt="Contenido"
                              fill
                              className={`object-cover transition duration-300 group-hover:scale-105 ${
                                isPrivate ? "scale-110 blur-md" : ""
                              }`}
                              sizes="(min-width: 1024px) 220px, 33vw"
                            />
                          ) : item.url ? (
                            <video
                              src={item.url}
                              muted
                              className={`absolute inset-0 h-full w-full object-cover ${
                                isPrivate ? "scale-110 blur-md" : ""
                              }`}
                            />
                          ) : (
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.08),_rgba(0,0,0,0.15))]" />
                          )}

                          {isPrivate && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 px-2 text-center">
                              <span
                                aria-label="Contenido bloqueado"
                                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/55 text-white backdrop-blur"
                              >
                                <svg
                                  viewBox="0 0 24 24"
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <rect
                                    x="6"
                                    y="10"
                                    width="12"
                                    height="10"
                                    rx="2"
                                  />
                                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                                </svg>
                              </span>
                              {item.description && (
                                <span className="mt-2 line-clamp-2 max-w-[90%] text-xs leading-4 text-neutral-200">
                                  {item.description}
                                </span>
                              )}
                              <span className="mt-2 text-sm font-semibold text-white">
                                {formatMoney(item.price)}
                              </span>
                            </div>
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
                    Este prestador aun no agrego una descripcion.
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
