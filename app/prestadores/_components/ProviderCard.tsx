import { useState } from "react";
import Image from "next/image";
import { Prestador } from "./types";
import {
  formatMoney,
  getDisplayName,
  getLocation,
  getWhatsAppUrl,
} from "./utils";

type ProviderCardProps = {
  provider: Prestador;
  isOpening: boolean;
  onOpen: (id: string) => void;
};

export default function ProviderCard({
  provider,
  isOpening,
  onOpen,
}: ProviderCardProps) {
  const [showBadgeInfo, setShowBadgeInfo] = useState(false);
  const name = getDisplayName(provider);
  const location = getLocation(provider);
  const whatsappUrl = getWhatsAppUrl(provider.whatsapp);
  const rating = Number(provider.rating || 0);
  const badgeLevel = Number(provider.badgeVerificationLevel);
  const verificationBadge =
    badgeLevel === 2 ? "diamond" : provider.verificationBadge;
  const badgeText =
    badgeLevel === 2
      ? "Este usuario fue verificado presencialmente"
      : "Este usuario fue verificado por video";
  const privateCount = (provider.media || []).filter((item) => item.private)
    .length;

  return (
    <article
      className="group cursor-pointer overflow-hidden rounded-md border border-white/[0.08] bg-[#101012] transition hover:border-white/20 hover:bg-[#141416]"
      onClick={() => onOpen(provider.id)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
        <Image
          src={provider.photoUrl || "/default-avatar.png"}
          alt={name}
          fill
          className="object-cover transition duration-300 group-hover:scale-105"
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
        />

        {privateCount > 0 && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-2 sm:p-2.5">
            <div className="flex items-center justify-end">
              <span className="rounded-full border border-white/10 bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
                {privateCount} privado{privateCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        )}

        {isOpening && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
            Abriendo...
          </div>
        )}
      </div>

      <div className="p-2 sm:p-2.5">
        <h2 className="truncate text-[13px] font-semibold text-neutral-50 sm:text-sm">
          {name}
        </h2>
        <p className="mt-1 truncate text-[11px] text-neutral-500 sm:text-xs">
          {location || "Ubicación por confirmar"}
        </p>

        <div className="mt-2 flex items-center justify-between gap-1.5 sm:mt-3 sm:gap-2">
          <p className="min-w-0 truncate text-xs font-semibold text-blue-300 sm:text-sm">
            {provider.price ? formatMoney(provider.price) : "Sin precio"}
          </p>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {rating > 0 && (
              <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-100">
                {rating.toFixed(1)}
              </span>
            )}

            {verificationBadge && (
              <button
                type="button"
                aria-label={badgeText}
                onClick={(event) => {
                  event.stopPropagation();
                  setShowBadgeInfo((value) => !value);
                }}
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs shadow-lg transition hover:-translate-y-0.5 sm:h-8 sm:w-8 sm:text-sm ${
                  verificationBadge === "diamond"
                    ? "border-cyan-300/30 bg-cyan-300/15 text-cyan-100 shadow-cyan-950/20 hover:bg-cyan-300/20"
                    : "border-yellow-300/30 bg-yellow-300/15 text-yellow-100 shadow-yellow-950/20 hover:bg-yellow-300/20"
                }`}
              >
                {verificationBadge === "diamond" ? "💎" : "✦"}
              </button>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Contactar a ${name} por WhatsApp`}
                onClick={(event) => event.stopPropagation()}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-500 text-white shadow-lg shadow-emerald-950/25 transition hover:bg-emerald-400 sm:h-8 sm:w-8"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
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
              </a>
            )}
          </div>
        </div>

        {showBadgeInfo && verificationBadge && (
          <div className="mt-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs leading-5 text-neutral-300">
            {badgeText}
          </div>
        )}
      </div>
    </article>
  );
}
