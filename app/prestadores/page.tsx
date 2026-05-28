"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import Header from "@/components/header";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import AuthRequiredModal from "./_components/AuthRequiredModal";
import DepositModal from "./_components/DepositModal";
import ExpandedMediaModal from "./_components/ExpandedMediaModal";
import FiltersBar from "./_components/FiltersBar";
import ProviderCard from "./_components/ProviderCard";
import ProviderProfileModal from "./_components/ProviderProfileModal";
import PurchaseModal from "./_components/PurchaseModal";
import ReportModal from "./_components/ReportModal";
import {
  ApiResponse,
  CitySeoLink,
  MediaItem,
  PendingPurchase,
  Prestador,
} from "./_components/types";

type PrestadoresPageProps = {
  initialCity?: string;
  initialDepartment?: string;
  pageTitle?: string;
  pageEyebrow?: string;
  pageDescription?: string;
  seoCityLinks?: CitySeoLink[];
};

const citySlugValue = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function PrestadoresPage({
  initialCity = "",
  initialDepartment = "",
  pageTitle,
  pageEyebrow = "Escorts por ciudad",
  pageDescription,
  seoCityLinks = [],
}: PrestadoresPageProps = {}) {
  const { user } = useAuth();
  const router = useRouter();

  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [modalData, setModalData] = useState<Prestador | null>(null);
  const [dailyVideoProvider, setDailyVideoProvider] =
    useState<Prestador | null>(null);
  const [expandedMedia, setExpandedMedia] = useState<MediaItem | null>(null);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openingProfileId, setOpeningProfileId] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [reportMessage, setReportMessage] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportBalance, setReportBalance] = useState<number | null>(null);
  const [reportEligibilityLoading, setReportEligibilityLoading] =
    useState(false);

  const [departmentFilter, setDepartmentFilter] = useState(initialDepartment);
  const [cityFilter, setCityFilter] = useState(initialCity);

  const [showDepositModal, setShowDepositModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositMessage, setDepositMessage] = useState("");

  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState(false);
  const [pendingPurchase, setPendingPurchase] =
    useState<PendingPurchase | null>(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseError, setPurchaseError] = useState("");

  const departments = useMemo(() => {
    return Array.from(
      new Set(
        prestadores
          .map((provider) => provider.department?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "es"));
  }, [prestadores]);

  const cities = useMemo(() => {
    return Array.from(
      new Set(
        prestadores
          .filter(
            (provider) =>
              !departmentFilter || provider.department === departmentFilter
          )
          .map((provider) => provider.city?.trim())
          .filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "es"));
  }, [departmentFilter, prestadores]);

  const filtered = useMemo(() => {
    let results = [...prestadores];

    if (departmentFilter) {
      results = results.filter(
        (provider) => provider.department === departmentFilter
      );
    }

    if (cityFilter) {
      const selectedCitySlug = citySlugValue(cityFilter);
      results = results.filter(
        (provider) => citySlugValue(provider.city || "") === selectedCitySlug
      );
    }

    return results;
  }, [departmentFilter, cityFilter, prestadores]);

  const hasPurchased = useCallback((item: MediaItem) => {
    return !item.private || Boolean(item.url);
  }, []);

  const canViewMedia = useCallback(
    (item?: MediaItem) => {
      if (!item) return false;
      return hasPurchased(item);
    },
    [hasPurchased]
  );

  const getNextViewableIndex = useCallback(
    (startIndex: number, direction: 1 | -1) => {
      if (mediaList.length === 0) return startIndex;

      for (let step = 1; step <= mediaList.length; step += 1) {
        const nextIndex =
          (startIndex + direction * step + mediaList.length) %
          mediaList.length;

        if (canViewMedia(mediaList[nextIndex])) {
          return nextIndex;
        }
      }

      return startIndex;
    },
    [canViewMedia, mediaList]
  );

  useEffect(() => {
    const isAnyModalOpen =
      !!expandedMedia ||
      !!showDepositModal ||
      !!showAuthRequiredModal ||
      !!showReportModal ||
      !!pendingPurchase ||
      !!dailyVideoProvider;

    document.body.style.overflow = isAnyModalOpen ? "hidden" : "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [
    expandedMedia,
    showDepositModal,
    showAuthRequiredModal,
    showReportModal,
    pendingPurchase,
    dailyVideoProvider,
  ]);

  useEffect(() => {
    if (initialCity) return;

    if (departmentFilter && !departments.includes(departmentFilter)) {
      setDepartmentFilter("");
      setCityFilter("");
      return;
    }

    if (cityFilter && !cities.includes(cityFilter)) {
      setCityFilter("");
    }
  }, [cityFilter, cities, departmentFilter, departments, initialCity]);

  useEffect(() => {
    if (!expandedMedia || mediaList.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        setCurrentIndex((index) => {
          const nextIndex = getNextViewableIndex(index, 1);
          setExpandedMedia(mediaList[nextIndex]);
          return nextIndex;
        });
      }

      if (e.key === "ArrowLeft") {
        setCurrentIndex((index) => {
          const nextIndex = getNextViewableIndex(index, -1);
          setExpandedMedia(mediaList[nextIndex]);
          return nextIndex;
        });
      }

      if (e.key === "Escape") {
        setExpandedMedia(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [expandedMedia, getNextViewableIndex, mediaList]);

  useEffect(() => {
    const fetchPrestadores = async () => {
      setLoading(true);
      setPageError("");

      try {
        const res = await fetch("/api/providers");
        const payload = (await res.json()) as {
          providers?: Prestador[];
          error?: string;
        };

        if (!res.ok) {
          throw new Error(payload.error || "No pudimos cargar los perfiles");
        }

        setPrestadores(payload.providers || []);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No pudimos cargar los perfiles";
        setPageError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchPrestadores();
  }, []);

  const openModal = async (id: string) => {
    setOpeningProfileId(id);

    try {
      const headers: HeadersInit = {};

      if (user) {
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
      }

      const res = await fetch(`/api/providers/${id}`, { headers });
      const payload = (await res.json()) as {
        provider?: Prestador;
        error?: string;
      };

      if (!res.ok || !payload.provider) {
        throw new Error(payload.error || "No pudimos abrir el perfil");
      }

      const data = payload.provider;
      const allMedia: MediaItem[] = [
        { type: "photo", url: data.photoUrl || "/default-avatar.png" },
        ...(Array.isArray(data.media) ? data.media : []),
      ];

      setModalData(data);
      setMediaList(allMedia);
    } finally {
      setOpeningProfileId(null);
    }
  };

  const openExpandedMedia = (index: number) => {
    if (!canViewMedia(mediaList[index])) return;

    setCurrentIndex(index);
    setExpandedMedia(mediaList[index]);
  };

  const closeModal = () => {
    setModalData(null);
    setExpandedMedia(null);
    setShowDepositModal(false);
    setSelectedAmount(null);
    setDepositMessage("");
    setPendingPurchase(null);
    setPurchaseError("");
    setReportMessage("");
    setShowReportModal(false);
    setReportReason("");
    setReportBalance(null);
  };

  const resetFilters = () => {
    setDepartmentFilter("");
    setCityFilter("");
  };

  const requestAuth = () => {
    setPendingPurchase(null);
    setShowDepositModal(false);
    setShowAuthRequiredModal(true);
  };

  const handleMediaClick = (item: MediaItem, index: number) => {
    const isPrivate = item.private && !hasPurchased(item);

    if (!isPrivate) {
      openExpandedMedia(index);
      return;
    }

    if (!user) {
      requestAuth();
      return;
    }

    setPurchaseError("");
    setPendingPurchase({ item, index });
  };

  const handlePurchase = async () => {
    if (!user || !modalData || !pendingPurchase) return;

    setPurchaseLoading(true);
    setPurchaseError("");

    try {
      const res = await fetch("/api/pay-content", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sellerId: modalData.id,
          mediaId: pendingPurchase.item.id,
        }),
      });
      const data = (await res.json()) as ApiResponse & {
        mediaUrl?: string;
        mediaId?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "No pudimos desbloquear el contenido");
      }

      const targetIndex = pendingPurchase.index;
      const unlockedUrl = data.mediaUrl || "";

      setMediaList((current) =>
        current.map((item, index) =>
          index === targetIndex ? { ...item, url: unlockedUrl } : item
        )
      );
      setPendingPurchase(null);
      setCurrentIndex(targetIndex);
      setExpandedMedia({ ...pendingPurchase.item, url: unlockedUrl });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No pudimos desbloquear el contenido";
      setPurchaseError(message);
    } finally {
      setPurchaseLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!user) {
      requestAuth();
      return;
    }

    if (!modalData || !selectedAmount) return;

    setDepositLoading(true);
    setDepositMessage("");

    try {
      const res = await fetch("/api/deposit-service", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sellerId: modalData.id,
          amount: selectedAmount,
        }),
      });
      const data = (await res.json()) as ApiResponse & { code?: string };

      if (!res.ok) {
        throw new Error(data.error || "Error al procesar el abono");
      }

      setDepositMessage(
        data.code
          ? `Abono realizado con éxito. Código: ${data.code}`
          : "Abono realizado con éxito"
      );
      setSelectedAmount(null);
      window.setTimeout(() => setShowDepositModal(false), 1200);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Error al conectar con el servidor";
      setDepositMessage(message);
    } finally {
      setDepositLoading(false);
    }
  };

  const openReportModal = async () => {
    if (!user || !modalData) {
      requestAuth();
      return;
    }

    setShowReportModal(true);
    setReportReason("");
    setReportMessage("");
    setReportBalance(null);
    setReportEligibilityLoading(true);

    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));

      if (!userSnap.exists()) {
        setReportMessage(
          "Debes tener una cuenta registrada en BelaClub para reportar perfiles."
        );
        return;
      }

      const balance = Number(userSnap.data().balance || 0);
      setReportBalance(balance);

      if (balance < 500000) {
        setReportMessage(
          "Para reportar un perfil debes tener al menos $500.000 de saldo en BelaClub."
        );
      }
    } catch {
      setReportMessage(
        "No pudimos verificar tu saldo. Intentalo de nuevo en un momento."
      );
    } finally {
      setReportEligibilityLoading(false);
    }
  };

  const handleReport = async () => {
    if (!user || !modalData) {
      requestAuth();
      return;
    }

    const reason = reportReason.trim();

    if (Number(reportBalance || 0) < 500000) {
      setReportMessage(
        "Para reportar un perfil debes tener al menos $500.000 de saldo en BelaClub."
      );
      return;
    }

    if (reason.length < 8) {
      setReportMessage("Cuentanos un poco mas sobre lo que debemos revisar.");
      return;
    }

    setReporting(true);
    setReportMessage("");

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          providerId: modalData.id,
          reason,
        }),
      });
      const data = (await res.json()) as ApiResponse;

      if (!res.ok) {
        throw new Error(data.error || "No pudimos enviar el reporte");
      }

      setReportMessage("Reporte enviado para revision.");
      window.setTimeout(() => {
        setShowReportModal(false);
        setReportReason("");
        setReportMessage("");
      }, 1200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No pudimos enviar el reporte";
      setReportMessage(message);
    } finally {
      setReporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] pb-16 pt-14 text-white sm:pt-16">
      <Header />

      <main>
        {(initialCity || pageTitle) && (
          <section className="border-b border-white/[0.08] bg-[#080809]">
            <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                {pageEyebrow}
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
                {pageTitle || `Escorts en ${initialCity}`}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                {pageDescription ||
                  `Explora perfiles aprobados en ${initialCity}${
                    initialDepartment ? `, ${initialDepartment}` : ""
                  }, revisa galerias publicas y contacta directamente por WhatsApp.`}
              </p>
              {seoCityLinks.length > 0 && (
                <nav
                  aria-label="Ciudades populares"
                  className="mt-4 flex flex-wrap gap-2"
                >
                  {seoCityLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:border-blue-300/35 hover:bg-blue-400/10 hover:text-blue-100"
                    >
                      {link.label}
                    </Link>
                  ))}
                </nav>
              )}
            </div>
          </section>
        )}

        <FiltersBar
          departmentFilter={departmentFilter}
          cityFilter={cityFilter}
          departments={departments}
          cities={cities}
          resultCount={filtered.length}
          onDepartmentChange={(value) => {
            setDepartmentFilter(value);
            setCityFilter("");
          }}
          onCityChange={setCityFilter}
          onReset={resetFilters}
        />

        <section className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
          {loading && (
            <div className="rounded-md border border-white/[0.08] bg-[#101012] p-8 text-center text-sm text-neutral-400">
              Cargando perfiles...
            </div>
          )}

          {!loading && pageError && (
            <div className="rounded-md border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-100">
              {pageError}
            </div>
          )}

          {!loading && !pageError && filtered.length === 0 && (
            <div className="rounded-md border border-dashed border-white/[0.08] bg-[#101012] p-10 text-center">
              <h2 className="text-xl font-semibold">No hay resultados</h2>
              <p className="mt-2 text-sm text-neutral-400">
                Prueba limpiando los filtros o seleccionando otra ciudad.
              </p>
            </div>
          )}

          {!loading && !pageError && filtered.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  isOpening={openingProfileId === provider.id}
                  onOpen={(id) => void openModal(id)}
                  onOpenDailyVideo={setDailyVideoProvider}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-white/[0.08] px-4 py-8 text-sm text-neutral-500 sm:px-6 lg:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p>BelaClub · Plataforma para mayores de edad.</p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/terminos" className="transition hover:text-white">
              Terminos
            </Link>
            <Link href="/privacidad" className="transition hover:text-white">
              Privacidad
            </Link>
            <Link href="/seguridad" className="transition hover:text-white">
              Seguridad
            </Link>
            <a
              href="mailto:soporte@bellaclub.com"
              className="transition hover:text-white"
            >
              Soporte
            </a>
          </nav>
        </div>
      </footer>

      {modalData && (
        <ProviderProfileModal
          provider={modalData}
          mediaList={mediaList}
          userLoggedIn={Boolean(user)}
          hasPurchased={hasPurchased}
          onClose={closeModal}
          onRequestAuth={requestAuth}
          onOpenDeposit={() => {
            setSelectedAmount(null);
            setDepositMessage("");
            setShowDepositModal(true);
          }}
          onReport={() => void openReportModal()}
          onOpenMedia={openExpandedMedia}
          onMediaClick={handleMediaClick}
        />
      )}

      {dailyVideoProvider?.dailyVideo?.url && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          onClick={() => setDailyVideoProvider(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-white/10 bg-[#101012] text-white shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-300">
                  Video del dia
                </p>
                <h2 className="truncate text-base font-semibold">
                  {dailyVideoProvider.name || "Escort verificada"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDailyVideoProvider(null)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-neutral-300 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Cerrar video del dia"
              >
                X
              </button>
            </div>
            <video
              src={dailyVideoProvider.dailyVideo.url}
              controls
              autoPlay
              playsInline
              className="aspect-video w-full bg-black object-contain"
            />
            <div className="px-4 py-3 text-xs text-neutral-500">
              Disponible por tiempo limitado.
            </div>
          </div>
        </div>
      )}

      {pendingPurchase && (
        <PurchaseModal
          pendingPurchase={pendingPurchase}
          purchaseError={purchaseError}
          purchaseLoading={purchaseLoading}
          onClose={() => setPendingPurchase(null)}
          onPurchase={() => void handlePurchase()}
        />
      )}

      {showDepositModal && modalData && (
        <DepositModal
          selectedAmount={selectedAmount}
          depositMessage={depositMessage}
          depositLoading={depositLoading}
          onSelectAmount={setSelectedAmount}
          onDeposit={() => void handleDeposit()}
          onClose={() => setShowDepositModal(false)}
        />
      )}

      {showAuthRequiredModal && (
        <AuthRequiredModal
          onClose={() => setShowAuthRequiredModal(false)}
          onLogin={() => {
            setShowAuthRequiredModal(false);
            closeModal();
            router.push("/login");
          }}
          onRegister={() => {
            setShowAuthRequiredModal(false);
            closeModal();
            router.push("/register");
          }}
        />
      )}

      {showReportModal && modalData && (
        <ReportModal
          providerName={modalData.name || "este perfil"}
          reason={reportReason}
          balance={reportBalance}
          eligibilityLoading={reportEligibilityLoading}
          message={reportMessage}
          reporting={reporting}
          canSubmit={
            Number(reportBalance || 0) >= 500000 &&
            reportReason.trim().length >= 8 &&
            !reportEligibilityLoading
          }
          onReasonChange={setReportReason}
          onSubmit={() => void handleReport()}
          onClose={() => {
            setShowReportModal(false);
            setReportReason("");
            setReportMessage("");
            setReportBalance(null);
          }}
        />
      )}

      {expandedMedia && (
        <ExpandedMediaModal
          item={mediaList[currentIndex]}
          watermarkText={user?.email || user?.uid}
          onClose={() => setExpandedMedia(null)}
        />
      )}
    </div>
  );
}
