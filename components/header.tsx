"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { logoutUser } from "@/lib/auth";

import { useState, useEffect, useRef } from "react";
import {
  getFirestore,
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { app } from "@/lib/firebase";

const rechargeOptions = [100000, 200000, 500000];

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

  const [role, setRole] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRechargeAmount, setSelectedRechargeAmount] = useState<
    number | null
  >(null);

  const notificationRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (notificationRef.current && !notificationRef.current.contains(target))
        setShowNotifications(false);

      if (profileRef.current && !profileRef.current.contains(target))
        setShowProfileMenu(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;

    const ref = doc(db, "users", user.uid);

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRole(data.role || null);
        setBalance(data.balance || 0);
      }
    });

    return () => unsubscribe();
  }, [user, db]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as NotificationItem[];
      setNotifications(data);
    });

    return () => unsubscribe();
  }, [user, db]);

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

    const amountInCents = selectedRechargeAmount * 100;
    const token = await user.getIdToken();

    const res = await fetch("/api/wompi/checkout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amountInCents,
      }),
    });

    const data = await res.json();

    if (data.url) window.location.href = data.url;
    else alert("Error generando el pago");
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-black/95 shadow-sm backdrop-blur">
        <div className="w-full px-3 sm:px-6">
          <div className="flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-3">

            {/* LOGO */}
            <Link href="/prestadores" className="flex min-w-0 items-center gap-2">
              <Image
                src="/logofinal.svg"
                alt="logo"
                width={36}
                height={36}
                className="h-8 w-8 shrink-0 sm:h-9 sm:w-9"
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

                {/* NOTIFICACIONES */}
                <div className="relative" ref={notificationRef}>
                  <button
                    className="relative flex h-8 w-8 items-center justify-center rounded-full text-sm transition hover:bg-white/[0.06] min-[380px]:h-9 min-[380px]:w-9 sm:text-lg"
                    onClick={async () => {
                      setShowNotifications((v) => !v);

                      if (unreadCount > 0 && user) {
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
                    🔔
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-[-88px] z-50 mt-2 w-[calc(100vw-24px)] max-w-sm rounded-lg border border-white/10 bg-zinc-950 text-white shadow-2xl shadow-black/50 sm:right-0 sm:w-80">
                      <div className="border-b border-white/10 p-3 font-semibold">
                        Notificaciones
                      </div>

                      {notifications.length === 0 ? (
                        <p className="p-4 text-sm text-zinc-500 text-center">
                          No tienes notificaciones
                        </p>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className={`border-b border-white/10 p-3 text-sm last:border-b-0 ${
                              !n.read
                                ? "bg-white/[0.06]"
                                : ""
                            }`}
                          >
                            <p className="font-medium">{n.message}</p>
                            <p className="text-xs text-zinc-500 mt-1">
                              {n.createdAt?.toDate?.().toLocaleString()}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* SALDO */}
                <span
                  onClick={() => {
                    setSelectedRechargeAmount(null);
                    setModalOpen(true);
                  }}
                  className="cursor-pointer whitespace-nowrap rounded-md bg-green-500 px-2 py-1 text-[11px] font-semibold text-white shadow-lg shadow-emerald-950/20 min-[380px]:text-xs sm:px-3 sm:text-sm"
                >
                  ${balance.toLocaleString()}
                </span>

                {/* PERFIL */}
                <div className="relative" ref={profileRef}>
                  <button
                    onClick={() => setShowProfileMenu((v) => !v)}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-neutral-300 shadow-lg shadow-black/20 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white min-[380px]:h-9 min-[380px]:w-9"
                    aria-label="Abrir menu de perfil"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                      viewBox="0 0 22 22"
                      className="h-5 w-5"
                    >
                      <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/>
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

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          handleLogout();
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
          className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
          onClick={() => {
            setSelectedRechargeAmount(null);
            setModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl border border-white/10 bg-zinc-950 text-white shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 p-5 sm:p-6">
              <p className="text-sm font-medium text-zinc-400">Tu saldo actual</p>

              <div className="mt-2 flex items-end justify-between gap-4">
                <p className="text-2xl font-semibold sm:text-3xl">
                  ${balance.toLocaleString("es-CO")}
                </p>
                <p className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                  COP
                </p>
              </div>

              <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-zinc-500">Monto a recargar</p>
                <p className="mt-1 text-xl font-semibold text-emerald-300 sm:text-2xl">
                  {selectedRechargeAmount
                    ? `$${selectedRechargeAmount.toLocaleString("es-CO")}`
                    : "Selecciona una opción"}
                </p>
              </div>
            </div>

            <div className="p-5 sm:p-6">
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
              onClick={handleRecharge}
              disabled={!selectedRechargeAmount}
                className="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Recargar saldo
            </button>

            <button
              onClick={() => {
                setSelectedRechargeAmount(null);
                setModalOpen(false);
              }}
                className="w-full mt-3 rounded-lg border border-white/10 bg-white/[0.03] py-3 text-sm font-semibold text-zinc-300 transition hover:bg-white/[0.07]"
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
