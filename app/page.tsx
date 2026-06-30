import type { Metadata } from "next";

import PrestadoresPage from "./prestadores/page";

export const metadata: Metadata = {
  title: {
    absolute: "BelaClub: Escorts verificadas",
  },
  description:
    "Explora escorts verificadas, prepagos, acompanantes y damas de compania en BelaClub. Revisa galerias publicas, contenido privado y contacto por WhatsApp.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "BelaClub: Escorts verificadas",
    description:
      "Escorts verificadas, prepagos y acompanantes con galerias publicas, contenido privado y contacto directo en BelaClub.",
    url: "/",
    siteName: "BelaClub",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BelaClub",
      },
    ],
    locale: "es_CO",
    type: "website",
  },
};

export default function Home() {
  return <PrestadoresPage />;
}
