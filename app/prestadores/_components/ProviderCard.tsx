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
  afterContent?: ReactNode;
};

export default function ProviderCard({
  provider,
  isOpening = false,
  onOpen,
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
          gem: "from-[#e7aa78] via-[#a9673f] to-[#5f3525]",
        }
      : verificationBadge === "silver"
        ? {
            shell:
              "border-slate-100/45 bg-slate-200/10 shadow-slate-950/20 hover:bg-slate-100/16",
            gem: "from-white via-slate-300 to-slate-500",
          }
        : verificationBadge === "gold"
          ? {
              shell:
                "border-amber-300/45 bg-amber-300/12 shadow-amber-950/22 hover:bg-amber-300/18",
              gem: "from-[#fff2b8] via-[#d9a328] to-[#8a5a12]",
            }
          : {
              shell:
                "border-white/85 bg-[radial-gradient(circle_at_30%_18%,rgba(255,255,255,0.72),rgba(219,234,254,0.26)_34%,rgba(125,211,252,0.18)_58%,rgba(167,139,250,0.16)_100%)] shadow-[0_0_24px_rgba(191,219,254,0.50)] ring-1 ring-white/30 hover:border-white hover:shadow-[0_0_34px_rgba(191,219,254,0.78)]",
              gem: "text-sky-100 drop-shadow-[0_0_7px_rgba(255,255,255,0.95)]",
            };
  const privateCount = (provider.media || []).filter((item) => item.private)
    .length;

  return (
    <article
      className={`group overflow-hidden rounded-md border border-white/[0.08] bg-[#101012] shadow-lg shadow-black/15 transition duration-300 hover:border-white/20 hover:bg-[#141416] hover:shadow-black/35 ${
        onOpen ? "cursor-pointer hover:-translate-y-0.5" : ""
      }`}
      onClick={() => onOpen?.(provider.id)}
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
                    className={`h-2.5 w-2.5 rotate-45 rounded-[2px] bg-gradient-to-br shadow-sm sm:h-3 sm:w-3 ${badgeStyle.gem}`}
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
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-emerald-300/25 bg-emerald-500 text-white shadow-lg shadow-emerald-950/25 transition hover:bg-emerald-400 sm:h-7 sm:w-7"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5"
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

        {afterContent}
      </div>
    </article>
  );
}
