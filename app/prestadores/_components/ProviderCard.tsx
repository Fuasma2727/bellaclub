import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
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
  imagePriority?: boolean;
  onOpen?: (id: string) => void;
  onOpenDailyVideo?: (provider: Prestador) => void;
  profileHref?: string;
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

function VerificationGem({
  badge,
  className,
}: {
  badge: "bronze" | "silver" | "gold" | "platinum";
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
          fill="url(#diamondTopShine)"
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
            id="diamondTopShine"
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

export default function ProviderCard({
  provider,
  isOpening = false,
  imagePriority = false,
  onOpen,
  onOpenDailyVideo,
  profileHref,
  afterContent,
}: ProviderCardProps) {
  const [showBadgeInfo, setShowBadgeInfo] = useState(false);
  const name = getDisplayName(provider);
  const location = getLocation(provider);
  const whatsappUrl = getWhatsAppUrl(provider.whatsapp);
  const rating = Number(provider.rating || 0);
  const badgeLevel = Number(provider.badgeVerificationLevel);
  const verificationBadge =
    provider.verificationBadge ||
    (badgeLevel === 1
      ? "bronze"
      : badgeLevel === 2
        ? "silver"
        : badgeLevel === 3
          ? "gold"
          : badgeLevel === 4
            ? "platinum"
            : null);
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
            "border-[#b7784d]/45 bg-[#b7784d]/12 text-[#d79263] shadow-[#4a2415]/20 hover:bg-[#b7784d]/18",
          gem: "h-4 w-4 sm:h-[18px] sm:w-[18px]",
        }
      : verificationBadge === "silver"
        ? {
            shell:
              "border-slate-100/50 bg-slate-200/12 text-slate-100 shadow-slate-950/20 hover:bg-slate-100/18",
            gem: "h-4 w-4 sm:h-[18px] sm:w-[18px]",
          }
        : verificationBadge === "gold"
          ? {
              shell:
                "border-amber-200/60 bg-amber-300/14 text-amber-200 shadow-[0_0_16px_rgba(251,191,36,0.22)] hover:bg-amber-300/22",
              gem: "h-[17px] w-[17px] sm:h-5 sm:w-5",
            }
          : {
              shell:
                "border-white/90 bg-[radial-gradient(circle_at_28%_16%,rgba(255,255,255,0.9),rgba(186,230,253,0.34)_34%,rgba(125,211,252,0.24)_58%,rgba(139,92,246,0.22)_100%)] text-white shadow-[0_0_28px_rgba(125,211,252,0.62)] ring-1 ring-white/35 hover:border-white hover:shadow-[0_0_40px_rgba(125,211,252,0.9)]",
              gem: "h-5 w-5 sm:h-[22px] sm:w-[22px]",
            };
  const privateCount = (provider.media || []).filter((item) => item.private)
    .length;
  const hasDailyVideo = Boolean(provider.dailyVideo?.url);

  return (
    <article
      className={`group overflow-hidden rounded-md border border-white/[0.08] bg-[#101012] shadow-lg shadow-black/15 transition duration-300 hover:border-white/20 hover:bg-[#141416] hover:shadow-black/35 ${
        onOpen || profileHref ? "cursor-pointer hover:-translate-y-0.5" : ""
      }`}
      onClick={() => {
        if (onOpen) {
          onOpen(provider.id);
          return;
        }

        if (profileHref) {
          window.location.href = profileHref;
        }
      }}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-zinc-900">
        <Image
          src={provider.photoUrl || "/default-avatar.png"}
          alt={name}
          fill
          draggable={false}
          onContextMenu={(event) => event.preventDefault()}
          className="object-cover transition duration-300 group-hover:scale-105"
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
          priority={imagePriority}
        />

        {hasDailyVideo && (
          <button
            type="button"
            aria-label={`Reproducir video del dia de ${name}`}
            onClick={(event) => {
              event.stopPropagation();
              onOpenDailyVideo?.(provider);
            }}
            className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/48 text-white shadow-2xl shadow-black/45 backdrop-blur transition hover:scale-105 hover:border-sky-200/50 hover:bg-black/65 sm:h-14 sm:w-14"
          >
            <span className="absolute inset-0 rounded-full bg-sky-300/10 blur-md" />
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="relative ml-0.5 h-5 w-5 sm:h-6 sm:w-6"
              fill="currentColor"
            >
              <path d="M8 5.2v13.6L18.8 12 8 5.2Z" />
            </svg>
          </button>
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
          {profileHref ? (
            <Link
              href={profileHref}
              onClick={(event) => event.stopPropagation()}
              className="block truncate text-[13px] font-semibold leading-[15px] text-neutral-50 transition hover:text-blue-100 sm:text-sm"
            >
              {name}
            </Link>
          ) : (
            <h2 className="truncate text-[13px] font-semibold leading-[15px] text-neutral-50 sm:text-sm">
              {name}
            </h2>
          )}
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
                <VerificationGem
                  badge={verificationBadge}
                  className={badgeStyle.gem}
                />
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
