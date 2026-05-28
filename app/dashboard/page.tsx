"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutUser } from "@/lib/auth";

import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "@/lib/firebase";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const db = getFirestore(app);

  const [role, setRole] = useState<string | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  // 🔥 1. Redirigir si no hay usuario
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // 🔥 2. Obtener el rol desde Firestore
  useEffect(() => {
    const fetchRole = async () => {
      if (user) {
        const ref = doc(db, "users", user.uid);
        const snap = await getDoc(ref);

        if (snap.exists()) {
          setRole(snap.data().role);
        }
        setLoadingRole(false);
      }
    };

    fetchRole();
  }, [user, db]);

  // Mientras verifica sesión
  if (loading || loadingRole) {
    return <p>Cargando...</p>;
  }

  // Mientras redirige
  if (!user) return null;

  const handleLogout = async () => {
    await logoutUser();
    router.push("/login");
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Dashboard</h1>
      <p>Bienvenido, {user.email}</p>

      <p><strong>Rol:</strong> {role}</p>

      {/* 🔥 Mostrar contenido distinto según el rol */}
      {role === "prestador" && (
        <div>
          <h2>Panel de Escort</h2>
          <p>Aquí podrás subir fotos, videos, poner precios y cambiar disponibilidad.</p>
        </div>
      )}

      {role === "cliente" && (
        <div>
          <h2>Panel de Cliente</h2>
          <p>Aqui podras ver perfiles de escorts y comprar contenido.</p>
        </div>
      )}

      <button
        onClick={handleLogout}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          backgroundColor: "red",
          color: "white",
          border: "none",
          cursor: "pointer"
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
