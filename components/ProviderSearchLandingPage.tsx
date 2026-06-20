import type { Metadata } from "next";
import PrestadoresPage from "@/app/prestadores/PrestadoresClientPage";
import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import {
  getProviderSearchKeywords,
  providerSearchRoutesByKey,
  type ProviderSearchRouteKey,
} from "@/lib/providerSearchRoutes";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export async function generateProviderSearchLandingMetadata(
  routeKey: ProviderSearchRouteKey
): Promise<Metadata> {
  const route = providerSearchRoutesByKey[routeKey];
  const description = `Encuentra ${route.pluralNoun}, escorts, prepagos, acompañantes, damas de compañía, chicas, masajistas y universitarias por ciudad en Colombia. Perfiles aprobados, fotos públicas y contacto por WhatsApp en BelaClub.`;

  return {
    title: route.baseTitle,
    description,
    keywords: getProviderSearchKeywords(route, "Colombia"),
    alternates: {
      canonical: `/${route.segment}`,
    },
    openGraph: {
      title: `${route.baseTitle} | BelaClub`,
      description,
      url: `/${route.segment}`,
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
  const initialProviders = await getPublicProviderCards({ limit: 60 });
  const pageUrl = `${siteUrl}/${route.segment}`;
  const cityLinks = targetSeoCities.map((city) => ({
    href: `/${route.segment}/${city.slug}`,
    label: `${route.title} en ${city.city}`,
  }));

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: route.baseTitle,
          description: `Perfiles aprobados de ${route.pluralNoun}, escorts, prepagos, acompañantes, damas de compañía, chicas, masajistas y universitarias por ciudad dentro de BelaClub.`,
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
        pageDescription={`Encuentra ${route.pluralNoun} verificadas por ciudad. Revisa galerías públicas, filtra por departamento o ciudad y contacta directamente por WhatsApp.`}
        initialProviders={initialProviders}
        seoCityLinks={cityLinks}
      />
    </>
  );
}
