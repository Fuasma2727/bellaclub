import type { Metadata } from "next";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.com";

export const metadata: Metadata = {
  title: "Prepagos en Colombia",
  description:
    "Encuentra prepagos en Medellín, La Ceja, Rionegro y otras ciudades de Colombia. Perfiles aprobados, galerias publicas y contacto por WhatsApp en BelaClub.",
  keywords: [
    "prepagos en Medellín",
    "prepagos Medellín",
    "prepagos en La Ceja",
    "prepagos La Ceja",
    "prepagos en Rionegro",
    "prepagos Rionegro",
  ],
  alternates: {
    canonical: "/prepagos",
  },
  openGraph: {
    title: "Prepagos en Colombia | BelaClub",
    description:
      "Prepagos en Medellín, La Ceja y Rionegro con perfiles aprobados, galerias publicas y contacto directo por WhatsApp.",
    url: "/prepagos",
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
    title: "Prepagos en Colombia | BelaClub",
    description:
      "Explora prepagos por ciudad y contacta directamente por WhatsApp.",
    images: ["/og-image.png"],
  },
};

export default function PrepagosPage() {
  const pageUrl = `${siteUrl}/prepagos`;
  const cityLinks = targetSeoCities.map((city) => ({
    href: `/prepagos/${city.slug}`,
    label: `Prepagos en ${city.city}`,
  }));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Prepagos en Colombia",
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
        pageTitle="Prepagos en Colombia"
        pageEyebrow="Explora por ciudad"
        pageDescription="Encuentra prepagos verificadas en Medellín, La Ceja, Rionegro y otras ciudades. Revisa galerias publicas, filtra por departamento o ciudad y contacta directamente por WhatsApp."
        seoCityLinks={cityLinks}
      />
    </>
  );
}
