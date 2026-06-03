"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MediaItem } from "./types";

type ExpandedMediaModalProps = {
  item: MediaItem;
  canGoNext?: boolean;
  canGoPrevious?: boolean;
  onNext?: () => void;
  onPrevious?: () => void;
  onClose: () => void;
};

export default function ExpandedMediaModal({
  item,
  canGoNext = false,
  canGoPrevious = false,
  onNext,
  onPrevious,
  onClose,
}: ExpandedMediaModalProps) {
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const overlayTimeout = useRef<number | null>(null);
  const [securityOverlay, setSecurityOverlay] = useState(false);
  const protectedContent = Boolean(item.url);
  const watermark = "BelaClub";

  useEffect(() => {
    if (!protectedContent) return;

    const showProtectionOverlay = () => {
      setSecurityOverlay(true);

      if (overlayTimeout.current) {
        window.clearTimeout(overlayTimeout.current);
      }

      overlayTimeout.current = window.setTimeout(() => {
        setSecurityOverlay(false);
        overlayTimeout.current = null;
      }, 2800);
    };

    const blockEvent = (event: Event) => {
      event.preventDefault();
      showProtectionOverlay();
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
        showProtectionOverlay();

        if (key === "printscreen") {
          void navigator.clipboard?.writeText("");
        }
      }
    };

    const blockPrintScreenKeyUp = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "printscreen") return;

      event.preventDefault();
      event.stopPropagation();
      showProtectionOverlay();
      void navigator.clipboard?.writeText("");
    };

    document.addEventListener("contextmenu", blockEvent);
    document.addEventListener("dragstart", blockEvent);
    document.addEventListener("selectstart", blockEvent);
    window.addEventListener("keydown", blockKeys, true);
    window.addEventListener("keyup", blockPrintScreenKeyUp, true);

    return () => {
      if (overlayTimeout.current) {
        window.clearTimeout(overlayTimeout.current);
      }
      document.removeEventListener("contextmenu", blockEvent);
      document.removeEventListener("dragstart", blockEvent);
      document.removeEventListener("selectstart", blockEvent);
      window.removeEventListener("keydown", blockKeys, true);
      window.removeEventListener("keyup", blockPrintScreenKeyUp, true);
    };
  }, [protectedContent]);

  if (!item.url) return null;

  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current;
    const end = event.changedTouches[0];
    touchStart.current = null;

    if (!start || !end) return;

    const deltaX = end.clientX - start.x;
    const deltaY = end.clientY - start.y;
    const isHorizontalSwipe = Math.abs(deltaX) > 55 && Math.abs(deltaY) < 70;

    if (!isHorizontalSwipe) return;

    event.stopPropagation();

    if (deltaX < 0 && canGoNext) {
      onNext?.();
    }

    if (deltaX > 0 && canGoPrevious) {
      onPrevious?.();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex select-none items-center justify-center bg-black/90 p-4"
      onClick={onClose}
      onContextMenu={(event) => {
        if (protectedContent) event.preventDefault();
      }}
    >
      <div
        className="relative inline-flex touch-pan-y overflow-hidden rounded-lg"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = touch
            ? { x: touch.clientX, y: touch.clientY }
            : null;
        }}
        onTouchEnd={handleTouchEnd}
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

        {securityOverlay && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/95 px-6 text-center backdrop-blur-md">
            <div className="max-w-sm rounded-lg border border-white/10 bg-white/[0.04] px-5 py-4 shadow-2xl shadow-black/60">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                BelaClub
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                Contenido protegido
              </p>
              <p className="mt-2 text-sm leading-5 text-neutral-400">
                Las descargas, capturas y copias no estan permitidas dentro de
                la plataforma.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
