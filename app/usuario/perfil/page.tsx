"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import Header from "@/components/header";

import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import styles from "./page.module.css";

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
  latestUnlockedProvider?: {
    id: string;
    name?: string;
    profilePath?: string;
    mediaId?: string;
  } | null;
};

type LevelStep = {
  level: number;
  title: string;
  requirement: string;
  headline: string;
  completed: boolean;
  locked: boolean;
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
  latestUnlockedProvider: null,
};

const money = (value: number) => `$${value.toLocaleString("es-CO")}`;

type IconName = "arrow" | "check" | "chevron" | "compass" | "crown" | "edit" | "image" | "lock" | "shield" | "sparkles" | "wallet";

function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 5 7 7-7 7" />,
    compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" /></>,
    crown: <><path d="m3 6 5 4 4-6 4 6 5-4-2 12H5Z" /><path d="M6 21h12" /></>,
    edit: <path d="m15 5 4 4M4 20l4-1L20 7a2.8 2.8 0 0 0-4-4L4 15Z" />,
    image: <><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></>,
    sparkles: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z" /><path d="M21 2v4M19 4h4" /></>,
    wallet: <><path d="M20 8V6a2 2 0 0 0-2-2H6a3 3 0 0 0 0 6h14v10H6a3 3 0 0 1-3-3V7" /><path d="M20 12h-5v4h5" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className}>{paths[name]}</svg>;
}

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
    requirement: "Tu cuenta está lista.",
    headline: "Bienvenido al club.",
    completed: true,
    locked: false,
  },
  {
    level: 2,
    title: "Explorador privado",
    requirement: "Desbloquea tu primera foto o video y alcanza el nivel 2.",
    headline: "Hay más por descubrir.",
    completed: progress.hasUnlockedContent,
    locked: false,
    actionLabel: "Explorar contenido",
    actionType: "browse",
  },
  {
    level: 3,
    title: "Cliente de confianza",
    requirement: "Haz tu primer abono a un perfil y alcanza el nivel 3.",
    headline: "El siguiente paso es tuyo.",
    completed: progress.level >= 3,
    locked: !progress.hasUnlockedContent,
    actionLabel: "Explorar perfiles",
    actionType: "browse",
  },
  {
    level: 4,
    title: "Catador Premium",
    requirement: `Mantén ${money(
      progress.premiumBalanceRequirement
    )} de saldo disponible para alcanzar el nivel 4.`,
    headline: "Premium está a un paso.",
    completed: progress.isCatadorPremium,
    locked: progress.level < 3,
    actionLabel: "Recargar saldo",
    actionType: "recharge",
  },
];

export default function PerfilUsuario() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
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
          setWhatsapp(data.whatsapp || "");
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
  }, [user, loading]);

  const levelSteps = useMemo(() => buildLevelSteps(progress), [progress]);
  const currentStep =
    levelSteps.find((step) => step.level === progress.level) || levelSteps[0];
  const nextStep = levelSteps.find((step) => !step.completed && !step.locked);
  const progressPercent = Math.round((progress.level / progress.maxLevel) * 100);
  const heroIcon: IconName = progress.isCatadorPremium || nextStep?.level === 4
    ? "crown"
    : nextStep?.level === 3 ? "shield" : "lock";

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
      await setDoc(
        doc(db, "users", user.uid),
        {
          name: name.trim(),
          whatsapp: whatsapp.trim(),
          profileUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setMessage("Perfil actualizado");
      setEditMode(false);
    } catch {
      setError("No pudimos guardar los cambios");
    } finally {
      setSaving(false);
    }
  };

  const openPrivateContent = () => {
    if (progress.latestUnlockedProvider?.id) {
      router.push(
        `/?providerId=${encodeURIComponent(progress.latestUnlockedProvider.id)}`
      );
      return;
    }

    router.push("/escorts?highlightPrivate=1");
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

    if (step.level === 2) openPrivateContent();
    else router.push("/escorts");
  };

  if (loading || pageLoading || !user) {
    return (
      <div className="min-h-screen bg-[#08080b] pt-14 text-white sm:pt-16">
        <Header />
        <div role="status" className="mx-auto max-w-6xl px-4 py-10">
          <p className="mb-6 text-sm text-neutral-400">Cargando tu espacio...</p>
          <div aria-hidden="true" className="grid gap-5 lg:grid-cols-[270px_1fr] motion-safe:animate-pulse">
            <div className="h-80 rounded-3xl bg-white/5" /><div className="h-64 rounded-3xl bg-white/5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.dashboard} min-h-screen bg-[#08080b] pb-10 pt-14 text-white sm:pt-16`}>
      <Header />
      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-300">Mi cuenta</p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Tu espacio BelaClub</h1>
          </div>
          <Link href="/escorts" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 text-xs font-medium text-neutral-300 hover:border-white/25 hover:text-white sm:px-4">
            <Icon name="compass" className="h-4 w-4" /><span className="hidden sm:inline">Explorar perfiles</span><span className="sm:hidden">Explorar</span>
          </Link>
        </div>
        {message && <div role="status" className="mb-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">{message}</div>}
        {error && <div role="alert" className="mb-5 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

        <div className="grid items-start gap-5 lg:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-3xl border border-white/[0.08] bg-[#111115]">
            <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
              <div className="flex items-center justify-between px-6 pt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Mi perfil</p>
                <span className="flex items-center gap-1.5 text-[10px] text-neutral-400"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Miembro</span>
              </div>
              <div className="flex items-center gap-5 px-6 pb-6 pt-6 lg:flex-col lg:gap-0">
                <div className="relative shrink-0">
                  <div className="rounded-full p-[3px]" style={{ background: `conic-gradient(#fb7185 ${progressPercent}%, #29292f 0)` }}>
                    <div className="relative h-20 w-20 overflow-hidden rounded-full border-[5px] border-[#111115] lg:h-28 lg:w-28">
                      <Image src={photoUrl || "/default-avatar.png"} unoptimized alt="Foto de perfil" fill sizes="112px" className="object-cover" priority />
                    </div>
                  </div>
                  {editMode ? (
                    <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-4 border-[#111115] bg-rose-500 text-white focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-rose-300">
                      <Icon name="edit" className="h-3.5 w-3.5" />
                      <input type="file" accept="image/*" aria-label="Cambiar foto de perfil" onChange={handleUploadPhoto} disabled={uploading} className="sr-only" />
                    </label>
                  ) : <span className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full border-4 border-[#111115] bg-rose-500 text-xs font-bold">{progress.level}</span>}
                </div>
                <div className="min-w-0 flex-1 lg:mt-5 lg:w-full lg:text-center">
                  {editMode ? (
                    <div className="space-y-3 text-left">
                      <label className="block text-xs text-neutral-400">Nombre
                        <input className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-400" value={name} onChange={(event) => setName(event.target.value)} placeholder="Tu nombre" autoComplete="name" />
                      </label>
                      <label className="block text-xs text-neutral-400">WhatsApp
                        <input type="tel" className="mt-1.5 w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-400" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="Tu número de contacto" autoComplete="tel" />
                      </label>
                    </div>
                  ) : (
                    <>
                      <h2 className="break-words text-lg font-semibold tracking-tight">{name || "Usuario BelaClub"}</h2>
                      {whatsapp && <p className="mt-1 break-words text-xs text-neutral-400">{whatsapp}</p>}
                      <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-rose-300/15 bg-rose-400/[0.07] px-2.5 py-1 text-[11px] font-medium text-rose-200">
                        <Icon name={progress.isCatadorPremium ? "crown" : "sparkles"} className="h-3 w-3" />{progress.level === 1 ? "Nivel 1 · Bienvenido al club" : currentStep.title}
                      </span>
                    </>
                  )}
                  {uploading && <p role="status" className="mt-3 text-xs text-rose-200">Subiendo foto...</p>}
                </div>
              </div>
              <div className="mx-6 border-t border-white/[0.07] pt-5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Camino a Premium</span><span className="font-semibold text-neutral-200">{progress.level}<span className="text-neutral-500"> / {progress.maxLevel}</span></span>
                </div>
                <div role="progressbar" aria-label="Camino a Catador Premium" aria-valuemin={0} aria-valuemax={progress.maxLevel} aria-valuenow={progress.level} className="mt-3 flex gap-1.5">
                  {levelSteps.map((step) => <span key={step.level} className={`h-1 flex-1 rounded-full ${step.level <= progress.level ? "bg-rose-400" : "bg-white/10"}`} />)}
                </div>
                <button type={editMode ? "submit" : "button"} onClick={editMode ? undefined : (event) => { event.preventDefault(); setEditMode(true); }} disabled={saving || uploading} className={`mb-6 mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-4 text-xs font-semibold transition disabled:opacity-50 ${editMode ? "border-rose-500 bg-rose-500 text-white hover:bg-rose-400" : "border-white/10 bg-white/[0.03] text-neutral-300 hover:bg-white/[0.07] hover:text-white"}`}>
                  <Icon name={editMode ? "check" : "edit"} className="h-3.5 w-3.5" />{saving ? "Guardando..." : editMode ? "Guardar cambios" : "Editar perfil"}
                </button>
              </div>
            </form>
          </aside>

          <div className="min-w-0 space-y-4">
            <section aria-labelledby="next-challenge" className={styles.hero}>
              <div className="relative z-10 max-w-[420px] py-7 pl-6 pr-6 sm:py-8 sm:pl-8 sm:pr-0">
                <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />{nextStep ? "Tu próximo reto" : "Meta alcanzada"}
                </span>
                <h2 id="next-challenge" className="mt-3 max-w-[290px] text-[30px] font-semibold leading-[1.12] tracking-tight sm:text-[34px]">{nextStep?.headline || "Ya eres Catador Premium."}</h2>
                <p className="mt-3 max-w-[280px] text-[13px] leading-relaxed text-rose-100/65">{nextStep?.requirement || "Disfruta tu contenido y sigue explorando el club."}</p>
                <button type="button" onClick={() => nextStep ? runLevelAction(nextStep) : openPrivateContent()} className="mt-5 inline-flex min-h-11 items-center justify-center gap-3 rounded-xl bg-rose-500 px-5 text-xs font-semibold text-white shadow-lg shadow-rose-950/30 hover:bg-rose-400">
                  {nextStep?.actionLabel || "Ver mi contenido"}<Icon name="arrow" className="h-4 w-4" />
                </button>
                {nextStep && <span className="ml-3 inline-block text-[10px] text-rose-200/60">Nivel {nextStep.level}</span>}
              </div>
              <div aria-hidden="true" className={styles.heroArtwork}>
                <div className={styles.orbit} /><div className={styles.orbitInner} /><div className={styles.backCard} />
                <div className={styles.memberCard}>
                  <div className={styles.cardHeader}><span>BELA<span className="font-normal opacity-60">CLUB</span></span><Icon name="sparkles" className="h-4 w-4" /></div>
                  <span className={styles.cardIcon}><Icon name={heroIcon} className="h-9 w-9" /></span>
                  <div className={styles.cardFooter}><span>{progress.isCatadorPremium || nextStep?.level === 4 ? "PREMIUM" : nextStep?.level === 3 ? "CONFIANZA" : "ACCESO PRIVADO"}</span><span className={styles.cardDots}>•••</span></div>
                </div>
                <span className={styles.floatingBadge}><Icon name={progress.isCatadorPremium ? "check" : "sparkles"} className="h-3.5 w-3.5" />{progress.isCatadorPremium ? "Premium" : `Nivel ${nextStep?.level || progress.level}`}</span>
                <span className={styles.artSparkle}><Icon name="sparkles" className="h-5 w-5" /></span>
              </div>
            </section>

            <section aria-label="Accesos rápidos" className="grid grid-cols-3 gap-3">
              <button type="button" onClick={() => runLevelAction(levelSteps[3])} className={styles.quickAction}>
                <span className="flex w-full items-center justify-between gap-2"><span className="text-xs text-neutral-400">Mi saldo</span><Icon name="wallet" className="h-4 w-4 text-emerald-300/80" /></span>
                <span className="mt-2 block text-[clamp(14px,4.3vw,20px)] font-semibold tracking-tight sm:text-2xl">{money(progress.balance)}</span>
                <span className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-emerald-300">Recargar<Icon name="chevron" className="h-3 w-3" /></span>
              </button>
              <button type="button" onClick={openPrivateContent} className={styles.quickAction}>
                <span className="flex w-full items-center justify-between gap-2"><span className="text-xs text-neutral-400">Mi contenido</span><Icon name="image" className="h-4 w-4 text-violet-300/80" /></span>
                <span className="mt-2 block text-xl font-semibold tracking-tight sm:text-2xl">{progress.unlockedContentCount}<span className="ml-1.5 text-[10px] font-normal tracking-normal text-neutral-500">{progress.unlockedContentCount === 1 ? "desbloqueado" : "desbloqueados"}</span></span>
                <span className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-violet-300">{progress.hasUnlockedContent ? "Ver contenido" : "Explorar"}<Icon name="chevron" className="h-3 w-3" /></span>
              </button>
              <Link href="/escorts" className={styles.quickAction}>
                <span className="flex w-full items-center justify-between gap-2"><span className="text-xs text-neutral-400">Mis abonos</span><Icon name="shield" className="h-4 w-4 text-sky-300/80" /></span>
                <span className="mt-2 block text-xl font-semibold tracking-tight sm:text-2xl">{progress.serviceDepositCount}<span className="ml-1.5 text-[10px] font-normal tracking-normal text-neutral-500">{progress.serviceDepositCount === 1 ? "realizado" : "realizados"}</span></span>
                <span className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-sky-300">Explorar perfiles<Icon name="chevron" className="h-3 w-3" /></span>
              </Link>
            </section>

            <section aria-labelledby="journey-title" className="rounded-3xl border border-white/[0.08] bg-[#111115] px-5 py-5 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <h2 id="journey-title" className="flex items-center gap-2 text-sm font-semibold"><Icon name="crown" className="h-4 w-4 text-amber-200/80" />Tu camino a Premium</h2>
                <span className="text-[11px] text-neutral-400">{progressPercent}%</span>
              </div>
              <ol className={styles.journey}>
                {levelSteps.map((step) => {
                  const isCurrent = step.level === progress.level;
                  const isNext = step.level === nextStep?.level;
                  const icon: IconName = step.completed ? "check" : step.locked ? "lock" : step.level === 4 ? "crown" : step.level === 3 ? "shield" : "image";
                  return (
                    <li key={step.level} aria-current={isCurrent ? "step" : undefined} className={`${styles.journeyStep} ${step.completed ? styles.completed : ""} ${isNext ? styles.next : ""}`}>
                      <span className={styles.stepIcon}><Icon name={icon} className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="text-[9px] font-medium uppercase tracking-[0.1em] text-neutral-500">Nivel {step.level}</p>
                        <h3 className={`mt-1 text-[11px] font-medium leading-4 ${step.locked ? "text-neutral-500" : "text-neutral-200"}`}>{step.locked && step.level !== 4 ? "Por descubrir" : step.level === 1 ? "Miembro BelaClub" : step.title}</h3>
                      </div>
                      <span className={`text-[9px] ${isCurrent ? "text-emerald-300" : isNext ? "text-rose-300" : "text-neutral-500"}`}>{isCurrent ? "Estás aquí" : step.completed ? "Completado" : isNext ? "Siguiente" : "Bloqueado"}</span>
                    </li>
                  );
                })}
              </ol>
              <details className={styles.premiumDetails}>
                <summary className="flex min-h-10 items-center justify-between gap-2 text-[11px] text-neutral-400 hover:text-neutral-200">¿Qué es Catador Premium?<Icon name="chevron" className="h-3 w-3" /></summary>
                <p className="pb-2 text-xs leading-6 text-neutral-400">Podrás ser invitado a experiencias gratuitas a cambio de retroalimentación privada. Las invitaciones están sujetas a disponibilidad.</p>
              </details>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
