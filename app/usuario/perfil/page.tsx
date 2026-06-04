"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "@/components/header";

import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { app } from "@/lib/firebase";
import Image from "next/image";

export default function PerfilUsuario() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const db = getFirestore(app);

  const [name, setName] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // 🔐 Redirigir si no hay login
  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // 📥 Cargar datos del usuario
  useEffect(() => {
    const load = async () => {
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const data = snap.data();
        setName(data.name || "");
        setPhotoUrl(data.photoUrl || null);
      }
    };

    load();
  }, [user, db]);

  // 📸 Subir foto de perfil
  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload-profile-photo", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
      },
      body: formData,
    });

    const data = await res.json();
    setUploading(false);

    if (data.url) {
      setPhotoUrl(data.url);
      await setDoc(
        doc(db, "users", user.uid),
        { photoUrl: data.url },
        { merge: true }
      );
    }
  };

  // 💾 Guardar cambios
  const save = async () => {
    if (!user) return;

    setSaving(true);

    await setDoc(
      doc(db, "users", user.uid),
      { name },
      { merge: true }
    );

    setSaving(false);
    setEditMode(false);
  };

  if (loading) return <p className="p-6">Cargando...</p>;

  return (
    <div className="min-h-screen bg-[#050505] pt-14 text-white sm:pt-16">
      <Header />

      <div className="max-w-md mx-auto mt-12 p-8 bg-neutral-950 rounded-2xl shadow-lg">
        <h1 className="text-xl font-semibold text-center mb-8">
          Mi perfil
        </h1>

        {/* FOTO */}
        <div className="relative w-40 h-40 mx-auto">
          <Image
            src={photoUrl || "/default-avatar.png"}
            alt="perfil"
            fill
            className="rounded-full object-cover border border-neutral-700"
            priority
          />

          {editMode && (
            <label className="absolute bottom-2 right-2 bg-black/70 p-2 rounded-full cursor-pointer hover:bg-black transition">
              ✏️
              <input
                type="file"
                onChange={handleUploadPhoto}
                hidden
              />
            </label>
          )}
        </div>

        {uploading && (
          <p className="text-sm text-blue-400 mt-3 text-center">
            Subiendo foto…
          </p>
        )}

        {/* NOMBRE */}
        <div className="mt-6 text-center">
          {editMode ? (
            <input
              className="w-full bg-transparent border-b border-neutral-600 focus:outline-none text-xl text-center"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
            />
          ) : (
            <h2 className="text-2xl font-semibold">
              {name || "Sin nombre"}
            </h2>
          )}
        </div>

        {/* PUNTUACIÓN */}
        <div className="mt-2 text-center text-sm text-neutral-400">
          ⭐ 4.8 · 120 valoraciones
        </div>

        {/* BOTÓN */}
        {editMode ? (
          <button
            onClick={save}
            className="mt-8 w-full py-3 bg-blue-600 hover:bg-blue-700 transition rounded-lg"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="mt-8 w-full py-3 border border-neutral-700 rounded-lg hover:bg-neutral-900 transition"
          >
            Editar perfil
          </button>
        )}
      </div>
    </div>
  );
}
