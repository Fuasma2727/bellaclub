"use client";

import { useEffect, useMemo } from "react";
import Image from "next/image";
import { MediaItem } from "./types";

type ExpandedMediaModalProps = {
  item: MediaItem;
  watermarkText?: string;
  onClose: () => void;
};

export default function ExpandedMediaModal({
  item,
  watermarkText,
  onClose,
}: ExpandedMediaModalProps) {
  const protectedContent = Boolean(item.private);
  const watermark = useMemo(() => {
    const label = watermarkText?.trim() || "Usuario verificado";
    const date = new Date().toLocaleDateString("es-CO");
    return `BelaClub · ${label} · ${date}`;
  }, [watermarkText]);

  useEffect(() => {
    if (!protectedContent) return;

    const blockEvent = (event: Event) => {
      event.preventDefault();
    };

    const blockKeys = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const blockedCombo =
        (event.ctrlKey || event.metaKey) &&
        ["s", "p", "u", "c"].includes(key);
      const blockedDevTools =
        key === "f12" ||
        ((event.ctrlKey || event.metaKey) &&
          event.shiftKey &&
          ["i", "j", "c"].includes(key));

      if (blockedCombo || blockedDevTools || key === "printscreen") {
        event.preventDefault();
        event.stopPropagation();

        if (key === "printscreen") {
          void navigator.clipboard?.writeText("");
        }
      }
    };

    document.addEventListener("contextmenu", blockEvent);
    document.addEventListener("dragstart", blockEvent);
    document.addEventListener("selectstart", blockEvent);
    window.addEventListener("keydown", blockKeys, true);

    return () => {
      document.removeEventListener("contextmenu", blockEvent);
      document.removeEventListener("dragstart", blockEvent);
      document.removeEventListener("selectstart", blockEvent);
      window.removeEventListener("keydown", blockKeys, true);
    };
  }, [protectedContent]);

  if (!item.url) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex select-none items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      onContextMenu={(event) => {
        if (protectedContent) event.preventDefault();
      }}
    >
      <div
        className="relative inline-flex overflow-hidden rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-black/70 text-xl text-white"
        >
          ×
        </button>

        {item.type === "photo" && protectedContent ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.url}
            alt="Contenido ampliado"
            draggable={false}
            className="max-h-[90vh] w-auto rounded-lg object-contain"
          />
        ) : item.type === "photo" ? (
          <Image
            src={item.url}
            alt="Contenido ampliado"
            width={1600}
            height={1600}
            draggable={false}
            className="max-h-[90vh] w-auto rounded-lg object-contain"
          />
        ) : (
          <video
            src={item.url}
            controls
            autoPlay
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            onContextMenu={(event) => event.preventDefault()}
            className="max-h-[90vh] w-auto rounded-lg object-contain"
          />
        )}

        {protectedContent && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-black/[0.02]" />
            <div className="pointer-events-none absolute inset-0 grid rotate-[-24deg] grid-cols-2 gap-8 opacity-30 sm:grid-cols-3">
              {Array.from({ length: 18 }).map((_, index) => (
                <span
                  key={index}
                  className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)] sm:text-sm"
                >
                  {watermark}
                </span>
              ))}
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-medium text-white/90 backdrop-blur">
              Contenido protegido
            </div>
          </>
        )}
      </div>
    </div>
  );
}
