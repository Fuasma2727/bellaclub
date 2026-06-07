"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  collection,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { app } from "@/lib/firebase";
import { logoutUser } from "@/lib/auth";

const rechargeOptions = [100000, 200000, 500000];
const withdrawalCommissionRate = 0.05;
const minWithdrawalAmount = 50000;
const supportInstagramUrl = "https://www.instagram.com/belaclub_0/";
const payoutMethods = [
  { value: "nequi", label: "Nequi" },
  { value: "bancolombia", label: "Bancolombia" },
];
const accountTypes = [
  { value: "ahorros", label: "Ahorros" },
  { value: "corriente", label: "Corriente" },
];

type NotificationItem = {
  id: string;
  message?: string;
  read?: boolean;
  createdAt?: {
    toDate?: () => Date;
  };
};

export default function Header() {
  const { user } = useAuth();
  const db = getFirestore(app);
  const ownerEmail =
    process.env.NEXT_PUBLIC_OWNER_EMAIL?.toLowerCase() ||
    "jace127127@gmail.com";
  const isOwner = user?.email?.toLowerCase() === ownerEmail;

  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const [role, setRole] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [balanceMode, setBalanceMode] = useState<"recharge" | "withdraw">(
    "recharge"
  );
  const [selectedRechargeAmount, setSelectedRechargeAmount] = useState<
    number | null
  >(null);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalHolder, setWithdrawalHolder] = useState("");
  const [withdrawalMethod, setWithdrawalMethod] = useState("");
  const [withdrawalAccount, setWithdrawalAccount] = useState("");
  const [withdrawalAccountType, setWithdrawalAccountType] = useState("");
  const [balanceMessage, setBalanceMessage] = useState("");
  const [balanceSubmitting, setBalanceSubmitting] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [providerCanPostDailyVideo, setProviderCanPostDailyVideo] =
    useState(false);
  const [mounted, setMounted] = useState(false);

  const unreadCount = notifications.filter((notification) => !notification.read)
    .length;
  const isProvider = role === "prestador";
  const withdrawalValue = Math.floor(Number(withdrawalAmount || 0));
  const withdrawalCommission = Math.floor(
    withdrawalValue * withdrawalCommissionRate
  );
  const withdrawalReleased = Math.max(
    withdrawalValue - withdrawalCommission,
    0
  );
  const supportHref = supportInstagramUrl;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotifications(false);
      }

      if (profileRef.current && !profileRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, "users", user.uid), (snap) => {
      if (!snap.exists()) return;

      const data = snap.data();
      setRole(data.role || null);
      setBalance(Number(data.balance || 0));
      setProviderCanPostDailyVideo(
        data.role === "prestador" &&
          data.verificationStatus === "approved" &&
          data.profileVisible === true &&
          data.profilePaused !== true &&
          data.blocked !== true
      );
    });

    return () => unsubscribe();
  }, [user, db]);

  useEffect(() => {
    if (!user) return;

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snap) => {
      setNotifications(
        snap.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        })) as NotificationItem[]
      );
    });

    return () => unsubscribe();
  }, [user, db]);

  const resetBalanceModal = useCallback(() => {
    setSelectedRechargeAmount(null);
    setWithdrawalAmount("");
    setWithdrawalHolder("");
    setWithdrawalMethod("");
    setWithdrawalAccount("");
    setWithdrawalAccountType("");
    setBalanceMessage("");
    setBalanceSubmitting(false);
  }, []);

  useEffect(() => {
    const handleOpenBalanceModal = (event: Event) => {
      const mode =
        (event as CustomEvent<{ mode?: "recharge" | "withdraw" }>).detail
          ?.mode === "withdraw"
          ? "withdraw"
          : "recharge";

      resetBalanceModal();
      setBalanceMode(mode);
      setModalOpen(true);
    };

    window.addEventListener(
      "belaclub:open-balance-modal",
      handleOpenBalanceModal
    );

    return () => {
      window.removeEventListener(
        "belaclub:open-balance-modal",
        handleOpenBalanceModal
      );
    };
  }, [resetBalanceModal]);

  const closeBalanceModal = () => {
    resetBalanceModal();
    setModalOpen(false);
  };

  const handleLogout = async () => {
    await logoutUser();
    window.location.href = "/prestadores";
  };

  const handleRecharge = async () => {
    if (!selectedRechargeAmount) {
      alert("Selecciona un monto para recargar");
      return;
    }

    if (!user) {
      alert("Debes iniciar sesion para recargar");
      return;
    }

    const token = await user.getIdToken();
    const res = await fetch("/api/wompi/checkout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amountInCents: selectedRechargeAmount * 100,
      }),
    });
    const data = await res.json();

    if (data.url) window.location.href = data.url;
    else alert(data.error || "Error generando el pago");
  };

  const handleWithdraw = async () => {
    setBalanceMessage("");

    if (!user) {
      setBalanceMessage("Debes iniciar sesion para retirar");
      return;
    }

    if (!isProvider) {
      setBalanceMessage("Solo las escorts pueden retirar saldo");
      return;
    }

    if (!withdrawalValue || withdrawalValue < minWithdrawalAmount) {
      setBalanceMessage(
        `El retiro minimo es $${minWithdrawalAmount.toLocaleString("es-CO")}`
      );
      return;
    }

    if (withdrawalValue > balance) {
      setBalanceMessage("No tienes saldo suficiente para este retiro");
      return;
    }

    if (
      !withdrawalHolder.trim() ||
      !withdrawalMethod.trim() ||
      !withdrawalAccount.trim() ||
      !withdrawalAccountType.trim()
    ) {
      setBalanceMessage("Completa los datos para enviar el retiro");
      return;
    }

    setBalanceSubmitting(true);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: withdrawalValue,
          accountHolder: withdrawalHolder,
          payoutMethod: withdrawalMethod,
          payoutAccount: withdrawalAccount,
          payoutAccountType: withdrawalAccountType,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setBalanceMessage(data.error || "No pudimos crear el retiro");
        return;
      }

      setBalanceMessage(
        `Retiro solicitado. Recibiras $${Number(
          data.releasedAmount || 0
        ).toLocaleString("es-CO")} despues de comision.`
      );
      setWithdrawalAmount("");
      setWithdrawalHolder("");
      setWithdrawalMethod("");
      setWithdrawalAccount("");
      setWithdrawalAccountType("");
    } catch {
      setBalanceMessage("No pudimos crear el retiro. Intentalo de nuevo.");
    } finally {
      setBalanceSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-black/95 shadow-sm backdrop-blur"
        suppressHydrationWarning
      >
        <div className="w-full px-3 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-3">
            <Link
              href="/prestadores"
              className="flex min-w-0 items-center gap-2"
            >
              <Image
                src="/logofinal.svg"
                alt="BelaClub"
                width={36}
                height={36}
                className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
                priority
                suppressHydrationWarning
              />
              <span className="hidden truncate text-lg font-bold text-white min-[360px]:inline sm:text-xl">
                BelaClub
              </span>
            </Link>
            <div className="h-8 w-28 rounded-full border border-white/[0.08] bg-white/[0.03]" />
          </div>
        </div>
      </header>
    );
  }

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-black/95 shadow-sm backdrop-blur"
        suppressHydrationWarning
      >
        <div className="w-full px-3 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-3">
            <Link
              href="/prestadores"
              className="flex min-w-0 items-center gap-2"
            >
              <Image
                src="/logofinal.svg"
                alt="BelaClub"
                width={36}
                height={36}
                className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
                priority
                suppressHydrationWarning
              />
              <span className="hidden truncate text-lg font-bold text-white min-[360px]:inline sm:text-xl">
                BelaClub
              </span>
            </Link>

            {!user && (
              <div className="flex shrink-0 items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1 shadow-lg shadow-black/20 sm:gap-2">
                <Link
                  href="/login"
                  className="rounded-full px-3 py-2 text-xs font-semibold text-neutral-200 transition hover:bg-white/[0.07] hover:text-white sm:px-4 sm:text-sm"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="rounded-full border border-blue-400/25 bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-950/25 transition hover:bg-blue-500 sm:px-4 sm:text-sm"
                >
                  Registrarse
                </Link>
              </div>
            )}

            {user && (
              <div className="relative flex shrink-0 items-center gap-1 sm:gap-4">
                {providerCanPostDailyVideo && (
                  <Link
                    href="/prestador/perfil#video-del-dia"
                    aria-label="Subir video del dia"
                    title="Video del dia"
                    className="relative flex h-8 w-8 items-center justify-center rounded-full border border-sky-300/30 bg-sky-400/12 text-sky-100 shadow-lg shadow-sky-950/25 transition hover:-translate-y-0.5 hover:border-sky-200/50 hover:bg-sky-400/20 hover:text-white min-[380px]:h-9 min-[380px]:w-9"
                  >
                    <span className="absolute inset-0 rounded-full bg-sky-300/10 blur-[6px]" />
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      className="relative h-4.5 w-4.5"
                      fill="currentColor"
                    >
                      <path d="M8 5.2v13.6L18.8 12 8 5.2Z" />
                    </svg>
                  </Link>
                )}

                <div className="relative" ref={notificationRef}>
                  <button
                    className={`relative flex h-8 w-8 items-center justify-center rounded-full border shadow-lg transition min-[380px]:h-9 min-[380px]:w-9 ${
                      unreadCount > 0
                        ? "border-amber-300/35 bg-amber-300/12 text-amber-200 shadow-amber-950/25 hover:border-amber-300/55 hover:bg-amber-300/18 hover:text-amber-100"
                        : "border-white/10 bg-white/[0.04] text-amber-300/80 shadow-black/20 hover:border-amber-300/25 hover:bg-amber-300/10 hover:text-amber-200"
                    }`}
                    aria-label="Abrir notificaciones"
                    onClick={async () => {
                      setShowNotifications((value) => !value);

                      if (unreadCount > 0) {
                        const token = await user.getIdToken();
                        await fetch("/api/notifications/mark-read", {
                          method: "POST",
                          headers: {
                            Authorization: `Bearer ${token}`,
                            "Content-Type": "application/json",
                          },
                        });
                      }
                    }}
                  >
                    {unreadCount > 0 && (
                      <span className="absolute inset-0 rounded-full bg-amber-300/15 blur-[6px]" />
                    )}
                    <svg
                      viewBox="0 0 24 24"
                      className="relative h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border border-black bg-gradient-to-b from-amber-300 to-amber-500 px-1 text-[10px] font-bold text-black shadow-md shadow-amber-950/40">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-[-88px] z-50 mt-3 w-[calc(100vw-24px)] max-w-sm overflow-hidden rounded-xl border border-white/10 bg-zinc-950 text-white shadow-2xl shadow-black/50 sm:right-0 sm:w-80">
                      <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] p-4">
                        <div>
                          <p className="text-sm font-semibold">
                            Notificaciones
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {unreadCount > 0
                              ? `${unreadCount} nueva${
                                  unreadCount === 1 ? "" : "s"
                                }`
                              : "Todo al dia"}
                          </p>
                        </div>
                        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/20 bg-amber-300/10 text-amber-200">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
                            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                          </svg>
                        </span>
                      </div>
                      {notifications.length === 0 ? (
                        <p className="p-4 text-center text-sm text-zinc-500">
                          No tienes notificaciones
                        </p>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`border-b border-white/10 p-4 text-sm last:border-b-0 ${
                              !notification.read
                                ? "bg-amber-300/[0.06]"
                                : "bg-transparent"
                            }`}
                          >
                            <div className="flex gap-3">
                              <span
                                className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                  !notification.read
                                    ? "bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.5)]"
                                    : "bg-white/15"
                                }`}
                              />
                              <div className="min-w-0">
                                <p className="font-medium leading-5 text-zinc-100">
                                  {notification.message}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  {notification.createdAt
                                    ?.toDate?.()
                                    .toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    resetBalanceModal();
                    setBalanceMode("recharge");
                    setModalOpen(true);
                  }}
                  className="whitespace-nowrap rounded-md bg-green-500 px-2 py-1 text-[11px] font-semibold text-white shadow-lg shadow-emerald-950/20 transition hover:bg-green-400 min-[380px]:text-xs sm:px-3 sm:text-sm"
                >
                  ${balance.toLocaleString("es-CO")}
                </button>

                <div className="relative" ref={profileRef}>
                  <button
                    type="button"
                    onClick={() => setShowProfileMenu((value) => !value)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-neutral-300 shadow-lg shadow-black/20 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white min-[380px]:h-9 min-[380px]:w-9"
                    aria-label="Abrir menu de perfil"
                  >
                    <svg
                      viewBox="0 0 22 22"
                      className="h-5 w-5"
                      fill="currentColor"
                    >
                      <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z" />
                    </svg>
                  </button>

                  {showProfileMenu && (
                    <div className="absolute right-0 z-50 mt-3 w-52 overflow-hidden rounded-lg border border-white/10 bg-[#101012] p-1 text-white shadow-2xl shadow-black/40">
                      {isOwner && (
                        <Link
                          href="/admin/verificaciones"
                          onClick={() => setShowProfileMenu(false)}
                          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-amber-100 transition hover:bg-amber-400/10 hover:text-amber-50"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/10 text-amber-200">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M12 3 4 6v6c0 5 3.4 8.7 8 9 4.6-.3 8-4 8-9V6l-8-3Z" />
                              <path d="M9 12l2 2 4-5" />
                            </svg>
                          </span>
                          Panel admin
                        </Link>
                      )}

                      <Link
                        href={
                          role === "prestador"
                            ? "/prestador/perfil"
                            : "/usuario/perfil"
                        }
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-neutral-200 transition hover:bg-white/[0.07] hover:text-white"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-neutral-300">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M20 21a8 8 0 0 0-16 0" />
                            <circle cx="12" cy="7" r="4" />
                          </svg>
                        </span>
                        Mi perfil
                      </Link>

                      {isProvider && (
                        <Link
                          href="/prestador/dinero"
                          onClick={() => setShowProfileMenu(false)}
                          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-emerald-100 transition hover:bg-emerald-400/10 hover:text-emerald-50"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-200">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 12V8H6a2 2 0 0 1 0-4h12v4" />
                              <path d="M4 6v12a2 2 0 0 0 2 2h14v-4" />
                              <path d="M18 12h.01" />
                            </svg>
                          </span>
                          Mi dinero
                        </Link>
                      )}

                      {isProvider && (
                        <a
                          href={supportHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowProfileMenu(false)}
                          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sky-100 transition hover:bg-sky-400/10 hover:text-sky-50"
                        >
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-400/10 text-sky-200">
                            <svg
                              viewBox="0 0 24 24"
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                              <path d="M9 9h6" />
                              <path d="M9 13h4" />
                            </svg>
                          </span>
                          Ayuda
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setShowProfileMenu(false);
                          void handleLogout();
                        }}
                        className="mt-1 flex w-full items-center gap-3 rounded-md border-t border-white/[0.06] px-3 py-2.5 text-left text-sm font-medium text-neutral-300 transition hover:bg-rose-500/10 hover:text-rose-100"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.05] text-neutral-300">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <path d="M16 17l5-5-5-5" />
                            <path d="M21 12H9" />
                          </svg>
                        </span>
                        Salir
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={closeBalanceModal}
        >
          <div
            className="max-h-[calc(100vh-32px)] w-full max-w-md overflow-y-auto rounded-xl border border-white/10 bg-zinc-950 text-white shadow-2xl shadow-black/50"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-white/10 p-5 sm:p-6">
              <p className="text-sm font-medium text-zinc-400">
                Tu saldo actual
              </p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <p className="text-2xl font-semibold sm:text-3xl">
                  ${balance.toLocaleString("es-CO")}
                </p>
                <p className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  COP
                </p>
              </div>

              {isProvider && (
                <div className="mt-5 grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-black/30 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setBalanceMode("recharge");
                      setBalanceMessage("");
                    }}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      balanceMode === "recharge"
                        ? "bg-emerald-500 text-white"
                        : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    Recargar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBalanceMode("withdraw");
                      setBalanceMessage("");
                    }}
                    className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                      balanceMode === "withdraw"
                        ? "bg-blue-600 text-white"
                        : "text-zinc-400 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    Retirar
                  </button>
                </div>
              )}

              {balanceMode === "recharge" ? (
                <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs text-zinc-500">Monto a recargar</p>
                  <p className="mt-1 text-xl font-semibold text-emerald-300 sm:text-2xl">
                    {selectedRechargeAmount
                      ? `$${selectedRechargeAmount.toLocaleString("es-CO")}`
                      : "Selecciona una opcion"}
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-blue-400/20 bg-blue-400/10 p-4">
                  <p className="text-xs text-blue-100/70">
                    Retiro por Wompi con comision BelaClub del 5%
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-md bg-black/25 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                        Retiras
                      </p>
                      <p className="mt-1 text-xs font-semibold text-white">
                        ${withdrawalValue.toLocaleString("es-CO")}
                      </p>
                    </div>
                    <div className="rounded-md bg-black/25 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                        5%
                      </p>
                      <p className="mt-1 text-xs font-semibold text-rose-200">
                        ${withdrawalCommission.toLocaleString("es-CO")}
                      </p>
                    </div>
                    <div className="rounded-md bg-black/25 p-2">
                      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                        Recibes
                      </p>
                      <p className="mt-1 text-xs font-semibold text-emerald-300">
                        ${withdrawalReleased.toLocaleString("es-CO")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-5 sm:p-6">
              {balanceMode === "recharge" ? (
                <>
                  <p className="mb-3 text-sm font-medium text-zinc-300">
                    Elige un paquete
                  </p>
                  <div className="mb-5 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
                    {rechargeOptions.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setSelectedRechargeAmount(amount)}
                        className={`rounded-lg border px-3 py-4 text-center transition ${
                          selectedRechargeAmount === amount
                            ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200 shadow-lg shadow-emerald-950/20"
                            : "border-white/10 bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07]"
                        }`}
                      >
                        <span className="block text-sm font-semibold">
                          ${amount.toLocaleString("es-CO")}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleRecharge}
                    disabled={!selectedRechargeAmount}
                    className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Recargar saldo
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-xs font-medium text-zinc-400">
                        Monto a retirar
                      </span>
                      <input
                        value={withdrawalAmount}
                        onChange={(event) =>
                          setWithdrawalAmount(
                            event.target.value.replace(/\D/g, "")
                          )
                        }
                        inputMode="numeric"
                        placeholder="Ej: 100000"
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-medium text-zinc-400">
                        Titular de la cuenta
                      </span>
                      <input
                        value={withdrawalHolder}
                        onChange={(event) =>
                          setWithdrawalHolder(event.target.value)
                        }
                        placeholder="Nombre completo"
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                      />
                    </label>

                    <div className="grid gap-3 min-[420px]:grid-cols-2">
                      <label className="block">
                        <span className="text-xs font-medium text-zinc-400">
                          Metodo de pago
                        </span>
                        <select
                          value={withdrawalMethod}
                          onChange={(event) =>
                            setWithdrawalMethod(event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="">Selecciona</option>
                          {payoutMethods.map((method) => (
                            <option key={method.value} value={method.value}>
                              {method.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-xs font-medium text-zinc-400">
                          Numero de cuenta o celular
                        </span>
                        <input
                          value={withdrawalAccount}
                          onChange={(event) =>
                            setWithdrawalAccount(
                              event.target.value.replace(/\D/g, "")
                            )
                          }
                          inputMode="numeric"
                          placeholder="Solo numeros"
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                        />
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-xs font-medium text-zinc-400">
                        Tipo de cuenta
                      </span>
                      <select
                        value={withdrawalAccountType}
                        onChange={(event) =>
                          setWithdrawalAccountType(event.target.value)
                        }
                        className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="">Selecciona</option>
                        {accountTypes.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {balanceMessage && (
                    <p className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3 text-sm text-zinc-200">
                      {balanceMessage}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={handleWithdraw}
                    disabled={balanceSubmitting}
                    className="mt-5 w-full rounded-lg bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {balanceSubmitting ? "Procesando..." : "Solicitar retiro"}
                  </button>
                </>
              )}

              <button
                type="button"
                onClick={closeBalanceModal}
                className="mt-3 w-full rounded-lg border border-white/10 bg-white/[0.03] py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.07]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
