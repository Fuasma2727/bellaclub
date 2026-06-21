import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import {
  findProviderCityBySlug,
  targetSeoCities,
} from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import {
  getProviderSearchKeywords,
  providerSearchRoutesByKey,
  type ProviderSearchRouteKey,
} from "@/lib/providerSearchRoutes";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export const PROVIDER_SEARCH_REVALIDATE_SECONDS = 300;

type CityPageProps = {
  params: Promise<{
    citySlug: string;
  }>;
};

export async function generateProviderCityStaticParams() {
  return [];
}

export async function generateProviderCityMetadata(
  routeKey: ProviderSearchRouteKey,
  { params }: CityPageProps
): Promise<Metadata> {
  const route = providerSearchRoutesByKey[routeKey];
  const { citySlug } = await params;
  const city = await findProviderCityBySlug(citySlug);

  if (!city) {
    return {
      title: `${route.title} por ciudad`,
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const place = city.department
    ? `${city.city}, ${city.department}`
    : city.city;
  const title = `${route.title} en ${city.city}`;
  const description = `Encuentra ${route.pluralNoun}, escorts, prepagos, acompañantes, damas de compañía, chicas, masajistas y universitarias en ${place}. Revisa perfiles aprobados, fotos públicas, zonas disponibles y contacto directo por WhatsApp en BelaClub.`;

  return {
    title: `${title} | Perfiles aprobados en BelaClub`,
    description,
    keywords: getProviderSearchKeywords(route, city.city),
    alternates: {
      canonical: `/${route.segment}/${city.slug}`,
    },
    openGraph: {
      title: `${title} | BelaClub`,
      description,
      url: `/${route.segment}/${city.slug}`,
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
      title: `${title} | BelaClub`,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function ProviderCitySearchPage({
  routeKey,
  params,
}: CityPageProps & {
  routeKey: ProviderSearchRouteKey;
}) {
  const route = providerSearchRoutesByKey[routeKey];
  const { citySlug } = await params;
  const city = await findProviderCityBySlug(citySlug);

  if (!city) notFound();

  const title = `${route.title} en ${city.city}`;
  const pageUrl = `${siteUrl}/${route.segment}/${city.slug}`;
  const keywords = getProviderSearchKeywords(route, city.city);
  const [cityProviders, allProviders] = await Promise.all([
    getPublicProviderCards({ citySlug: city.slug }),
    getPublicProviderCards(),
  ]);
  const relatedRoutes = targetSeoCities
    .filter((item) => item.slug !== city.slug)
    .slice(0, 6);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description: `${route.title}, escorts, prepagos, acompañantes, damas de compañía, chicas, masajistas y universitarias con perfiles aprobados en ${city.city}${
              city.department ? `, ${city.department}` : ""
            }, fotos públicas, zonas disponibles y contacto por WhatsApp dentro de BelaClub.`,
            url: pageUrl,
            keywords: keywords.join(", "),
            about: keywords.map((keyword) => ({
              "@type": "Thing",
              name: keyword,
            })),
            isPartOf: {
              "@type": "WebSite",
              name: "BelaClub",
              url: siteUrl,
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "BelaClub",
                item: siteUrl,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: route.label,
                item: `${siteUrl}/${route.segment}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: city.city,
                item: pageUrl,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Perfiles de ${route.pluralNoun} en ${city.city}`,
            itemListElement: cityProviders
              .slice(0, 30)
              .map((provider, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: provider.name || `Perfil en ${city.city}`,
                url: `${siteUrl}${provider.profilePath}`,
              })),
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Búsquedas relacionadas con ${route.pluralNoun} en ${city.city}`,
            itemListElement: [
              ...keywords.slice(0, 5).map((keyword, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: keyword,
                url: pageUrl,
              })),
              ...relatedRoutes.map((item, index) => ({
                "@type": "ListItem",
                position: index + 6,
                name: `${route.title} en ${item.city}`,
                url: `${siteUrl}/${route.segment}/${item.slug}`,
              })),
            ],
          },
        ]}
      />
      <PrestadoresPage
        initialCity={city.city}
        initialDepartment={city.department}
        initialProviders={allProviders}
        showPageIntro={false}
      />
    </>
  );
}
