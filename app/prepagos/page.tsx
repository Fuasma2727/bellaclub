import type { Metadata } from "next";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import { providerSearchRoutes } from "@/lib/providerSearchRoutes";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prepagos en Colombia",
  description:
    "Encuentra prepagos, escorts, acompañantes y damas de compañía en Medellín, La Ceja, Rionegro y otras ciudades de Colombia. Perfiles aprobados, galerías públicas y contacto por WhatsApp en BelaClub.",
  keywords: [
    "prepagos en Medellín",
    "prepagos Medellín",
    "prepagos en La Ceja",
    "prepagos La Ceja",
    "prepagos en Rionegro",
    "prepagos Rionegro",
    "escorts Medellín",
    "acompañantes Medellín",
    "acompanantes Medellín",
    "damas de compañía Medellín",
    "damas de compania Medellín",
  ],
  alternates: {
    canonical: "/prepagos",
  },
  openGraph: {
    title: "Prepagos en Colombia | BelaClub",
    description:
      "Prepagos, escorts y acompañantes en Medellín, La Ceja y Rionegro con perfiles aprobados y contacto directo por WhatsApp.",
    url: "/prepagos",
    siteName: "BelaClub",
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
      "Explora prepagos, escorts y acompañantes por ciudad.",
    images: ["/og-image.png"],
  },
};

export default async function PrepagosPage() {
  const pageUrl = `${siteUrl}/prepagos`;
  const initialProviders = await getPublicProviderCards({ limit: 60 });
  const cityLinks = targetSeoCities.map((city) => ({
    href: `/prepagos/${city.slug}`,
    label: `Prepagos en ${city.city}`,
  }));
  const relatedCitySearchLinks = targetSeoCities.flatMap((city) =>
    providerSearchRoutes.map((route) => ({
      href: `/${route.segment}/${city.slug}`,
      label: `${route.title} en ${city.city}`,
    }))
  );

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
        initialProviders={initialProviders}
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
            "BelaClub organiza perfiles aprobados por ciudad para facilitar búsquedas como prepagos Medellín, escorts Medellín, acompañantes, damas de compañía, chicas, masajistas y universitarias.",
            "Cada página de ciudad permite revisar perfiles, fotos públicas, ubicación, zonas disponibles y contacto directo por WhatsApp.",
          ],
          zones: ["Medellín", "Rionegro", "La Ceja", "El Poblado", "Laureles", "San Antonio"],
          relatedLinks: relatedCitySearchLinks,
        }}
      />
    </>
  );
}
