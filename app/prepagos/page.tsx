import type { Metadata } from "next";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.com";

export const metadata: Metadata = {
  title: "Prepagos en Colombia",
  description:
    "Encuentra prepagos en Medellín, La Ceja, Rionegro y otras ciudades de Colombia. Perfiles aprobados, galerías públicas y contacto por WhatsApp en BelaClub.",
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
      "Prepagos en Medellín, La Ceja y Rionegro con perfiles aprobados, galerías públicas y contacto directo por WhatsApp.",
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
            "Perfiles aprobados en BelaClub por ciudad, con galerías públicas y contacto por WhatsApp.",
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
        pageDescription="Encuentra prepagos verificadas en Medellín, La Ceja, Rionegro y otras ciudades. Revisa galerías públicas, filtra por departamento o ciudad y contacta directamente por WhatsApp."
        seoCityLinks={[
          ...cityLinks,
          ...targetSeoCities.map((city) => ({
            href: `/escorts/${city.slug}`,
            label: `Escorts en ${city.city}`,
          })),
        ]}
        seoContent={{
          heading: "Prepagos por ciudad en BelaClub",
          paragraphs: [
            "BelaClub organiza perfiles aprobados por ciudad para facilitar búsquedas como prepagos Medellín, prepagos Rionegro, prepagos La Ceja y escorts en Antioquia.",
            "Cada página de ciudad permite revisar perfiles, fotos públicas, ubicación, zonas disponibles y contacto directo por WhatsApp.",
          ],
          zones: ["Medellín", "Rionegro", "La Ceja", "El Poblado", "Laureles", "San Antonio"],
          relatedLinks: targetSeoCities.flatMap((city) => [
            { href: `/prepagos/${city.slug}`, label: `Prepagos en ${city.city}` },
            { href: `/escorts/${city.slug}`, label: `Escorts en ${city.city}` },
          ]),
        }}
      />
    </>
  );
}
