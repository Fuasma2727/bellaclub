import { useState, type ReactNode } from "react";
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
  isOpening?: boolean;
  onOpen?: (id: string) => void;
  onOpenDailyVideo?: (provider: Prestador) => void;
  afterContent?: ReactNode;
};

function WhatsAppIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[15px] w-[15px] sm:h-4 sm:w-4"
      fill="none"
    >
      <path
        d="M4.7 19.5 6 15.7a7.8 7.8 0 1 1 2.9 2.8l-4.2 1Z"
        fill="#fff"
      />
      <path
        d="M9.1 7.7c.18-.4.38-.42.68-.42h.52c.23 0 .46.05.62.46l.62 1.48c.1.25.08.48-.08.68l-.46.55c-.12.15-.15.32-.04.5.48.86 1.2 1.6 2.08 2.08.18.1.36.08.5-.06l.7-.72c.18-.18.42-.22.66-.1l1.48.7c.34.16.48.34.46.62-.02.42-.28 1.18-.92 1.66-.58.44-1.55.56-2.96-.02-2.42-.98-4.02-2.86-4.62-4.44-.42-1.08-.32-2.06.26-2.96Z"
        fill="#16a34a"
      />
    </svg>
  );
}

export default function ProviderCard({
  provider,
  isOpening = false,
  onOpen,
  onOpenDailyVideo,
  afterContent,
}: ProviderCardProps) {
  const [showBadgeInfo, setShowBadgeInfo] = useState(false);
  const name = getDisplayName(provider);
  const location = getLocation(provider);
  const whatsappUrl = getWhatsAppUrl(provider.whatsapp);
  const rating = Number(provider.rating || 0);
  const badgeLevel = Number(provider.badgeVerificationLevel);
  const verificationBadge =
    badgeLevel === 1
      ? "bronze"
      : badgeLevel === 2
        ? "silver"
        : badgeLevel === 3
          ? "gold"
          : badgeLevel === 4
            ? "platinum"
            : provider.verificationBadge;
  const badgeText =
    verificationBadge === "bronze"
      ? "Este usuario fue verificado por foto"
      : verificationBadge === "silver"
        ? "Este usuario fue verificado por video"
        : verificationBadge === "gold"
          ? "Este usuario fue verificado presencialmente"
          : "Este usuario fue verificado por servicio";
  const badgeStyle =
    verificationBadge === "bronze"
      ? {
          shell:
            "border-[#b7784d]/45 bg-[#b7784d]/12 shadow-[#4a2415]/20 hover:bg-[#b7784d]/18",
          gem: "linear-gradient(135deg, #e7aa78 0%, #a9673f 52%, #5f3525 100%)",
        }
      : verificationBadge === "silver"
        ? {
            shell:
              "border-slate-100/45 bg-slate-200/10 shadow-slate-950/20 hover:bg-slate-100/16",
            gem: "linear-gradient(135deg, #ffffff 0%, #cbd5e1 52%, #64748b 100%)",
          }
        : verificationBadge === "gold"
          ? {
              shell:
                "border-amber-300/45 bg-amber-300/12 shadow-amber-950/22 hover:bg-amber-300/18",
              gem: "linear-gradient(135deg, #fff2b8 0%, #d9a328 52%, #8a5a12 100%)",
            }
          : {
              shell:
                "border-white/85 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.72),rgba(219,234,254,0.26)_34%,rgba(125,211,252,0.18)_58%,rgba(167,139,250,0.16)_100%)] shadow-[0_0_24px_rgba(191,219,254,0.50)] ring-1 ring-white/30 hover:border-white hover:shadow-[0_0_34px_rgba(191,219,254,0.78)]",
              gem: "text-sky-100 drop-shadow-[0_0_7px_rgba(255,255,255,0.95)]",
            };
  const privateCount = (provider.media || []).filter((item) => item.private)
    .length;
  const hasDailyVideo = Boolean(provider.dailyVideo?.url);

  return (
    <article
      className={`group overflow-hidden rounded-md border border-white/[0.08] bg-[#101012] shadow-lg shadow-black/15 transition duration-300 hover:border-white/20 hover:bg-[#141416] hover:shadow-black/35 ${
        onOpen ? "cursor-pointer hover:-translate-y-0.5" : ""
      }`}
      onClick={() => onOpen?.(provider.id)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
        {hasDailyVideo ? (
          <>
            <video
              src={provider.dailyVideo?.url}
              muted
              loop
              playsInline
              preload="metadata"
              className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <button
              type="button"
              aria-label={`Reproducir video del dia de ${name}`}
              onClick={(event) => {
                event.stopPropagation();
                onOpenDailyVideo?.(provider);
              }}
              className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/45 text-white shadow-2xl shadow-black/40 backdrop-blur transition hover:scale-105 hover:bg-black/60 sm:h-14 sm:w-14"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="ml-0.5 h-5 w-5 sm:h-6 sm:w-6"
                fill="currentColor"
              >
                <path d="M8 5.2v13.6L18.8 12 8 5.2Z" />
              </svg>
            </button>
            <span className="absolute left-2 top-2 rounded-full border border-sky-200/20 bg-black/55 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-100 backdrop-blur">
              Video del dia
            </span>
          </>
        ) : (
          <Image
            src={provider.photoUrl || "/default-avatar.png"}
            alt={name}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
          />
        )}

        {privateCount > 0 && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent p-2">
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

      <div className="px-2.5 pb-2 pt-1.5 sm:px-3 sm:pb-2.5 sm:pt-2">
        <div className="min-w-0">
          <h2 className="truncate text-[13px] font-semibold leading-[15px] text-neutral-50 sm:text-sm">
            {name}
          </h2>
          <p className="truncate text-[11px] leading-[15px] text-neutral-500 sm:text-xs">
            {location || "Ubicacion por confirmar"}
          </p>
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs font-semibold leading-4 text-blue-300 sm:text-sm">
            {provider.price ? formatMoney(provider.price) : "Sin precio"}
          </p>

          <div className="flex shrink-0 items-center gap-1.5">
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
                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border shadow-lg transition hover:-translate-y-0.5 sm:h-7 sm:w-7 ${badgeStyle.shell}`}
              >
                {verificationBadge === "platinum" ? (
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className={`h-4 w-4 sm:h-[18px] sm:w-[18px] ${badgeStyle.gem}`}
                    fill="none"
                  >
                    <path
                      d="M7.2 4.5h9.6l3.2 4.4L12 20 4 8.9l3.2-4.4Z"
                      fill="url(#diamondFill)"
                      stroke="currentColor"
                      strokeWidth="1.15"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4.2 8.9h15.6M7.2 4.5l2.2 4.4L12 4.5l2.6 4.4 2.2-4.4M9.4 8.9 12 20l2.6-11.1"
                      stroke="white"
                      strokeOpacity="0.82"
                      strokeWidth="0.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <defs>
                      <linearGradient
                        id="diamondFill"
                        x1="5"
                        x2="18.5"
                        y1="5"
                        y2="18"
                        gradientUnits="userSpaceOnUse"
                      >
                        <stop stopColor="#FFFFFF" />
                        <stop offset="0.36" stopColor="#DBEAFE" />
                        <stop offset="0.72" stopColor="#7DD3FC" />
                        <stop offset="1" stopColor="#A78BFA" />
                      </linearGradient>
                    </defs>
                  </svg>
                ) : (
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rotate-45 rounded-[2px] shadow-sm ring-1 ring-white/20 sm:h-3.5 sm:w-3.5"
                    style={{ background: badgeStyle.gem }}
                  />
                )}
              </button>
            )}

            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Contactar a ${name} por WhatsApp`}
                onClick={(event) => event.stopPropagation()}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-200/30 bg-[#16a34a] text-white shadow-lg shadow-emerald-950/25 transition hover:-translate-y-0.5 hover:border-emerald-100/50 hover:bg-[#22c55e] sm:h-7 sm:w-7"
              >
                <WhatsAppIcon />
              </a>
            )}
          </div>
        </div>

        {showBadgeInfo && verificationBadge && (
          <div className="mt-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs leading-5 text-neutral-300">
            {badgeText}
          </div>
        )}

        {afterContent}
      </div>
    </article>
  );
}
