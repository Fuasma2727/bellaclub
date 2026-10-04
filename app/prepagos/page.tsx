import type { Metadata } from "next";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import { providerSearchRoutes } from "@/lib/providerSearchRoutes";
import { absoluteSiteUrl, siteHomeUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prepagos en Rionegro, Medellín y La Ceja",
  description:
    "Encuentra prepagos en Rionegro, Medellín, La Ceja, Bello y Zipaquirá. Perfiles aprobados, fotos públicas, zonas disponibles y WhatsApp.",
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
    title: "Prepagos en Rionegro, Medellín y La Ceja | BelaClub",
    description:
      "Prepagos en Rionegro, Medellín, La Ceja, Bello y Zipaquirá con perfiles aprobados y contacto directo por WhatsApp.",
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
    title: "Prepagos en Rionegro, Medellín y La Ceja | BelaClub",
    description:
      "Explora prepagos, escorts y acompañantes por ciudad en BelaClub.",
    images: ["/og-image.png"],
  },
};

export default async function PrepagosPage() {
  const pageUrl = absoluteSiteUrl("/prepagos");
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
          name: "Prepagos en Rionegro, Medellín y La Ceja",
          description:
            "Perfiles aprobados en BelaClub por ciudad, con fotos públicas, zonas disponibles y contacto por WhatsApp.",
          url: pageUrl,
          isPartOf: {
            "@type": "WebSite",
            name: "BelaClub",
            url: siteHomeUrl,
          },
        }}
      />
      <PrestadoresPage
        pageTitle="Prepagos en Rionegro, Medellín y La Ceja"
        pageEyebrow="Explora por ciudad"
        pageDescription="Encuentra prepagos verificadas en Rionegro, Medellín, La Ceja, Bello y Zipaquirá. Revisa fotos públicas, filtra por departamento o ciudad y contacta directamente por WhatsApp."
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
            "BelaClub organiza perfiles aprobados por ciudad para facilitar búsquedas como prepagos rionegro, prepagos en rionegro, prepagos Medellín, escorts Medellín, escorts rionegro y putas rionegro.",
            "Rionegro concentra busquedas del oriente antioqueño en zonas como San Antonio de Pereira, Centro, Llanogrande y el sector del Aeropuerto Jose Maria Cordova.",
            "Medellín, La Ceja, Bello y Zipaquirá tambien tienen paginas locales para comparar perfiles visibles, ubicacion declarada y categorias relacionadas sin mezclar resultados de todo el pais.",
            "Cada página de ciudad permite revisar perfiles, fotos públicas, ubicación, zonas disponibles y contacto directo por WhatsApp.",
          ],
          zones: [
            "Rionegro",
            "San Antonio de Pereira",
            "Llanogrande",
            "Centro",
            "Medellín",
            "La Ceja",
            "Bello",
            "Zipaquirá",
          ],
          relatedLinks: relatedCitySearchLinks,
        }}
      />
    </>
  );
}
