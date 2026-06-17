"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/header";

import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { app } from "@/lib/firebase";
import Image from "next/image";

type UploadResponse = {
  url?: string;
  error?: string;
  details?: string;
};

type UserProgress = {
  level: number;
  maxLevel: number;
  balance: number;
  unlockedContentCount: number;
  hasUnlockedContent: boolean;
  serviceDepositCount: number;
  hasServiceDeposit: boolean;
  premiumBalanceRequirement: number;
  isCatadorPremium: boolean;
};

type LevelStep = {
  level: number;
  title: string;
  badge: string;
  requirement: string;
  reward: string;
  completed: boolean;
  locked: boolean;
  progressText: string;
  actionLabel?: string;
  actionType?: "browse" | "recharge";
};

const defaultProgress: UserProgress = {
  level: 1,
  maxLevel: 4,
  balance: 0,
  unlockedContentCount: 0,
  hasUnlockedContent: false,
  serviceDepositCount: 0,
  hasServiceDeposit: false,
  premiumBalanceRequirement: 500000,
  isCatadorPremium: false,
};

const money = (value: number) => `$${value.toLocaleString("es-CO")}`;

const parseUploadResponse = async (res: Response): Promise<UploadResponse> => {
  const responseText = await res.text();

  try {
    return responseText ? (JSON.parse(responseText) as UploadResponse) : {};
  } catch {
    return {
      error:
        res.status === 413
          ? "El servidor rechazo el archivo por tamano. Debemos aumentar el limite de carga en el servidor."
          : `El servidor respondio con un formato inesperado (${res.status}).`,
      details: responseText.slice(0, 300),
    };
  }
};

const buildLevelSteps = (progress: UserProgress): LevelStep[] => [
  {
    level: 1,
    title: "Usuario BelaClub",
    badge: "Inicio",
    requirement: "Crear tu cuenta y completar tu perfil.",
    reward: "Puedes explorar perfiles, guardar saldo y contactar por WhatsApp.",
    completed: true,
    locked: false,
    progressText: "Completado",
  },
  {
    level: 2,
    title: "Explorador privado",
    badge: "Nivel 2",
    requirement: "Desbloquea al menos un contenido oculto.",
    reward: "Empiezas a construir historial dentro de BelaClub.",
    completed: progress.hasUnlockedContent,
    locked: false,
    progressText: `${Math.min(progress.unlockedContentCount, 1)}/1 contenido`,
    actionLabel: "Ver contenido privado",
    actionType: "browse",
  },
  {
    level: 3,
    title: "Cliente de confianza",
    badge: "Nivel 3",
    requirement: "Realiza al menos un abono a un perfil.",
    reward: "Tu cuenta demuestra actividad real con prestadores.",
    completed: progress.level >= 3,
    locked: !progress.hasUnlockedContent,
    progressText: `${Math.min(progress.serviceDepositCount, 1)}/1 abono`,
    actionLabel: "Elegir perfil para abono",
    actionType: "browse",
  },
  {
    level: 4,
    title: "Catador Premium",
    badge: "Meta",
    requirement: `Mantén al menos ${money(
      progress.premiumBalanceRequirement
    )} de saldo disponible.`,
    reward:
      "Podras ser invitado a experiencias gratuitas para dar retroalimentacion privada y ayudar a mejorar la comunidad.",
    completed: progress.isCatadorPremium,
    locked: progress.level < 3,
    progressText: `${money(progress.balance)} / ${money(
      progress.premiumBalanceRequirement
    )}`,
    actionLabel: "Recargar saldo",
    actionType: "recharge",
  },
];

export default function PerfilUsuario() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const db = getFirestore(app);

  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<UserProgress>(defaultProgress);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;

      setPageLoading(true);
      setError("");

      try {
        const token = await user.getIdToken();
        const [profileSnap, progressRes] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          fetch("/api/user-progress", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        if (profileSnap.exists()) {
          const data = profileSnap.data();
          setName(data.name || "");
          setPhotoUrl(data.photoUrl || null);
        }

        const progressData = (await progressRes.json()) as UserProgress & {
          error?: string;
        };

        if (!progressRes.ok || "error" in progressData) {
          throw new Error(
            "error" in progressData && progressData.error
              ? progressData.error
              : "No pudimos cargar tu progreso"
          );
        }

        setProgress(progressData);
      } catch (loadError) {
        const text =
          loadError instanceof Error
            ? loadError.message
            : "No pudimos cargar tu perfil";
        setError(text);
      } finally {
        setPageLoading(false);
      }
    };

    if (!loading) void load();
  }, [user, loading, db]);

  const levelSteps = useMemo(() => buildLevelSteps(progress), [progress]);
  const currentStep =
    levelSteps.find((step) => step.level === progress.level) || levelSteps[0];
  const nextStep = levelSteps.find((step) => !step.completed && !step.locked);
  const progressPercent = Math.round((progress.level / progress.maxLevel) * 100);

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    setError("");
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload-profile-photo", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
        },
        body: formData,
      });

      const data = await parseUploadResponse(res);

      if (!res.ok || !data.url) {
        throw new Error(data.error || "No pudimos subir tu foto");
      }

      setPhotoUrl(data.url);
      await setDoc(
        doc(db, "users", user.uid),
        { photoUrl: data.url },
        { merge: true }
      );
      setMessage("Foto actualizada");
    } catch (uploadError) {
      const text =
        uploadError instanceof Error
          ? uploadError.message
          : "No pudimos subir tu foto";
      setError(text);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!user) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await setDoc(doc(db, "users", user.uid), { name }, { merge: true });
      setMessage("Perfil actualizado");
      setEditMode(false);
    } catch {
      setError("No pudimos guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const runLevelAction = (step?: LevelStep) => {
    if (!step?.actionType) return;

    if (step.actionType === "recharge") {
      window.dispatchEvent(
        new CustomEvent("belaclub:open-balance-modal", {
          detail: { mode: "recharge" },
        })
      );
      return;
    }

    router.push("/prestadores");
  };

  if (loading || pageLoading) {
    return (
      <div className="min-h-screen bg-[#050505] pt-14 text-white sm:pt-16">
        <Header />
        <div className="mx-auto flex min-h-[50vh] max-w-5xl items-center justify-center px-4 text-sm text-neutral-400">
          Cargando perfil...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] pb-12 pt-14 text-white sm:pt-16">
      <Header />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <aside className="rounded-md border border-white/[0.08] bg-[#101012] p-5 shadow-lg shadow-black/20">
            <div className="relative mx-auto h-36 w-36">
              <Image
                src={photoUrl || "/default-avatar.png"}
                alt="Foto de perfil"
                fill
                className="rounded-full border border-white/10 object-cover"
                priority
              />

              {editMode && (
                <label className="absolute bottom-1 right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-black/75 text-white transition hover:bg-white/10">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadPhoto}
                    hidden
                  />
                </label>
              )}
            </div>

            {uploading && (
              <p className="mt-3 text-center text-sm text-blue-300">
                Subiendo foto...
              </p>
            )}

            <div className="mt-5 text-center">
              {editMode ? (
                <input
                  className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2 text-center text-lg font-semibold text-white outline-none transition placeholder:text-neutral-600 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                />
              ) : (
                <h1 className="text-2xl font-semibold">
                  {name || "Usuario BelaClub"}
                </h1>
              )}
              <p className="mt-1 text-sm text-neutral-500">
                Nivel {progress.level} de {progress.maxLevel}
              </p>
            </div>

            <div className="mt-5 rounded-md border border-blue-300/15 bg-blue-400/[0.06] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-200">
                Estado actual
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {currentStep.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                {currentStep.reward}
              </p>
            </div>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-blue-400"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-center text-xs text-neutral-500">
              {progressPercent}% del camino a Catador Premium
            </p>

            {editMode ? (
              <button
                onClick={save}
                disabled={saving}
                className="mt-6 w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar cambios"}
              </button>
            ) : (
              <button
                onClick={() => setEditMode(true)}
                className="mt-6 w-full rounded-md border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07]"
              >
                Editar perfil
              </button>
            )}
          </aside>

          <section className="space-y-5">
            <div className="rounded-md border border-white/[0.08] bg-[#101012] p-5 shadow-lg shadow-black/20">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                Camino de usuario
              </p>
              <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-white sm:text-3xl">
                    Conviértete en Catador Premium
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                    Sube de nivel desbloqueando contenido, realizando abonos y
                    manteniendo saldo disponible. Al llegar a Catador Premium
                    podrás ser tenido en cuenta para experiencias gratuitas con
                    retroalimentación privada.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => runLevelAction(nextStep)}
                  disabled={!nextStep}
                  className="inline-flex min-h-11 items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-default disabled:bg-emerald-600"
                >
                  {nextStep?.actionLabel || "Meta alcanzada"}
                </button>
              </div>

              {message && (
                <div className="mt-4 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
                  {message}
                </div>
              )}
              {error && (
                <div className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                  {error}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  Saldo disponible
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {money(progress.balance)}
                </p>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  Contenido oculto
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {progress.unlockedContentCount}
                </p>
              </div>
              <div className="rounded-md border border-white/[0.08] bg-white/[0.03] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                  Abonos realizados
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {progress.serviceDepositCount}
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {levelSteps.map((step) => (
                <article
                  key={step.level}
                  className={`rounded-md border p-4 transition ${
                    step.completed
                      ? "border-emerald-400/25 bg-emerald-400/[0.07]"
                      : step.locked
                        ? "border-white/[0.08] bg-white/[0.025] opacity-70"
                        : "border-blue-300/20 bg-blue-400/[0.06]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
                        {step.badge}
                      </p>
                      <h3 className="mt-1 text-lg font-semibold text-white">
                        Nivel {step.level}: {step.title}
                      </h3>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        step.completed
                          ? "bg-emerald-400/15 text-emerald-100"
                          : step.locked
                            ? "bg-white/[0.06] text-neutral-400"
                            : "bg-blue-400/15 text-blue-100"
                      }`}
                    >
                      {step.completed
                        ? "Completado"
                        : step.locked
                          ? "Bloqueado"
                          : "Siguiente"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-neutral-300">
                    {step.requirement}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    {step.reward}
                  </p>
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.08] pt-3">
                    <span className="text-xs font-semibold text-neutral-400">
                      {step.progressText}
                    </span>
                    {!step.completed && !step.locked && step.actionLabel && (
                      <button
                        type="button"
                        onClick={() => runLevelAction(step)}
                        className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.07]"
                      >
                        {step.actionLabel}
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
