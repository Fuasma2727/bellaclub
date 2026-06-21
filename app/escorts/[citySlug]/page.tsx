import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import {
  findProviderCityBySlug,
} from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export const revalidate = 300;
export const dynamicParams = true;

type CityPageProps = {
  params: Promise<{
    citySlug: string;
  }>;
};

const getEscortsCityKeywords = (city: string) => [
  `escorts en ${city}`,
  `escorts ${city}`,
  `escots en ${city}`,
  `escots ${city}`,
  `prepagos en ${city}`,
  `prepagos ${city}`,
  `acompañantes en ${city}`,
  `acompanantes ${city}`,
  `damas de compañía en ${city}`,
  `damas de compania ${city}`,
  `chicas en ${city}`,
  `chicas ${city}`,
  `BelaClub ${city}`,
];

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: CityPageProps): Promise<Metadata> {
  const { citySlug } = await params;
  const city = await findProviderCityBySlug(citySlug);

  if (!city) {
    return {
      title: "Escorts por ciudad",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const place = city.department
    ? `${city.city}, ${city.department}`
    : city.city;
  const title = `Escorts en ${city.city}`;
  const description = `Encuentra escorts, prepagos, acompañantes y damas de compañía en ${place}. Revisa perfiles aprobados, galerías públicas, zonas disponibles y contacto directo por WhatsApp en BelaClub.`;

  return {
    title: `${title} | Perfiles aprobados en BelaClub`,
    description,
    keywords: getEscortsCityKeywords(city.city),
    alternates: {
      canonical: `/escorts/${city.slug}`,
    },
    openGraph: {
      title: `${title} | BelaClub`,
      description,
      url: `/escorts/${city.slug}`,
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

export default async function EscortsCityPage({ params }: CityPageProps) {
  const { citySlug } = await params;
  const city = await findProviderCityBySlug(citySlug);

  if (!city) notFound();

  const title = `Escorts en ${city.city}`;
  const pageUrl = `${siteUrl}/escorts/${city.slug}`;
  const keywords = getEscortsCityKeywords(city.city);
  const cityProviders = await getPublicProviderCards({ citySlug: city.slug });

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description: `Escorts con perfiles aprobados en ${city.city}${
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
                name: "Escorts",
                item: `${siteUrl}/escorts`,
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
            name: `Búsquedas relacionadas con escorts en ${city.city}`,
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: `Escorts en ${city.city}`,
                url: `${siteUrl}/escorts/${city.slug}`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: `Prepagos en ${city.city}`,
                url: `${siteUrl}/prepagos/${city.slug}`,
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
            name: `Perfiles de escorts en ${city.city}`,
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
        initialProviders={cityProviders}
        showPageIntro={false}
      />
    </>
  );
}
