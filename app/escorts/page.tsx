import type { Metadata } from "next";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import { providerSearchRoutes } from "@/lib/providerSearchRoutes";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Escorts en Colombia",
  description:
    "Encuentra escorts en Rionegro, Medellín, La Ceja y otras ciudades de Colombia. Perfiles aprobados, galerías públicas, zonas disponibles y contacto por WhatsApp en BelaClub.",
  keywords: [
    "escorts en Medellín",
     "escorts en Medellin",
    "escorts Medellín",
     "escorts Medellin",
     "escorts en medellín",
     "escorts en medellin",
    "escorts medellín",
     "escorts medellin",
    "escorts en La Ceja",
    "escorts La Ceja",
     "escorts en la ceja",
    "escorts la ceja",
    "escorts en Rionegro",
    "escorts Rionegro",
    "escorts en rionegro",
    "escorts rionegro",
    "escots Medellín",
    "escots Rionegro",
    "prepagos Medellín",
    "prepagos Medellin",
    "prepagos medellín",
    "prepagos medellin",
    "putas medellin",
    "putas la ceja",
    "putas rionegro",
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
      "Escorts en Rionegro, Medellín y La Ceja con perfiles aprobados y contacto directo por WhatsApp.",
    url: "/escorts",
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
    title: "Escorts en Colombia | BelaClub",
    description:
      "Explora escorts, prepagos y acompañantes por ciudad.",
    images: ["/og-image.png"],
  },
};

export default async function EscortsPage() {
  const pageUrl = `${siteUrl}/escorts`;
  const initialProviders = await getPublicProviderCards({ limit: 60 });
  const cityLinks = targetSeoCities.map((city) => ({
    href: `/escorts/${city.slug}`,
    label: `Escorts en ${city.city}`,
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
        pageDescription="Encuentra escorts verificadas en Rionegro, Medellín, La Ceja y otras ciudades. Revisa galerías públicas, filtra por departamento o ciudad y contacta directamente por WhatsApp."
        initialProviders={initialProviders}
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
            "BelaClub organiza perfiles aprobados por ciudad para facilitar búsquedas como escorts rionegro, escorts en rionegro, prepagos rionegro, putas rionegro, escorts Medellín y prepagos Medellín.",
            "Rionegro concentra busquedas del oriente antioqueño en zonas como San Antonio de Pereira, Centro, Llanogrande y el sector del Aeropuerto Jose Maria Cordova.",
            "Cada página de ciudad permite revisar perfiles, fotos públicas, ubicación, zonas disponibles y contacto directo por WhatsApp.",
          ],
          zones: ["Rionegro", "San Antonio de Pereira", "Llanogrande", "Centro", "Medellín", "La Ceja"],
          relatedLinks: relatedCitySearchLinks,
        }}
      />
    </>
  );
}
