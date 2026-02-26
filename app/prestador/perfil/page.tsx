"use client";

import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";

import { useAuth } from "@/context/AuthContext";
import { app } from "@/lib/firebase";
import Image from "next/image";
import Header from "@/components/header";
import { colombia } from "@/lib/colombia";

export default function PerfilPrestador() {
  const { user } = useAuth();
  const db = getFirestore(app);

  const [editMode, setEditMode] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [department, setDepartment] = useState("");
  const [city, setCity] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [media, setMedia] = useState<any[]>([]);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  // ⭐ Rating placeholder
  const rating = 4.9;
  const reviews = 128;

  // ===== Media ampliada =====
  const [expandedMedia, setExpandedMedia] = useState<any | null>(null);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ===== Modal precio contenido privado =====
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [contentPrice, setContentPrice] = useState("");

  // ============================
  // Bloquear scroll fondo
  // ============================
  useEffect(() => {
    document.body.style.overflow = expandedMedia || showPriceModal ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [expandedMedia, showPriceModal]);

  // ============================
  // Navegación con teclado
  // ============================
  useEffect(() => {
    if (!expandedMedia || mediaList.length === 0) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setCurrentIndex((i) => (i + 1) % mediaList.length);
      }
      if (e.key === "ArrowLeft") {
        setCurrentIndex((i) => (i === 0 ? mediaList.length - 1 : i - 1));
      }
      if (e.key === "Escape") {
        setExpandedMedia(null);
      }
    };


    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [expandedMedia, mediaList]);

  // ============================
  // Cargar datos
  // ============================
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        const d = snap.data();
        setName(d.name || "");
        setDescription(d.description || "");
        setPrice(d.price || "");
        setDepartment(d.department || "");
        setCity(d.city || "");
        setPhotoUrl(d.photoUrl || "");
        setMedia(d.media || []);

        setMediaList([
          { type: "photo", url: d.photoUrl || "/default-avatar.png" },
          ...(d.media || []),
        ]);
      }
    };

    loadData();
  }, [user, db]);

  // ============================
  // Guardar perfil
  // ============================
  const saveProfile = async () => {
    if (!user) return;

    setSaving(true);

    await setDoc(
      doc(db, "users", user.uid),
      { name, description, price, department, city },
      { merge: true }
    );

    setSaving(false);
    setEditMode(false);
    setMessage("Perfil actualizado ✔");
    setTimeout(() => setMessage(""), 2500);
  };

  // ============================
  // Cambiar foto de perfil
  // ============================
  const uploadProfilePhoto = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload-profile-photo", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!data.url) return;

    setPhotoUrl(data.url);

    const updatedMediaList = [
      { type: "photo", url: data.url },
      ...media,
    ];
    setMediaList(updatedMediaList);

    await setDoc(
      doc(db, "users", user.uid),
      { photoUrl: data.url },
      { merge: true }
    );
  };

  // ============================
  // Eliminar media
  // ============================
  const deleteMedia = async (index: number) => {
    if (!user) return;

    const updated = media.filter((_, i) => i !== index);
    setMedia(updated);

    setMediaList([
      { type: "photo", url: photoUrl || "/default-avatar.png" },
      ...updated,
    ]);

    await setDoc(
      doc(db, "users", user.uid),
      { media: updated },
      { merge: true }
    );
  };

  // ============================
  // Subir media (final)
  // ============================
  const uploadMedia = async (
    file: File,
    isPrivate: boolean,
    forcedPrice?: number
  ) => {
    if (!user) return;

    const type = file.type.startsWith("video") ? "video" : "photo";

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/upload-profile-photo", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    if (!data.url) return;

    const newItem = {
      type,
      url: data.url,
      private: isPrivate,
      price: isPrivate ? forcedPrice : null,
    };

    const updated = [...media, newItem];
    setMedia(updated);

    setMediaList([
      { type: "photo", url: photoUrl || "/default-avatar.png" },
      ...updated,
    ]);

    await setDoc(
      doc(db, "users", user.uid),
      { media: updated },
      { merge: true }
    );
  };

  const openExpanded = (index: number) => {
    setCurrentIndex(index);
    setExpandedMedia(mediaList[index]);
  };

  const formatCOP = (value: number) => {
  return value.toLocaleString("es-CO");
};

  return (
    <div className="min-h-screen bg-black text-white">
      <Header />

      <div className="max-w-4xl mx-auto p-6 pt-10">
        {/* ===== HEADER ===== */}
        <div className="bg-neutral-950 rounded-2xl p-8 mb-10">
          <div className="flex gap-6 items-start">
            <div
              className="relative w-40 h-40 rounded-full overflow-hidden border-2 border-green-600 cursor-pointer"
              onClick={() => openExpanded(0)}
            >
              <Image src={photoUrl || "/default-avatar.png"} alt="perfil" fill className="object-cover" />

              {editMode && (
                <label className="absolute bottom-2 right-2 bg-black/70 p-2 rounded-full cursor-pointer">
                  ✏️
                  <input type="file" hidden onChange={uploadProfilePhoto} />
                </label>
              )}
            </div>

            <div className="flex-1">
            {editMode ? (
  <input
    value={name}
    onChange={(e) => setName(e.target.value)}
    className="text-3xl font-bold bg-transparent border-b
               border-zinc-600 focus:outline-none focus:border-green-500"
  />
) : (
  <h1 className="text-3xl font-bold">{name}</h1>
)}

<button
  onClick={() => setEditMode((prev) => !prev)}
  className="mt-2 inline-block text-sm px-4 py-1.5 rounded-md
             bg-zinc-800 hover:bg-zinc-700 transition"
>
  {editMode ? "Cancelar edición" : "Editar perfil"}
</button>

{editMode && (
  <button
    onClick={saveProfile}
    disabled={saving}
    className="mt-4 px-5 py-2 bg-green-600
               hover:bg-green-700 rounded-md font-semibold"
  >
    {saving ? "Guardando..." : "Guardar cambios"}
  </button>
)}





              <div className="text-sm text-zinc-400 mt-1">
                ⭐ {rating} · {reviews} valoraciones · 👑 Platinum
              </div>
              <p className="text-sm text-zinc-400 mt-1">
                {city && department && `${city}, ${department}`}
              </p>
           {editMode ? (
<div className="mt-2">
  <label className="text-sm text-zinc-400 block mb-1">
    Precio por hora
  </label>

  <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-lg px-3 focus-within:border-green-500">
    <span className="text-zinc-400 mr-2">$</span>

    <input
      type="number"
      min={0}
      step={10000}
      value={price}
      onChange={(e) => setPrice(e.target.value)}
      placeholder="50.000"
      className="w-full bg-transparent py-2 text-white focus:outline-none"
    />

    <span className="text-zinc-500 ml-2">COP</span>
  </div>

  {price && (
    <p className="text-xs text-zinc-400 mt-1">
      {Number(price).toLocaleString("es-CO")} COP por hora
    </p>
  )}
</div>

) : (
  price && (
    <p className="text-green-500 font-semibold mt-2 flex items-center gap-1">
      💰 ${Number(price).toLocaleString("es-CO")}
    </p>
  )
)}

              {editMode ? (
  <textarea
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    rows={4}
    placeholder="Describe tu perfil…"
    className="mt-4 w-full max-w-2xl p-3 text-sm
               bg-zinc-900 border border-zinc-700 rounded
               focus:outline-none focus:border-green-500"
  />
) : (
  description && (
    <p className="mt-4 text-zinc-300 text-sm max-w-2xl">
      {description}
    </p>
  )
)}

            </div>
          </div>
        </div>

        {/* ===== GALERÍA ===== */}
        <h2 className="text-xl font-semibold mb-4">Galería</h2>

        <div className="flex gap-4 mb-4">
          <label className="cursor-pointer bg-zinc-800 px-4 py-2 rounded">
            Subir público
            <input
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadMedia(file, false);
              }}
            />
          </label>

          <label className="cursor-pointer bg-red-700 px-4 py-2 rounded">
            Subir privado 🔒
            <input
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setPendingFile(file);
                setShowPriceModal(true);
              }}
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {media.map((item, i) => (
            <div key={i} className="relative w-full pb-[100%]">
              <div onClick={() => openExpanded(i + 1)} className="cursor-pointer">
                {item.type === "photo" ? (
                  <Image src={item.url} alt="" fill className="object-cover rounded" />
                ) : (
                  <video src={item.url} muted className="absolute inset-0 w-full h-full object-cover rounded" />
                )}
              </div>

              {editMode && (
                <button
                  onClick={() => deleteMedia(i)}
                  className="absolute top-1 right-1 bg-black/70 text-white rounded-full px-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ===== MODAL PRECIO ===== */}
      {showPriceModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4">
          <div className="bg-zinc-900 rounded-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold mb-4">
              Precio del contenido privado
            </h3>

            <input
              type="number"
              min="1"
              placeholder="Ej: 15000"
              className="w-full p-3 bg-zinc-800 border border-zinc-700 rounded mb-4"
              value={contentPrice}
              onChange={(e) => setContentPrice(e.target.value)}
            />

            <div className="flex gap-2">
              <button
                className="flex-1 py-2 bg-zinc-700 rounded"
                onClick={() => {
                  setShowPriceModal(false);
                  setPendingFile(null);
                  setContentPrice("");
                }}
              >
                Cancelar
              </button>

              <button
                className="flex-1 py-2 bg-blue-600 rounded font-semibold"
                onClick={async () => {
                  if (!pendingFile) return;

                  const priceNum = Number(contentPrice);
                  if (!priceNum || priceNum <= 0) {
                    alert("Ingresa un precio válido");
                    return;
                  }

                  await uploadMedia(pendingFile, true, priceNum);

                  setShowPriceModal(false);
                  setPendingFile(null);
                  setContentPrice("");
                }}
              >
                Subir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MEDIA AMPLIADA ===== */}
      {expandedMedia && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4" onClick={() => setExpandedMedia(null)}>
          <div className="max-w-3xl w-full max-h-[90vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {mediaList[currentIndex].type === "photo" ? (
              <Image src={mediaList[currentIndex].url} alt="" width={1200} height={1200} className="max-h-[90vh] w-auto rounded-lg object-contain" />
            ) : (
              <video src={mediaList[currentIndex].url} controls autoPlay className="w-full rounded-lg" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
