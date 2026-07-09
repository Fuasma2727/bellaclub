"use client";

import Image from "next/image";
import { useEffect, useState, useSyncExternalStore } from "react";

const ageGateStorageKey = "belaclub_age_gate_until";
const ageGateDurationMs = 30 * 24 * 60 * 60 * 1000;

const getStoredAgeGateExpiry = () => {
  try {
    return Number(window.localStorage.getItem(ageGateStorageKey) || 0);
  } catch {
    return 0;
  }
};

const storeAgeGateConfirmation = () => {
  try {
    window.localStorage.setItem(
      ageGateStorageKey,
      String(Date.now() + ageGateDurationMs)
    );
  } catch {
    // If storage is unavailable, the current session can still continue.
  }
};

const subscribeAgeGateStorage = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
  };
};

const getAgeGateSnapshot = () => {
  return getStoredAgeGateExpiry() <= Date.now();
};

const getAgeGateServerSnapshot = () => false;

export default function AgeGate() {
  const shouldShowAgeGate = useSyncExternalStore(
    subscribeAgeGateStorage,
    getAgeGateSnapshot,
    getAgeGateServerSnapshot
  );
  const [confirmedThisSession, setConfirmedThisSession] = useState(false);
  const visible = shouldShowAgeGate && !confirmedThisSession;

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  if (!visible) return null;

  const confirmAge = () => {
    storeAgeGateConfirmation();
    setConfirmedThisSession(true);
  };

  const leaveSite = () => {
    window.location.href = "https://www.google.com";
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/88 px-4 py-6 text-white backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="age-gate-title"
      aria-describedby="age-gate-description"
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0)_34%,rgba(59,130,246,0.08)_100%)]" />

      <div className="relative w-full max-w-lg overflow-hidden rounded-xl border border-white/[0.1] bg-[#101012] shadow-2xl shadow-black/55">
        <div className="border-b border-white/[0.08] bg-white/[0.025] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25 shadow-lg shadow-black/25">
              <Image
                src="/logofinal.svg"
                alt="BelaClub"
                width={28}
                height={22}
                priority
              />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                Acceso para adultos
              </p>
              <p className="mt-0.5 truncate text-lg font-semibold text-white">
                BelaClub
              </p>
            </div>
          </div>
        </div>

        <div className="px-5 py-6 sm:px-6 sm:py-7">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-blue-200/25 bg-blue-400/10 text-blue-100 shadow-lg shadow-blue-950/20">
            <span className="text-xl font-semibold">18+</span>
          </div>

          <h2
            id="age-gate-title"
            className="mt-5 text-center text-2xl font-semibold leading-tight text-white sm:text-3xl"
          >
            Confirma que eres mayor de edad
          </h2>

          <p
            id="age-gate-description"
            className="mx-auto mt-3 max-w-md text-center text-sm leading-6 text-neutral-300"
          >
            BelaClub es una plataforma privada para adultos. Para continuar,
            confirma que tienes 18 a&ntilde;os o m&aacute;s y que aceptas
            acceder bajo tu propia responsabilidad.
          </p>

          <div className="mt-5 rounded-md border border-white/[0.08] bg-white/[0.03] p-4">
            <div className="grid gap-3 text-sm leading-6 text-neutral-300">
              <p className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
                Solo pueden usar BelaClub personas adultas seg&uacute;n la ley
                aplicable.
              </p>
              <p className="flex gap-2">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-300" />
                No recolectamos documentos para esta confirmaci&oacute;n
                inicial.
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_1.15fr]">
            <button
              type="button"
              onClick={leaveSite}
              className="rounded-md border border-white/[0.1] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07] hover:text-white"
            >
              Salir
            </button>
            <button
              type="button"
              onClick={confirmAge}
              autoFocus
              className="rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/25 transition hover:bg-blue-500"
            >
              Tengo 18 a&ntilde;os o m&aacute;s
            </button>
          </div>

          <p className="mt-4 text-center text-xs leading-5 text-neutral-500">
            Tu confirmaci&oacute;n se recordar&aacute; por 30 d&iacute;as en
            este dispositivo.
          </p>
        </div>
      </div>
    </div>
  );
}
