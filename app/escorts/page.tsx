import type { Metadata } from "next";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.com";

export const metadata: Metadata = {
  title: "Escorts en Colombia",
  description:
    "Encuentra escorts, prepagos, acompañantes y damas de compañía en Medellín, La Ceja, Rionegro y otras ciudades de Colombia. Perfiles aprobados, galerías públicas y contacto por WhatsApp en BelaClub.",
  keywords: [
    "escorts en Medellín",
    "escorts Medellín",
    "escorts en La Ceja",
    "escorts La Ceja",
    "escorts en Rionegro",
    "escorts Rionegro",
    "escots Medellín",
    "escots Rionegro",
    "prepagos Medellín",
    "acompañantes Medellín",
    "acompanantes Medellín",
    "damas de compañía Medellín",
    "damas de compania Medellín",
  ],
  alternates: {
    canonical: "/escorts",
  },
  openGraph: {
    title: "Escorts en Colombia | BelaClub",
    description:
      "Escorts, prepagos y acompañantes en Medellín, La Ceja y Rionegro con perfiles aprobados y contacto directo por WhatsApp.",
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
      "Explora escorts, prepagos y acompañantes por ciudad.",
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
        pageTitle="Escorts en Colombia"
        pageEyebrow="Explora por ciudad"
        pageDescription="Encuentra escorts verificadas en Medellín, La Ceja, Rionegro y otras ciudades. Revisa galerías públicas, filtra por departamento o ciudad y contacta directamente por WhatsApp."
        seoCityLinks={[
          ...cityLinks,
          ...targetSeoCities.map((city) => ({
            href: `/prepagos/${city.slug}`,
            label: `Prepagos en ${city.city}`,
          })),
        ]}
        seoContent={{
          heading: "Escorts por ciudad en BelaClub",
          paragraphs: [
            "BelaClub organiza perfiles aprobados por ciudad para facilitar búsquedas como escorts Medellín, escorts Rionegro, escorts La Ceja y prepagos en Antioquia.",
            "Cada página de ciudad permite revisar perfiles, fotos públicas, ubicación, zonas disponibles y contacto directo por WhatsApp.",
          ],
          zones: ["Medellín", "Rionegro", "La Ceja", "El Poblado", "Laureles", "San Antonio"],
          relatedLinks: targetSeoCities.flatMap((city) => [
            { href: `/escorts/${city.slug}`, label: `Escorts en ${city.city}` },
            { href: `/prepagos/${city.slug}`, label: `Prepagos en ${city.city}` },
          ]),
        }}
      />
    </>
  );
}
