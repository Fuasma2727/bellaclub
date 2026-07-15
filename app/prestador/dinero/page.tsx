"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/header";
import { useAuth } from "@/context/AuthContext";

type LedgerItem = {
  id: string;
  type: string;
  direction: "credit" | "debit" | "commission" | "refund" | string;
  amount: number;
  commissionAmount: number;
  netAmount: number | null;
  status: string;
  createdAt: string | null;
};

type WithdrawalItem = {
  id: string;
  amount: number;
  commissionAmount: number;
  releasedAmount: number;
  payoutMethod?: string;
  payoutAccount?: string;
  payoutAccountType?: string;
  accountHolder?: string;
  status: "pending_wompi" | "paid" | "rejected" | string;
  createdAt: string | null;
  paidAt?: string | null;
  rejectedAt?: string | null;
};

type FinanceResponse = {
  balance: number;
  subscriptionStatus?: string | null;
  subscriptionAmount?: number | null;
  subscriptionNextChargeAt?: string | null;
  summary: {
    income: number;
    spent: number;
    commissions: number;
    pendingWithdrawals: number;
  };
  ledger: LedgerItem[];
  withdrawals: WithdrawalItem[];
  error?: string;
};

const money = (value: number) => `$${Number(value || 0).toLocaleString("es-CO")}`;

const formatDate = (value?: string | null) => {
  if (!value) return "Sin fecha";
  return new Date(value).toLocaleString("es-CO", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const ledgerLabel: Record<string, string> = {
  recharge: "Recarga de saldo",
  content_purchase: "Compra de contenido",
  content_sale: "Venta de contenido",
  service_deposit: "Abono realizado",
  service_deposit_received: "Abono recibido",
  withdrawal_request: "Retiro solicitado",
  withdrawal_paid: "Retiro pagado",
  withdrawal_refund: "Retiro devuelto",
  provider_promotion: "Promocion de perfil",
  provider_video_time_purchase: "Tiempo extra de video",
  provider_subscription: "Mensualidad BelaClub",
  daily_video_reward: "Bono por video del dia",
};

const withdrawalStatus: Record<string, { label: string; className: string }> = {
  pending_wompi: {
    label: "Pendiente",
    className: "border-blue-400/25 bg-blue-400/10 text-blue-100",
  },
  paid: {
    label: "Pagado",
    className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  },
  rejected: {
    label: "Rechazado",
    className: "border-red-400/25 bg-red-400/10 text-red-100",
  },
};

export default function ProviderMoneyPage() {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<FinanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFinances = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/provider-finances", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await res.json()) as FinanceResponse;

      if (!res.ok) {
        throw new Error(payload.error || "No pudimos cargar tus movimientos");
      }

      setData(payload);
    } catch (financeError) {
      setError(
        financeError instanceof Error
          ? financeError.message
          : "No pudimos cargar tus movimientos"
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) void loadFinances();
  }, [authLoading, loadFinances]);

  const latestWithdrawals = useMemo(
    () => (data?.withdrawals || []).slice(0, 6),
    [data?.withdrawals]
  );
  const latestLedger = useMemo(
    () => (data?.ledger || []).slice(0, 12),
    [data?.ledger]
  );

  return (
    <div className="min-h-screen bg-[#050505] pt-14 text-white sm:pt-16">
      <Header />

      <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
              Centro financiero
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
              Mi dinero
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              Revisa tu saldo, retiros, comisiones y movimientos recientes de
              BelaClub.
            </p>
          </div>

          <Link
            href="/prestador/perfil"
            className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07] hover:text-white"
          >
            Volver al perfil
          </Link>
        </div>

        {(authLoading || loading) && (
          <section className="rounded-lg border border-white/10 bg-[#101012] p-8 text-center text-sm text-neutral-400">
            Cargando movimientos...
          </section>
        )}

        {!authLoading && !user && (
          <section className="rounded-lg border border-white/10 bg-[#101012] p-8 text-center">
            <h2 className="text-xl font-semibold">Debes iniciar sesion</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Entra con tu cuenta de escort para revisar tu dinero.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold transition hover:bg-blue-500"
            >
              Ir al login
            </Link>
          </section>
        )}

        {error && (
          <section className="rounded-lg border border-red-500/25 bg-red-500/10 p-5 text-sm text-red-100">
            {error}
          </section>
        )}

        {data && !loading && (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100/70">
                  Saldo disponible
                </p>
                <p className="mt-3 text-2xl font-semibold text-emerald-200">
                  {money(data.balance)}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#101012] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                  Ingresos
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {money(data.summary.income)}
                </p>
              </div>
              <div className="rounded-lg border border-blue-400/20 bg-blue-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100/70">
                  Retiros pendientes
                </p>
                <p className="mt-3 text-2xl font-semibold text-blue-100">
                  {money(data.summary.pendingWithdrawals)}
                </p>
              </div>
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-100/70">
                  Comisiones
                </p>
                <p className="mt-3 text-2xl font-semibold text-amber-100">
                  {money(data.summary.commissions)}
                </p>
              </div>
            </section>

            <section className="mt-4 rounded-lg border border-white/10 bg-[#101012] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-500">
                    Mensualidad
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    Estado del cobro mensual
                  </h2>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/25 px-4 py-3 text-sm text-neutral-300">
                  {data.subscriptionStatus === "active"
                    ? "Activa"
                    : data.subscriptionStatus === "past_due"
                      ? "Pendiente de pago"
                      : data.subscriptionStatus === "admin_override"
                        ? "Desactivada por admin"
                        : "Por cobrar"}
                  {data.subscriptionAmount ? (
                    <span className="ml-2 text-neutral-500">
                      {money(data.subscriptionAmount)}
                    </span>
                  ) : null}
                </div>
              </div>
              {data.subscriptionNextChargeAt && (
                <p className="mt-3 text-sm text-neutral-500">
                  Proximo cobro: {formatDate(data.subscriptionNextChargeAt)}
                </p>
              )}
            </section>

            <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-lg border border-white/10 bg-[#101012] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-300">
                      Retiros
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-white">
                      Solicitudes recientes
                    </h2>
                  </div>
                </div>

                {latestWithdrawals.length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-500">
                    Aun no tienes retiros solicitados.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {latestWithdrawals.map((withdrawal) => {
                      const status =
                        withdrawalStatus[withdrawal.status] ||
                        withdrawalStatus.pending_wompi;

                      return (
                        <article
                          key={withdrawal.id}
                          className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                Recibes {money(withdrawal.releasedAmount)}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500">
                                Retiro {money(withdrawal.amount)} · Comision{" "}
                                {money(withdrawal.commissionAmount)}
                              </p>
                            </div>
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${status.className}`}
                            >
                              {status.label}
                            </span>
                          </div>
                          <p className="mt-3 text-xs text-neutral-500">
                            {withdrawal.payoutMethod || "Metodo sin definir"} ·{" "}
                            {withdrawal.payoutAccountType || "Tipo sin definir"} ·{" "}
                            {withdrawal.payoutAccount || "Cuenta sin definir"}
                          </p>
                          <p className="mt-1 text-xs text-neutral-600">
                            {formatDate(withdrawal.createdAt)}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-white/10 bg-[#101012] p-4">
                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                    Historial
                  </p>
                  <h2 className="mt-1 text-lg font-semibold text-white">
                    Movimientos recientes
                  </h2>
                </div>

                {latestLedger.length === 0 ? (
                  <p className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-sm text-neutral-500">
                    Cuando tengas ingresos, retiros o pagos apareceran aqui.
                  </p>
                ) : (
                  <div className="divide-y divide-white/[0.08]">
                    {latestLedger.map((entry) => {
                      const isCredit =
                        entry.direction === "credit" ||
                        entry.direction === "refund";
                      const signedAmount = `${isCredit ? "+" : "-"}${money(
                        entry.amount
                      )}`;

                      return (
                        <article
                          key={entry.id}
                          className="flex items-center justify-between gap-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-white">
                              {ledgerLabel[entry.type] || "Movimiento"}
                            </p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {formatDate(entry.createdAt)}
                            </p>
                            {entry.commissionAmount > 0 && (
                              <p className="mt-1 text-xs text-amber-200/80">
                                Comision {money(entry.commissionAmount)}
                              </p>
                            )}
                          </div>
                          <p
                            className={`shrink-0 text-sm font-semibold ${
                              isCredit ? "text-emerald-300" : "text-neutral-200"
                            }`}
                          >
                            {signedAmount}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
