import type { Metadata } from "next";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import {
  getRelatedProviderSearchText,
  getProviderSearchKeywords,
  providerSearchRoutes,
  providerSearchRoutesByKey,
  type ProviderSearchRouteKey,
} from "@/lib/providerSearchRoutes";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export async function generateProviderSearchLandingMetadata(
  routeKey: ProviderSearchRouteKey
): Promise<Metadata> {
  const route = providerSearchRoutesByKey[routeKey];
  const description = `Encuentra perfiles de ${route.pluralNoun} en Rionegro, Medellín, La Ceja y otras ciudades de Colombia. Revisa fotos públicas, zonas disponibles y contacto por WhatsApp en BelaClub.`;

  return {
    title: route.baseTitle,
    description,
    keywords: [
      ...getProviderSearchKeywords(route, "Colombia"),
      `${route.pluralNoun} Rionegro`,
      `${route.pluralNoun} en Rionegro`,
      "escorts rionegro",
      "escorts en rionegro",
      "prepagos rionegro",
      "putas rionegro",
    ],
    alternates: {
      canonical: `/${route.segment}`,
    },
    openGraph: {
      title: `${route.baseTitle} | BelaClub`,
      description,
      url: `/${route.segment}`,
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
      title: `${route.baseTitle} | BelaClub`,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function ProviderSearchLandingPage({
  routeKey,
}: {
  routeKey: ProviderSearchRouteKey;
}) {
  const route = providerSearchRoutesByKey[routeKey];
  const relatedSearchText = getRelatedProviderSearchText(routeKey);
  const initialProviders = await getPublicProviderCards({ limit: 60 });
  const pageUrl = `${siteUrl}/${route.segment}`;
  const cityLinks = targetSeoCities.map((city) => ({
    href: `/${route.segment}/${city.slug}`,
    label: `${route.title} en ${city.city}`,
  }));
  const relatedCitySearchLinks = targetSeoCities.flatMap((city) =>
    providerSearchRoutes.map((item) => ({
      href: `/${item.segment}/${city.slug}`,
      label: `${item.title} en ${city.city}`,
    }))
  );
  const searchTerms = [
    `${route.title} Rionegro`,
    `${route.title} en Rionegro`,
    "escorts rionegro",
    "escorts en rionegro",
    "prepagos rionegro",
    "putas rionegro",
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: route.baseTitle,
          description: `Perfiles aprobados de ${route.pluralNoun} por ciudad dentro de BelaClub, con búsquedas relacionadas de ${relatedSearchText}.`,
          url: pageUrl,
          isPartOf: {
            "@type": "WebSite",
            name: "BelaClub",
            url: siteUrl,
          },
        }}
      />
      <PrestadoresPage
        pageTitle={route.baseTitle}
        pageEyebrow="Explora por ciudad"
        pageDescription={`Encuentra perfiles de ${route.pluralNoun} por ciudad. Revisa galerías públicas, filtra por departamento o ciudad y contacta directamente por WhatsApp.`}
        initialProviders={initialProviders}
        seoCityLinks={cityLinks}
        seoContent={{
          heading: `${route.title} por ciudad en BelaClub`,
          paragraphs: [
            `BelaClub organiza perfiles aprobados de ${route.pluralNoun} por ciudad para que puedas revisar opciones activas, fotos publicas, zonas disponibles y contacto directo por WhatsApp.`,
            `También puedes explorar búsquedas relacionadas de ${relatedSearchText} en las ciudades principales de BelaClub.`,
            "En Rionegro se conectan busquedas frecuentes del oriente antioqueño como escorts rionegro, escorts en rionegro, prepagos rionegro y putas rionegro.",
          ],
          zones: [
            "Rionegro",
            "San Antonio de Pereira",
            "Llanogrande",
            "Centro",
            "La Ceja",
            "Medellín",
          ],
          searchTerms,
          relatedLinks: relatedCitySearchLinks,
        }}
      />
    </>
  );
}
