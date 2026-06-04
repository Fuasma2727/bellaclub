"use client";

import { useEffect, useRef, useState } from "react";

type ScreenProtectionProps = {
  active?: boolean;
};

export default function ScreenProtection({
  active = true,
}: ScreenProtectionProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    const showOverlay = (duration = 3500) => {
      setVisible(true);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setVisible(false);
        timeoutRef.current = null;
      }, duration);
    };

    const clearClipboard = () => {
      void navigator.clipboard?.writeText("").catch(() => undefined);
    };

    const blockEvent = (event: Event) => {
      event.preventDefault();
      showOverlay();
    };

    const blockKeys = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const blockedCombo =
        (event.ctrlKey || event.metaKey) &&
        ["s", "p", "u", "c", "a"].includes(key);
      const blockedDevTools =
        key === "f12" ||
        ((event.ctrlKey || event.metaKey) &&
          event.shiftKey &&
          ["i", "j", "c"].includes(key));
      const blockedSystemCapture =
        key === "printscreen" ||
        key === "snapshot" ||
        key === "insert" ||
        (event.metaKey && event.shiftKey && ["3", "4", "5"].includes(key));

      if (blockedCombo || blockedDevTools || blockedSystemCapture) {
        event.preventDefault();
        event.stopPropagation();
        showOverlay(4500);
        clearClipboard();
      }
    };

    const protectOnFocusLoss = () => {
      showOverlay(5000);
    };

    const protectOnVisibilityChange = () => {
      if (document.hidden) showOverlay(5000);
    };

    const protectBeforePrint = (event: Event) => {
      event.preventDefault();
      showOverlay(5000);
      clearClipboard();
    };

    document.addEventListener("contextmenu", blockEvent);
    document.addEventListener("dragstart", blockEvent);
    document.addEventListener("selectstart", blockEvent);
    document.addEventListener("copy", blockEvent);
    document.addEventListener("cut", blockEvent);
    document.addEventListener("visibilitychange", protectOnVisibilityChange);
    window.addEventListener("keydown", blockKeys, true);
    window.addEventListener("keyup", blockKeys, true);
    window.addEventListener("blur", protectOnFocusLoss);
    window.addEventListener("beforeprint", protectBeforePrint);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      document.removeEventListener("contextmenu", blockEvent);
      document.removeEventListener("dragstart", blockEvent);
      document.removeEventListener("selectstart", blockEvent);
      document.removeEventListener("copy", blockEvent);
      document.removeEventListener("cut", blockEvent);
      document.removeEventListener(
        "visibilitychange",
        protectOnVisibilityChange
      );
      window.removeEventListener("keydown", blockKeys, true);
      window.removeEventListener("keyup", blockKeys, true);
      window.removeEventListener("blur", protectOnFocusLoss);
      window.removeEventListener("beforeprint", protectBeforePrint);
    };
  }, [active]);

  if (!active || !visible) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 px-6 text-center backdrop-blur-md print:flex">
      <div className="max-w-sm rounded-lg border border-white/10 bg-white/[0.04] px-5 py-4 shadow-2xl shadow-black/60">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
          BelaClub
        </p>
        <p className="mt-2 text-lg font-semibold text-white">
          Contenido protegido
        </p>
        <p className="mt-2 text-sm leading-5 text-neutral-400">
          Las descargas, capturas y copias no estan permitidas dentro de la
          plataforma.
        </p>
      </div>
    </div>
  );
}
