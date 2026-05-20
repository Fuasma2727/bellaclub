"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getWhatsAppUrl } from "@/app/prestadores/_components/utils";

type VerificationStatus = "pending" | "approved" | "rejected";
type BadgeVerificationStatus = "none" | "pending" | "approved" | "rejected";
type VerificationBadge = "gold" | "diamond";

type AdminMediaItem = {
  id: string;
  type: "photo" | "video";
  url?: string;
  private: boolean;
  description?: string;
};

type ProviderVerification = {
  id: string;
  email?: string;
  name?: string;
  whatsapp?: string;
  city?: string;
  department?: string;
  photoUrl?: string;
  blocked?: boolean;
  blockedReason?: string | null;
  balance?: number;
  verificationPhotoUrl?: string;
  verificationStatus?: VerificationStatus;
  verificationBadge?: VerificationBadge | null;
  badgeVerificationStatus?: BadgeVerificationStatus;
  badgeVerificationLevel?: 1 | 2;
  badgeVerificationVideoUrl?: string | null;
  badgeVerificationRequestedAt?: string | null;
  blockedAt?: string | null;
  subscriptionStatus?: string | null;
  subscriptionNextChargeAt?: string | null;
  subscriptionLastPaidAt?: string | null;
  subscriptionAmount?: number | null;
  media?: AdminMediaItem[];
  createdAt?: string | null;
};

type VerificationListResponse = {
  providers?: ProviderVerification[];
  error?: string;
};

type ReportItem = {
  id: string;
  providerId: string;
  providerName?: string;
  providerEmail?: string;
  providerWhatsapp?: string;
  providerPhotoUrl?: string;
  providerBlocked?: boolean;
  reporterEmail?: string;
  reason?: string;
  status?: "pending" | "reviewed";
  createdAt?: string | null;
  reviewedAt?: string | null;
};

type ReportsListResponse = {
  reports?: ReportItem[];
  error?: string;
};

type VerificationAction =
  | "approve"
  | "reject"
  | "verifyVisit"
  | "removeVisit"
  | "block"
  | "unblock"
  | "deleteMedia";

const statusClass: Record<VerificationStatus, string> = {
  pending: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
  approved: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  rejected: "border-red-500/30 bg-red-500/10 text-red-200",
};

const statusLabel: Record<VerificationStatus, string> = {
  pending: "Pendiente",
  approved: "Publicado",
  rejected: "Rechazado",
};

export default function AdminVerificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [providers, setProviders] = useState<ProviderVerification[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [activeView, setActiveView] = useState<
    "requests" | "blocked" | "reports"
  >("requests");

  const loadProviders = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const token = await user.getIdToken();
      const params = new URLSearchParams();

      if (search.trim()) params.set("q", search.trim());

      if (activeView === "reports") {
        params.set("status", "pending");
        const queryString = params.toString() ? `?${params.toString()}` : "";
        const res = await fetch(`/api/admin/reports${queryString}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = (await res.json()) as ReportsListResponse;

        if (!res.ok) {
          throw new Error(data.error || "No pudimos cargar los reportes");
        }

        setReports(data.reports || []);
        setProviders([]);
        return;
      }

      if (activeView === "blocked") params.set("filter", "blocked");

      const queryString = params.toString() ? `?${params.toString()}` : "";
      const res = await fetch(`/api/admin/verifications${queryString}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = (await res.json()) as VerificationListResponse;

      if (!res.ok) {
        throw new Error(data.error || "No pudimos cargar las solicitudes");
      }

      setProviders(data.providers || []);
      setReports([]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "No pudimos cargar el panel";
      setMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [activeView, search, user]);

  useEffect(() => {
    if (!authLoading) {
      void loadProviders();
    }
  }, [authLoading, loadProviders]);

  const handleAction = async (
    provider: ProviderVerification,
    action: VerificationAction,
    mediaId?: string
  ) => {
    if (!user) return;

    if (action === "reject" || action === "block") {
      const confirmed = window.confirm(
        action === "block"
          ? "Seguro que quieres bloquear este perfil?"
          : "Seguro que quieres rechazar esta solicitud?"
      );

      if (!confirmed) return;
    }

    if (action === "deleteMedia") {
      const confirmed = window.confirm(
        "Seguro que quieres eliminar esta foto del prestador?"
      );

      if (!confirmed) return;
    }

    const currentActionId =
      action === "deleteMedia" && mediaId
        ? `${provider.id}:${mediaId}`
        : provider.id;

    setActionId(currentActionId);
    setMessage("");

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/verifications/${provider.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, mediaId }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "No pudimos actualizar la solicitud");
      }

      setProviders((current) => {
        if (action === "deleteMedia" && mediaId) {
          return current.map((item) => {
            if (item.id !== provider.id) return item;

            if (mediaId === "profile-photo") {
              return { ...item, photoUrl: "" };
            }

            return {
              ...item,
              media: (item.media || []).filter((media) => media.id !== mediaId),
            };
          });
        }

        if (action === "unblock" && activeView === "blocked") {
          return current.filter((item) => item.id !== provider.id);
        }

        if (action === "block" && activeView === "blocked") {
          return current.map((item) =>
            item.id === provider.id ? { ...item, blocked: true } : item
          );
        }

        if (action === "block" || action === "unblock") {
          return current.map((item) => {
            if (item.id !== provider.id) return item;
            return { ...item, blocked: action === "block" };
          });
        }

        return current.filter((item) => item.id !== provider.id);
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No pudimos actualizar la solicitud";
      setMessage(errorMessage);
    } finally {
      setActionId(null);
    }
  };

  const handleReportAction = async (
    report: ReportItem,
    action: "markReviewed" | "blockProvider"
  ) => {
    if (!user) return;

    if (action === "blockProvider") {
      const confirmed = window.confirm(
        "Seguro que quieres bloquear el perfil reportado?"
      );

      if (!confirmed) return;
    }

    setActionId(report.id);
    setMessage("");

    try {
      const token = await user.getIdToken();

      if (action === "blockProvider") {
        const res = await fetch(
          `/api/admin/verifications/${report.providerId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "block" }),
          }
        );
        const data = (await res.json()) as { error?: string };

        if (!res.ok) {
          throw new Error(data.error || "No pudimos bloquear el perfil");
        }

        setReports((current) =>
          current.map((item) =>
            item.id === report.id ? { ...item, providerBlocked: true } : item
          )
        );
        return;
      }

      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reportId: report.id, action }),
      });
      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        throw new Error(data.error || "No pudimos actualizar el reporte");
      }

      setReports((current) => current.filter((item) => item.id !== report.id));
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No pudimos actualizar el reporte";
      setMessage(errorMessage);
    } finally {
      setActionId(null);
    }
  };

  const isLoading = authLoading || loading;
  const hasResults = activeView === "reports" ? reports.length > 0 : providers.length > 0;

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <header className="flex flex-col gap-5 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/prestadores"
              className="mb-6 inline-flex items-center gap-3"
            >
              <Image
                src="/logofinal.svg"
                alt="BelaClub"
                width={40}
                height={40}
                priority
              />
              <span className="text-xl font-semibold">BelaClub</span>
            </Link>
            <p className="text-sm font-medium text-blue-300">
              Panel de control
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Verificacion de prestadores
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              Revisa solicitudes iniciales y solicitudes de insignia enviadas
              por los prestadores.
            </p>
          </div>

          <Link
            href="/prestadores"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:border-white/20 hover:text-white"
          >
            Ver sitio publico
          </Link>
        </header>

        {!user && !isLoading && (
          <section className="mt-10 rounded-lg border border-white/10 bg-neutral-950 p-8 text-center">
            <h2 className="text-xl font-semibold">Debes iniciar sesion</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Entra con la cuenta duena de BelaClub para revisar solicitudes.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500"
            >
              Ir al login
            </Link>
          </section>
        )}

        {message && (
          <div className="mt-6 rounded-lg border border-red-700 bg-red-950/40 p-4 text-sm text-red-200">
            {message}
          </div>
        )}

        {user && (
          <section className="mt-6 rounded-lg border border-white/10 bg-neutral-950 p-4">
            <div className="mb-3 inline-flex rounded-lg border border-white/10 bg-black/30 p-1">
              <button
                type="button"
                onClick={() => setActiveView("requests")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  activeView === "requests"
                    ? "bg-white text-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Solicitudes
              </button>
              <button
                type="button"
                onClick={() => setActiveView("blocked")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  activeView === "blocked"
                    ? "bg-red-500 text-white"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Bloqueados
              </button>
              <button
                type="button"
                onClick={() => setActiveView("reports")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  activeView === "reports"
                    ? "bg-amber-500 text-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Reportes
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void loadProviders();
                }}
                placeholder={
                  activeView === "reports"
                    ? "Buscar reporte por prestador, correo, WhatsApp o motivo"
                    : activeView === "blocked"
                    ? "Buscar bloqueado por nombre, correo o WhatsApp"
                    : "Buscar por nombre, correo o WhatsApp"
                }
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
              />
              <button
                type="button"
                onClick={() => void loadProviders()}
                className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Buscar
              </button>
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                  }}
                  className="rounded-lg border border-white/10 px-5 py-3 text-sm font-semibold text-neutral-300 transition hover:bg-white/[0.06] hover:text-white"
                >
                  Limpiar
                </button>
              )}
            </div>
          </section>
        )}

        {isLoading && (
          <div className="mt-10 rounded-lg border border-white/10 bg-neutral-950 p-8 text-center text-neutral-400">
            Cargando prestadores...
          </div>
        )}

        {user && !isLoading && !hasResults && !message && (
          <section className="mt-10 rounded-lg border border-white/10 bg-neutral-950 p-8 text-center">
            <h2 className="text-xl font-semibold">
              {search
                ? "No hay resultados"
                : activeView === "reports"
                  ? "No hay reportes"
                : activeView === "blocked"
                  ? "No hay bloqueados"
                  : "No hay solicitudes"}
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              {search
                ? "Prueba con otro nombre, correo o telefono."
                : activeView === "reports"
                  ? "Cuando un usuario reporte un perfil aparecera aqui."
                : activeView === "blocked"
                  ? "No tienes perfiles bloqueados en este momento."
                : "Cuando un prestador solicite aprobacion o una insignia aparecera aqui."}
            </p>
          </section>
        )}

        {user && !isLoading && activeView === "reports" && reports.length > 0 && (
          <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {reports.map((report) => {
              const whatsappUrl = getWhatsAppUrl(report.providerWhatsapp);

              return (
                <article
                  key={report.id}
                  className="overflow-hidden rounded-lg border border-white/10 bg-neutral-950"
                >
                  <div className="relative h-56 bg-zinc-950">
                    {report.providerPhotoUrl ? (
                      <Image
                        src={report.providerPhotoUrl}
                        alt={report.providerName || "Prestador reportado"}
                        fill
                        className="object-cover"
                        sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-500">
                        Sin foto del prestador
                      </div>
                    )}
                    <span className="absolute left-3 top-3 rounded-full border border-amber-400/30 bg-amber-400/15 px-3 py-1 text-xs font-semibold text-amber-100 backdrop-blur">
                      Reporte pendiente
                    </span>
                    {report.providerBlocked && (
                      <span className="absolute right-3 top-3 rounded-full border border-red-400/30 bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-100 backdrop-blur">
                        Bloqueado
                      </span>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="mb-4">
                      <p className="truncate text-sm font-semibold text-neutral-100">
                        {report.providerName || "Prestador sin nombre"}
                      </p>
                      {report.providerEmail && (
                        <p className="mt-1 truncate text-xs text-neutral-500">
                          {report.providerEmail}
                        </p>
                      )}
                      {report.providerWhatsapp && (
                        <p className="mt-1 truncate text-xs text-neutral-500">
                          WhatsApp: {report.providerWhatsapp}
                        </p>
                      )}
                      {report.createdAt && (
                        <p className="mt-1 text-xs text-neutral-500">
                          {new Date(report.createdAt).toLocaleString("es-CO")}
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                        Motivo
                      </p>
                      <p className="mt-2 text-sm leading-6 text-neutral-200">
                        {report.reason || "Reporte general"}
                      </p>
                      {report.reporterEmail && (
                        <p className="mt-3 text-xs text-neutral-500">
                          Reportado por: {report.reporterEmail}
                        </p>
                      )}
                    </div>

                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex w-full items-center justify-center rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
                      >
                        Contactar por WhatsApp
                      </a>
                    )}

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        disabled={actionId === report.id}
                        onClick={() =>
                          void handleReportAction(report, "markReviewed")
                        }
                        className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionId === report.id ? "Procesando..." : "Revisado"}
                      </button>
                      <button
                        type="button"
                        disabled={actionId === report.id || report.providerBlocked}
                        onClick={() =>
                          void handleReportAction(report, "blockProvider")
                        }
                        className="rounded-lg border border-red-500/40 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {report.providerBlocked ? "Ya bloqueado" : "Bloquear"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {user && !isLoading && activeView !== "reports" && providers.length > 0 && (
          <section className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {providers.map((provider) => {
              const status = provider.verificationStatus || "pending";
              const isInitialRequest = status === "pending";
              const isBadgeRequest =
                status === "approved" &&
                provider.badgeVerificationStatus === "pending";
              const whatsappUrl = getWhatsAppUrl(provider.whatsapp);
              const isBlockedView = activeView === "blocked";

              return (
                <article
                  key={provider.id}
                  className="overflow-hidden rounded-lg border border-white/10 bg-neutral-950"
                >
                  <div className="relative h-[420px] bg-zinc-950">
                    {isBadgeRequest && provider.badgeVerificationVideoUrl ? (
                      <video
                        src={provider.badgeVerificationVideoUrl}
                        controls
                        className="h-full w-full object-contain"
                      />
                    ) : provider.verificationPhotoUrl ? (
                      <Image
                        src={provider.verificationPhotoUrl}
                        alt={`Foto de verificacion de ${
                          provider.email || "prestador"
                        }`}
                        fill
                        className="object-contain"
                        sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-neutral-500">
                        Sin foto de verificacion
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-neutral-200">
                          {provider.name ||
                            provider.email ||
                            "Prestador sin nombre"}
                        </p>
                        {provider.email && (
                          <p className="mt-1 truncate text-xs text-neutral-500">
                            {provider.email}
                          </p>
                        )}
                        {provider.whatsapp && (
                          <p className="mt-1 truncate text-xs text-neutral-500">
                            WhatsApp: {provider.whatsapp}
                          </p>
                        )}
                        {typeof provider.balance === "number" && (
                          <p className="mt-1 text-xs text-neutral-500">
                            Saldo: ${provider.balance.toLocaleString("es-CO")}
                          </p>
                        )}
                        {provider.subscriptionStatus && (
                          <p className="mt-1 text-xs text-neutral-500">
                            Mensualidad:{" "}
                            {provider.subscriptionStatus === "active"
                              ? "Activa"
                              : provider.subscriptionStatus === "past_due"
                                ? "Pendiente"
                                : provider.subscriptionStatus ===
                                    "admin_override"
                                  ? "Activada por admin"
                                  : "Por cobrar"}
                          </p>
                        )}
                        {provider.createdAt && (
                          <p className="mt-1 text-xs text-neutral-500">
                            {new Date(
                              provider.badgeVerificationRequestedAt ||
                                provider.createdAt
                            ).toLocaleString("es-CO")}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClass[status]}`}
                        >
                          {statusLabel[status]}
                        </span>
                        {provider.verificationBadge && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                            Aprobado:{" "}
                            {provider.verificationBadge === "diamond"
                              ? "💎"
                              : "✦"}
                          </span>
                        )}
                        {isBadgeRequest && (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                            Nivel {provider.badgeVerificationLevel}
                          </span>
                        )}
                        {provider.blocked && (
                          <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-medium text-red-200">
                            {provider.blockedReason === "subscription_unpaid"
                              ? "Mensualidad pendiente"
                              : "Bloqueado"}
                          </span>
                        )}
                      </div>
                    </div>

                    {whatsappUrl && (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-3 flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-400/15"
                      >
                        Contactar por WhatsApp
                      </a>
                    )}

                    <button
                      type="button"
                      disabled={actionId === provider.id}
                      onClick={() =>
                        handleAction(
                          provider,
                          provider.blocked ? "unblock" : "block"
                        )
                      }
                      className={`mb-3 w-full rounded-lg px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        provider.blocked
                          ? "border border-emerald-400/30 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/15"
                          : "border border-red-500/35 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                      }`}
                    >
                      {actionId === provider.id
                        ? "Procesando..."
                        : provider.blocked
                          ? "Desbloquear perfil"
                          : "Bloquear perfil"}
                    </button>

                    {isBlockedView ? (
                      <div className="space-y-3">
                        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-100">
                          {provider.blockedReason === "subscription_unpaid"
                            ? "Perfil bloqueado por mensualidad pendiente. Puedes activarlo manualmente desde aqui aunque no pague."
                            : "Perfil bloqueado. Puedes eliminar fotos antes de volver a activarlo."}
                        </div>

                        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                              Fotos del perfil
                            </p>
                            <span className="text-xs text-neutral-600">
                              {(provider.media || []).length +
                                (provider.photoUrl ? 1 : 0)}
                            </span>
                          </div>

                          {!provider.photoUrl &&
                          (!provider.media || provider.media.length === 0) ? (
                            <p className="text-sm text-neutral-500">
                              Este prestador no tiene fotos para moderar.
                            </p>
                          ) : (
                            <div className="grid grid-cols-2 gap-3">
                              {provider.photoUrl && (
                                <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                                  <div className="relative aspect-square">
                                    <Image
                                      src={provider.photoUrl}
                                      alt="Foto principal"
                                      fill
                                      className="object-cover"
                                      sizes="180px"
                                    />
                                  </div>
                                  <div className="p-2">
                                    <p className="mb-2 truncate text-xs text-neutral-400">
                                      Foto principal
                                    </p>
                                    <button
                                      type="button"
                                      disabled={
                                        actionId ===
                                        `${provider.id}:profile-photo`
                                      }
                                      onClick={() =>
                                        handleAction(
                                          provider,
                                          "deleteMedia",
                                          "profile-photo"
                                        )
                                      }
                                      className="w-full rounded-md border border-red-500/35 bg-red-500/10 px-2 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {actionId ===
                                      `${provider.id}:profile-photo`
                                        ? "Eliminando..."
                                        : "Eliminar"}
                                    </button>
                                  </div>
                                </div>
                              )}

                              {(provider.media || []).map((media) => (
                                <div
                                  key={media.id}
                                  className="overflow-hidden rounded-lg border border-white/10 bg-black/30"
                                >
                                  <div className="relative aspect-square">
                                    {media.type === "video" ? (
                                      <video
                                        src={media.url}
                                        className="h-full w-full object-cover"
                                        muted
                                      />
                                    ) : (
                                      <Image
                                        src={media.url || "/default-avatar.png"}
                                        alt={
                                          media.description || "Foto de perfil"
                                        }
                                        fill
                                        className="object-cover"
                                        sizes="180px"
                                      />
                                    )}
                                    {media.private && (
                                      <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[10px] font-semibold text-white">
                                        Privada
                                      </span>
                                    )}
                                  </div>
                                  <div className="p-2">
                                    <p className="mb-2 truncate text-xs text-neutral-400">
                                      {media.description ||
                                        (media.private
                                          ? "Contenido privado"
                                          : "Contenido publico")}
                                    </p>
                                    <button
                                      type="button"
                                      disabled={
                                        actionId ===
                                        `${provider.id}:${media.id}`
                                      }
                                      onClick={() =>
                                        handleAction(
                                          provider,
                                          "deleteMedia",
                                          media.id
                                        )
                                      }
                                      className="w-full rounded-md border border-red-500/35 bg-red-500/10 px-2 py-2 text-xs font-semibold text-red-100 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {actionId ===
                                      `${provider.id}:${media.id}`
                                        ? "Eliminando..."
                                        : "Eliminar"}
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : isInitialRequest ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={actionId === provider.id}
                          onClick={() => handleAction(provider, "approve")}
                          className="rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {actionId === provider.id
                            ? "Procesando..."
                            : "Aprobar"}
                        </button>
                        <button
                          type="button"
                          disabled={actionId === provider.id}
                          onClick={() => handleAction(provider, "reject")}
                          className="rounded-lg border border-red-500/40 px-4 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : isBadgeRequest ? (
                      <button
                        type="button"
                        disabled={actionId === provider.id}
                        onClick={() => handleAction(provider, "verifyVisit")}
                        className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {actionId === provider.id
                          ? "Procesando..."
                          : provider.badgeVerificationLevel === 2
                            ? "Aprobar insignia 💎"
                            : "Aprobar insignia ✦"}
                      </button>
                    ) : (
                      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-neutral-400">
                        Sin acciones pendientes
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
