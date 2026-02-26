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

export default function Header() {
  const { user } = useAuth();

  useEffect(() => {
    console.log("🔥 USER DESDE AUTH:", user);
  }, [user]);

  const db = getFirestore(app);

  const [role, setRole] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [modalOpen, setModalOpen] = useState(false);

  const notificationRef = useRef<HTMLDivElement>(null);
const profileRef = useRef<HTMLDivElement>(null);
  // 🧠 AUTH READY (NUEVO)
  const [authReady, setAuthReady] = useState(false);

  // 🔔 Notificaciones
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  // 👤 Perfil dropdown
const [showProfileMenu, setShowProfileMenu] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // ==========================
  // 🧠 Detectar cuando Auth ya está listo (NUEVO)
  // ==========================
  useEffect(() => {
    if (user) {
      setAuthReady(true);
    }
  }, [user]);



  useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as Node;

    if (
      notificationRef.current &&
      !notificationRef.current.contains(target)
    ) {
      setShowNotifications(false);
    }

    if (
      profileRef.current &&
      !profileRef.current.contains(target)
    ) {
      setShowProfileMenu(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);

  // ==========================
  // 🔥 ESCUCHAR USUARIO (ROL + SALDO)
  // ==========================
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

  // ==========================
  // 🔔 ESCUCHAR NOTIFICACIONES (FIX REAL)
  // ==========================
  useEffect(() => {
    if (!authReady || !user) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));
      setNotifications(data);
      console.log("🔔 NOTIFICACIONES:", data);
    });

    return () => unsubscribe();
  }, [authReady, user, db]);

  // ==========================
  // LOGOUT
  // ==========================
  const handleLogout = async () => {
    await logoutUser();
    window.location.href = "/prestadores";
  };

  // ==========================
  // RECARGA CON WOMPI
  // ==========================
  const handleRecharge = async () => {
    const input = document.getElementById(
      "rechargeAmount"
    ) as HTMLInputElement;

    const amount = Number(input.value);

    if (!amount || amount < 1000) {
      alert("Ingresa un monto válido (mínimo $1.000)");
      return;
    }

    const amountInCents = amount * 100;

    const res = await fetch("/api/wompi/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountInCents,
        userId: user?.uid,
      }),
    });

    const data = await res.json();

    if (data.url) {
      window.location.href = data.url;
    } else {
      alert("Error generando el pago");
    }
  };

  return (
    <>
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-40 bg-white dark:bg-black border-b border-zinc-300 px-4 py-0 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

          {/* LOGO */}
          <Link href="/prestadores" className="flex items-center gap-2">
            <Image
  src="/logofinal.svg"
  alt="logo"
  width={34}
  height={34}
  className="w-7 h-7 md:w-9 md:h-9"
/>

         <span className="text-lg md:text-xl font-bold">
  BelaClub
</span>

          </Link>

          {/* NO USER */}
          {!user && (
            <div className="flex gap-2">
              <Link href="/login" className="px-4 py-1.5 border rounded text-sm">
                Login
              </Link>
              <Link
                href="/register"
                className="px-4 py-1.5 bg-black text-white rounded text-sm"
              >
                Registrarse
              </Link>
            </div>
          )}

          {/* USER */}
          {user && (
            <div className="flex items-center justify-end gap-3 relative ">
              {/* 🔔 CAMPANA */}
              <button
                className="relative p-2 md:p-3 text-1xl md:text-2xl"
                title="Notificaciones"
                onClick={async () => {
  setShowNotifications((v) => !v);

  if (unreadCount > 0 && user) {
    await fetch("/api/notifications/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.uid }),
    });
  }
}}

              >
                🔔
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1
                               bg-red-500 text-white text-[10px]
                               w-4 h-4 flex items-center justify-center
                               rounded-full"
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* 🔽 DROPDOWN NOTIFICACIONES */}
              {showNotifications && (
                <div
                  className="absolute right-0 top-10 w-80
                             bg-white dark:bg-zinc-900
                             border border-zinc-300 dark:border-zinc-700
                             rounded-lg shadow-lg z-50"
                >
                  <div className="p-3 font-semibold border-b">
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
                        className={`p-3 text-sm border-b last:border-b-0
                          ${!n.read ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
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

              {/* SALDO */}
              <span
                onClick={() => setModalOpen(true)}
className="cursor-pointer text-[10px] md:text-sm font-semibold px-2 md:px-3 py-1 bg-green-500 text-white rounded-md whitespace-nowrap"


              >
                Saldo: ${balance.toLocaleString()}
              </span>

              {/* PERFIL */}
            
{/* 👤 PERFIL DROPDOWN */}
<div className="relative">
  <button
    onClick={() => setShowProfileMenu((v) => !v)}
    className="w-6 h-6 flex items-center justify-center"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 22 22"
      className="w-10 h-10 text-red-500 hover:text-black transition"
    >
      <path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v3h20v-3c0-3.3-6.7-5-10-5z"/>
    </svg>
  </button>

  {showProfileMenu && (
    <div
      className="absolute right-0 top-10 w-40
                 bg-white dark:bg-zinc-900
                 border border-zinc-300 dark:border-zinc-700
                 rounded-lg shadow-lg z-50"
    >
      <Link
        href={
          role === "prestador"
            ? "/prestador/perfil"
            : "/usuario/perfil"
        }
        onClick={() => setShowProfileMenu(false)}
        className="block px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        Mi perfil
      </Link>

      <button
        onClick={() => {
          setShowProfileMenu(false);
          handleLogout();
        }}
        className="w-full text-left px-4 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        Salir
      </button>
    </div>
  )}
</div>



       
            </div>
          )}
        </div>
      </header>

      {/* ================= MODAL SALDO ================= */}
      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-zinc-900 p-6 rounded-lg w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Tu saldo</h2>

            <p className="text-2xl font-bold text-green-600 mb-6">
              ${balance.toLocaleString()}
            </p>

            <input
              id="rechargeAmount"
              type="number"
              placeholder="Monto a recargar"
              className="w-full p-2 border rounded mb-4 text-black"
            />

            <button
              onClick={handleRecharge}
              className="w-full py-2 bg-green-500 text-white rounded-lg font-semibold"
            >
              Recargar saldo
            </button>

            <button
              onClick={() => setModalOpen(false)}
              className="w-full mt-3 py-2 bg-zinc-700 text-white rounded-lg"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
