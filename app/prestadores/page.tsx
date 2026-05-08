"use client";

import { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { app } from "@/lib/firebase";
import Image from "next/image";
import Header from "@/components/header";
import { colombia } from "@/lib/colombia";

export default function PrestadoresPage() {
  const { user } = useAuth();
  const router = useRouter();
  const db = getFirestore(app);

  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalData, setModalData] = useState<any | null>(null);
  const [expandedMedia, setExpandedMedia] = useState<any | null>(null);

  const [mediaList, setMediaList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [departmentFilter, setDepartmentFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");

  // ===== ABONAR AL SERVICIO =====
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  // ===== MODAL REQUIERE AUTENTICACIÓN =====
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState(false);

  // 🔑 CONTENIDO COMPRADO POR EL USUARIO
  const [purchasedContent, setPurchasedContent] = useState<any[]>([]);

  // ======================
  // Bloquear scroll fondo
  // ======================
  useEffect(() => {
    const isAnyModalOpen =
      !!modalData ||
      !!expandedMedia ||
      !!showDepositModal ||
      !!showAuthRequiredModal;

    document.body.style.overflow = isAnyModalOpen ? "hidden" : "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [modalData, expandedMedia, showDepositModal, showAuthRequiredModal]);

  // ======================
  // Navegación con teclado
  // ======================
  useEffect(() => {
    if (!expandedMedia || mediaList.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedMedia, mediaList]);

  // ======================
  // Cargar prestadores
  // ======================
  useEffect(() => {
    const fetchPrestadores = async () => {
      const q = query(
        collection(db, "users"),
        where("role", "==", "prestador")
      );

      const snap = await getDocs(q);

      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setPrestadores(data);
      setFiltered(data);
      setLoading(false);
    };

    fetchPrestadores();
  }, [db]);

  // ======================
  // Cargar contenido comprado
  // ======================
  useEffect(() => {
    const loadPurchasedContent = async () => {
      if (!user) return;

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);

      if (snap.exists()) {
        setPurchasedContent(snap.data().purchasedContent || []);
      }
    };

    loadPurchasedContent();
  }, [user, db]);

  // ======================
  // Filtros
  // ======================
  useEffect(() => {
    let results = [...prestadores];

    if (departmentFilter) {
      results = results.filter((p) => p.department === departmentFilter);
    }

    if (cityFilter) {
      results = results.filter((p) => p.city === cityFilter);
    }

    setFiltered(results);
  }, [departmentFilter, cityFilter, prestadores]);

  // ======================
  // Helpers
  // ======================
  const hasPurchased = (mediaUrl: string) => {
    return purchasedContent.some((item) => item.mediaUrl === mediaUrl);
  };

  // ======================
  // Abrir modal
  // ======================
  const openModal = async (id: string) => {
    const ref = doc(db, "users", id);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();

      const allMedia = [
        { type: "photo", url: data.photoUrl || "/default-avatar.png" },
        ...(data.media || []),
      ];

      setModalData({ id, ...data });
      setMediaList(allMedia);
    }
  };

  const openExpandedMedia = (index: number) => {
    setCurrentIndex(index);
    setExpandedMedia(mediaList[index]);
  };

  const closeModal = () => {
    setModalData(null);
    setExpandedMedia(null);
    setShowDepositModal(false);
    setSelectedAmount(null);
  };

  const resetFilters = () => {
    setDepartmentFilter("");
    setCityFilter("");
    setFiltered(prestadores);
  };

  if (loading) {
    return (
      <p className="p-6 text-center text-zinc-400">
        Cargando prestadores…
      </p>
    );
  }

  return (
    <div className="pb-16 bg-black min-h-screen text-white">
      <Header />

      {/* ================= FILTROS ================= */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur border-b border-zinc-800">
        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            {/* DEPARTAMENTO */}
            <select
              className="
                flex-1 sm:flex-none sm:w-48
                bg-zinc-900 border border-zinc-700
                rounded-md px-3 py-1.5
                text-[11px] sm:text-sm
                focus:outline-none focus:ring-1 focus:ring-green-600
              "
              value={departmentFilter}
              onChange={(e) => {
                setDepartmentFilter(e.target.value);
                setCityFilter("");
              }}
            >
              <option value="">Departamento</option>
              {colombia.departments.map((d) => (
                <option key={d.name}>{d.name}</option>
              ))}
            </select>

            {/* CIUDAD */}
            <select
              className="
                flex-1 sm:flex-none sm:w-40
                bg-zinc-900 border border-zinc-700
                rounded-md px-3 py-1.5
                text-[11px] sm:text-sm
                focus:outline-none focus:ring-1 focus:ring-green-600
                disabled:opacity-50
              "
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              disabled={!departmentFilter}
            >
              <option value="">Ciudad</option>
              {departmentFilter &&
                colombia.departments
                  .find((x) => x.name === departmentFilter)
                  ?.cities.map((c) => <option key={c}>{c}</option>)}
            </select>

            {/* RESET */}
            <button
              onClick={resetFilters}
              className="
                px-2 sm:px-3 py-1.5
                text-[11px] sm:text-sm
                rounded-md
                bg-zinc-800 hover:bg-zinc-700
                whitespace-nowrap transition
              "
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* ================= GRID ================= */}
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <div
              key={p.id}
              onClick={() => openModal(p.id)}
              className="cursor-pointer group"
            >
              <div className="relative w-full pb-[100%] rounded-xl overflow-hidden bg-zinc-900">
                <Image
                  src={p.photoUrl || "/default-avatar.png"}
                  alt={p.name}
                  fill
                  className="object-cover group-hover:scale-105 transition"
                />
              </div>

              <div className="mt-2 text-center">
                <p className="text-sm font-semibold truncate">{p.name}</p>

                {p.price ? (
                  <p className="text-xs font-semibold mt-1 text-blue-500 flex items-center justify-center gap-1">
                    💰 ${Number(p.price).toLocaleString("es-CO")}
                  </p>
                ) : (
                  <p className="text-xs text-zinc-500 mt-1">Sin precio</p>
                )}

                <p className="text-xs text-zinc-400 mt-1">⭐ 4.8</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= MODAL PERFIL ================= */}
      {modalData && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-start justify-center pt-10 px-4"
          onClick={closeModal}
        >
          <div
            className="bg-zinc-900 rounded-2xl w-full max-w-[900px] max-h-[90vh] overflow-y-auto p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="absolute top-4 right-4 text-xl"
            >
              ×
            </button>

            {/* ================= HEADER PERFIL PRESTADOR ================= */}
            <div className="flex items-start gap-6 mb-6">
              {/* FOTO */}
              <div
                className="relative w-40 h-40 rounded-full overflow-hidden border-2 border-green-500 cursor-pointer shrink-0"
                onClick={() => openExpandedMedia(0)}
              >
                <Image
                  src={modalData.photoUrl || "/default-avatar.png"}
                  alt="perfil"
                  fill
                  className="object-cover"
                />
              </div>

              {/* INFO + BOTÓN */}
              <div className="flex-1">
                <h2 className="text-2xl font-bold">{modalData.name}</h2>

                {modalData.description && (
                  <p className="text-sm text-zinc-300 mt-1 max-w-md">
                    {modalData.description}
                  </p>
                )}

                <p className="text-sm text-zinc-400 mt-1">
                  {modalData.city}, {modalData.department}
                </p>

                {/* BOTÓN ABONAR */}
                <button
                  onClick={() => {
                    if (!user) {
                      setShowAuthRequiredModal(true);
                      return;
                    }

                    setSelectedAmount(null);
                    setShowDepositModal(true);
                  }}
                  className="mt-4 px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition"
                >
                  💰 Abonar al servicio
                </button>
              </div>
            </div>

            <h3 className="font-semibold mb-3">Galería</h3>

            <div className="grid grid-cols-3 gap-2">
              {mediaList.slice(1).map((item, i) => {
                const alreadyUnlocked = hasPurchased(item.url);
                const isPrivate = item.private && !alreadyUnlocked;

                return (
                  <div
                    key={i}
                    className="relative pb-[100%] rounded overflow-hidden cursor-pointer bg-black"
                    onClick={async () => {
                      if (isPrivate) {
                        if (!user) {
                          setShowAuthRequiredModal(true);
                          return;
                        }

                        const confirmPay = confirm(
                          `Este contenido cuesta $${item.price}. ¿Deseas pagar?`
                        );
                        if (!confirmPay) return;

                        const res = await fetch("/api/pay-content", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            buyerId: user.uid,
                            sellerId: modalData.id,
                            price: Number(item.price),
                            mediaUrl: item.url,
                          }),
                        });

                        const data = await res.json();

                        if (!res.ok) {
                          alert(data.error || "Error en el pago");
                          return;
                        }

                        setPurchasedContent((prev) => [
                          ...prev,
                          { mediaUrl: item.url },
                        ]);

                        alert("Contenido desbloqueado 🎉");
                      }

                      openExpandedMedia(i + 1);
                    }}
                  >
                    {item.type === "photo" ? (
                      <Image
                        src={item.url}
                        alt="contenido"
                        fill
                        className={`object-cover ${
                          isPrivate ? "blur-md scale-110" : ""
                        }`}
                      />
                    ) : (
                      <video
                        src={item.url}
                        muted
                        className={`absolute inset-0 w-full h-full object-cover ${
                          isPrivate ? "blur-md scale-110" : ""
                        }`}
                      />
                    )}

                    {isPrivate && (
                      <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center">
                        <span className="text-2xl">🔒</span>
                        <span>${item.price}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL ABONAR SERVICIO ================= */}
      {showDepositModal && modalData && (
        <div
          className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center px-4"
          onClick={() => setShowDepositModal(false)}
        >
          <div
            className="bg-zinc-900 rounded-xl w-full max-w-sm p-6 border border-zinc-800 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-2 text-center">
              Abonar al servicio
            </h3>

            <p className="text-sm text-zinc-400 text-center mb-6">
              Selecciona un monto para continuar
            </p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {[50000, 100000, 300000, 500000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setSelectedAmount(amount)}
                  className={`py-2 rounded-lg font-semibold border transition ${
                    selectedAmount === amount
                      ? "bg-green-600 border-green-500 text-white"
                      : "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  ${amount.toLocaleString("es-CO")}
                </button>
              ))}
            </div>

            <button
              disabled={!selectedAmount}
              onClick={async () => {
                if (!user) {
                  setShowDepositModal(false);
                  setShowAuthRequiredModal(true);
                  return;
                }

                if (!selectedAmount) return;

                try {
                  const res = await fetch("/api/deposit-service", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      buyerId: user.uid,
                      sellerId: modalData.id,
                      amount: selectedAmount,
                    }),
                  });

                  const data = await res.json();

                  if (!res.ok) {
                    alert(data.error || "Error al procesar el abono");
                    return;
                  }

                  alert("Abono realizado con éxito 💚");
                  setShowDepositModal(false);
                  setSelectedAmount(null);
                } catch (err) {
                  alert("Error al conectar con el servidor");
                }
              }}
              className={`w-full py-2 rounded-lg font-semibold transition ${
                selectedAmount
                  ? "bg-green-600 hover:bg-green-700 text-white"
                  : "bg-zinc-700 text-zinc-400 cursor-not-allowed"
              }`}
            >
              Confirmar abono
            </button>

            <button
              onClick={() => setShowDepositModal(false)}
              className="w-full mt-3 py-2 text-sm text-zinc-400 hover:text-white"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ================= MODAL REQUIERE LOGIN/REGISTRO ================= */}
      {showAuthRequiredModal && (
        <div
          className="fixed inset-0 bg-black/70 z-[80] flex items-center justify-center px-4"
          onClick={() => setShowAuthRequiredModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-full bg-green-600/20 border border-green-500/30 mb-4">
              <span className="text-2xl">🔐</span>
            </div>

            <h3 className="text-xl font-bold text-center mb-2">
              Debes iniciar sesión o registrarte
            </h3>

            <p className="text-sm text-zinc-400 text-center mb-6">
              Para abonar a un servicio necesitas tener una cuenta activa.
            </p>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowAuthRequiredModal(false);
                  closeModal();
                  router.push("/login");
                }}
                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 transition font-semibold"
              >
                Iniciar sesión
              </button>

              <button
                onClick={() => {
                  setShowAuthRequiredModal(false);
                  closeModal();
                  router.push("/register");
                }}
                className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 transition font-semibold"
              >
                Registrarme
              </button>

              <button
                onClick={() => setShowAuthRequiredModal(false)}
                className="w-full py-2 text-sm text-zinc-400 hover:text-white transition"
              >
                Ahora no
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MEDIA EXPANDIDA ================= */}
      {expandedMedia && (
        <div
          className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center"
          onClick={() => setExpandedMedia(null)}
        >
          {mediaList[currentIndex].type === "photo" ? (
            <Image
              src={mediaList[currentIndex].url}
              alt="ampliado"
              width={1600}
              height={1600}
              className="max-h-[90vh] object-contain"
            />
          ) : (
            <video
              src={mediaList[currentIndex].url}
              controls
              autoPlay
              className="max-h-[90vh]"
            />
          )}
        </div>
      )}
    </div>
  );
}