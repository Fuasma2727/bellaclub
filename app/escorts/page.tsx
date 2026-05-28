import type { Metadata } from "next";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.com";

export const metadata: Metadata = {
  title: "Escorts en Colombia",
  description:
    "Encuentra escorts en Medellín, La Ceja, Rionegro y otras ciudades de Colombia. Perfiles aprobados, galerias publicas y contacto por WhatsApp en BelaClub.",
  keywords: [
    "escorts en Medellín",
    "escorts Medellín",
    "escorts en La Ceja",
    "escorts La Ceja",
    "escorts en Rionegro",
    "escorts Rionegro",
    "escots Medellín",
    "escots Rionegro",
  ],
  alternates: {
    canonical: "/escorts",
  },
  openGraph: {
    title: "Escorts en Colombia | BelaClub",
    description:
      "Escorts en Medellín, La Ceja y Rionegro con perfiles aprobados, galerias publicas y contacto directo por WhatsApp.",
    url: "/escorts",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BelaClub",
      },
    ],
    type: "website",
    locale: "es_CO",
  },
  twitter: {
    card: "summary_large_image",
    title: "Escorts en Colombia | BelaClub",
    description:
      "Explora escorts por ciudad y contacta directamente por WhatsApp.",
    images: ["/og-image.png"],
  },
};

export default function EscortsPage() {
  const pageUrl = `${siteUrl}/escorts`;
  const cityLinks = targetSeoCities.map((city) => ({
    href: `/escorts/${city.slug}`,
    label: `Escorts en ${city.city}`,
  }));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Escorts en Colombia",
          description:
            "Perfiles aprobados en BelaClub por ciudad, con galerias publicas y contacto por WhatsApp.",
          url: pageUrl,
          isPartOf: {
            "@type": "WebSite",
            name: "BelaClub",
            url: siteUrl,
          },
        }}
      />
      <PrestadoresPage
        pageTitle="Escorts en Colombia"
        pageEyebrow="Explora por ciudad"
        pageDescription="Encuentra escorts verificadas en Medellín, La Ceja, Rionegro y otras ciudades. Revisa galerias publicas, filtra por departamento o ciudad y contacta directamente por WhatsApp."
        seoCityLinks={cityLinks}
      />
    </>
  );
}
