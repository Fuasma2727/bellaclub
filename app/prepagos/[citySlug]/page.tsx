import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import {
  findProviderCityBySlug,
  getPublicProviderCities,
} from "@/lib/providerCitySeo";
import { getCitySearchSeoContent } from "@/lib/providerCitySearchSeo";
import { getPublicProviderCards } from "@/lib/publicProviders";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export const revalidate = 300;
export const dynamicParams = true;

type CityPageProps = {
  params: Promise<{
    citySlug: string;
  }>;
};

const getPrepagosCityKeywords = (city: string) => [
  `prepagos en ${city}`,
  `prepagos ${city}`,
  `escorts en ${city}`,
  `escorts ${city}`,
  `acompañantes en ${city}`,
  `acompanantes ${city}`,
  `damas de compañía en ${city}`,
  `damas de compania ${city}`,
  `chicas en ${city}`,
  `chicas ${city}`,
  `masajistas en ${city}`,
  `masajistas ${city}`,
  `universitarias en ${city}`,
  `universitarias ${city}`,
  `putas en ${city}`,
  `putas ${city}`,
  `prepagos ${city} BelaClub`,
  `escorts ${city} BelaClub`,
  `BelaClub ${city}`,
];

export async function generateStaticParams() {
  const cities = await getPublicProviderCities();

  return cities.map((city) => ({
    citySlug: city.slug,
  }));
}

export async function generateMetadata({
  params,
}: CityPageProps): Promise<Metadata> {
  const { citySlug } = await params;
  const city = await findProviderCityBySlug(citySlug);

  if (!city) {
    return {
      title: "Prepagos por ciudad",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const place = city.department
    ? `${city.city}, ${city.department}`
    : city.city;
  const title = `Prepagos en ${city.city}`;
  const description = `Encuentra prepagos, escorts, acompañantes y damas de compañía en ${place}. Revisa perfiles aprobados, galerías públicas, zonas disponibles y contacto directo por WhatsApp en BelaClub.`;

  return {
    title: `${title} | Perfiles aprobados en BelaClub`,
    description,
    keywords: getPrepagosCityKeywords(city.city),
    alternates: {
      canonical: `/prepagos/${city.slug}`,
    },
    openGraph: {
      title: `${title} | BelaClub`,
      description,
      url: `/prepagos/${city.slug}`,
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

export default async function PrepagosCityPage({ params }: CityPageProps) {
  const { citySlug } = await params;
  const city = await findProviderCityBySlug(citySlug);

  if (!city) notFound();

  const title = `Prepagos en ${city.city}`;
  const pageUrl = `${siteUrl}/prepagos/${city.slug}`;
  const keywords = getPrepagosCityKeywords(city.city);
  const [cityProviders, allProviders] = await Promise.all([
    getPublicProviderCards({ citySlug: city.slug }),
    getPublicProviderCards(),
  ]);

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description: `Prepagos con perfiles aprobados en ${city.city}${
              city.department ? `, ${city.department}` : ""
            }, galerías públicas, zonas disponibles y contacto por WhatsApp dentro de BelaClub.`,
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
                name: "Prepagos",
                item: `${siteUrl}/prepagos`,
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
            name: `Búsquedas relacionadas con prepagos en ${city.city}`,
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: `Prepagos en ${city.city}`,
                url: `${siteUrl}/prepagos/${city.slug}`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: `Escorts en ${city.city}`,
                url: `${siteUrl}/escorts/${city.slug}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: `Prestadores en ${city.city}`,
                url: `${siteUrl}/prestadores/${city.slug}`,
              },
            ],
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: `Perfiles de prepagos en ${city.city}`,
            itemListElement: cityProviders
              .slice(0, 30)
              .map((provider, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: provider.name || `Perfil en ${city.city}`,
                url: `${siteUrl}${provider.profilePath}`,
              })),
          },
        ]}
      />
      <PrestadoresPage
        initialCity={city.city}
        initialDepartment={city.department}
        initialProviders={allProviders}
        pageTitle={title}
        pageDescription={`Prepagos y perfiles aprobados en ${city.city}${
          city.department ? `, ${city.department}` : ""
        }, con fotos publicas, zonas disponibles y contacto directo por WhatsApp.`}
        showPageIntro={false}
        seoContent={getCitySearchSeoContent({
          city,
          routeTitle: "Prepagos",
          routeSegment: "prepagos",
          pluralNoun: "prepagos",
        })}
      />
    </>
  );
}
