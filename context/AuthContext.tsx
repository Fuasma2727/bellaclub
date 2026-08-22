"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { User } from "firebase/auth";

// 1️⃣ Crear el contexto
const AuthContext = createContext<{ user: User | null; loading: boolean }>({
  user: null,
  loading: true,
});

// 2️⃣ Crear proveedor del contexto
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void Promise.all([import("firebase/auth"), import("@/lib/firebaseApp")])
      .then(([{ getAuth, onAuthStateChanged }, { app }]) => {
        if (cancelled) return;

        unsubscribe = onAuthStateChanged(getAuth(app), (currentUser) => {
          setUser(currentUser);
          setLoading(false);
        });
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Error loading Firebase Auth:", error);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// 3️⃣ Hook para usarlo fácilmente
export const useAuth = () => useContext(AuthContext);
