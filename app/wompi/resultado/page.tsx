"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/header";

type PaymentState = "checking" | "approved" | "pending" | "failed";

type ConfirmResponse = {
  status?: string;
  credited?: boolean;
  error?: string;
};

function WompiResultContent() {
  const searchParams = useSearchParams();
  const transactionId = searchParams.get("id");
  const [state, setState] = useState<PaymentState>("checking");
  const [message, setMessage] = useState("Confirmando tu pago...");

  const copy = useMemo(() => {
    if (state === "approved") {
      return {
        title: "Saldo agregado",
        tone: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
      };
    }

    if (state === "pending") {
      return {
        title: "Pago en proceso",
        tone: "border-amber-400/25 bg-amber-400/10 text-amber-100",
      };
    }

    if (state === "failed") {
      return {
        title: "No pudimos confirmar el pago",
        tone: "border-rose-400/25 bg-rose-400/10 text-rose-100",
      };
    }

    return {
      title: "Confirmando pago",
      tone: "border-blue-400/25 bg-blue-400/10 text-blue-100",
    };
  }, [state]);

  useEffect(() => {
    const confirmPayment = async () => {
      if (!transactionId) {
        setState("failed");
        setMessage("No recibimos el identificador de la transaccion.");
        return;
      }

      try {
        const res = await fetch(`/api/wompi/confirm?id=${transactionId}`);
        const data = (await res.json()) as ConfirmResponse;

        if (!res.ok) {
          throw new Error(data.error || "No pudimos confirmar el pago");
        }

        if (data.status === "APPROVED") {
          setState("approved");
          setMessage(
            data.credited
              ? "Tu saldo ya fue actualizado."
              : "Tu pago ya habia sido aplicado anteriormente."
          );
          return;
        }

        if (data.status === "PENDING") {
          setState("pending");
          setMessage(
            "Wompi aun esta procesando el pago. El saldo se actualizara cuando se apruebe."
          );
          return;
        }

        setState("failed");
        setMessage("La transaccion no fue aprobada.");
      } catch (error) {
        setState("failed");
        setMessage(
          error instanceof Error ? error.message : "No pudimos confirmar el pago"
        );
      }
    };

    void confirmPayment();
  }, [transactionId]);

  return (
    <div className="min-h-screen bg-[#050505] pt-14 text-white sm:pt-16">
      <Header />
      <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-6 py-12">
        <section
          className={`w-full rounded-lg border p-8 text-center shadow-2xl shadow-black/30 ${copy.tone}`}
        >
          <p className="text-sm font-medium text-current/75">Wompi</p>
          <h1 className="mt-2 text-3xl font-semibold">{copy.title}</h1>
          <p className="mt-3 text-sm leading-6 text-current/80">{message}</p>

          <Link
            href="/prestadores"
            className="mt-6 inline-flex rounded-md bg-white px-5 py-3 text-sm font-semibold text-[#101012] transition hover:bg-neutral-200"
          >
            Volver a escorts
          </Link>
        </section>
      </main>
    </div>
  );
}

export default function WompiResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] pt-14 text-white sm:pt-16">
          <Header />
          <main className="mx-auto flex min-h-[70vh] max-w-xl items-center px-6 py-12">
            <section className="w-full rounded-lg border border-blue-400/25 bg-blue-400/10 p-8 text-center text-blue-100 shadow-2xl shadow-black/30">
              <p className="text-sm font-medium text-current/75">Wompi</p>
              <h1 className="mt-2 text-3xl font-semibold">
                Confirmando pago
              </h1>
              <p className="mt-3 text-sm leading-6 text-current/80">
                Confirmando tu pago...
              </p>
            </section>
          </main>
        </div>
      }
    >
      <WompiResultContent />
    </Suspense>
  );
}
