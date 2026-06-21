import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrestadoresPage from "../page";
import JsonLd from "@/components/JsonLd";
import {
  findProviderCityBySlug,
  getPublicProviderCities,
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
  const description = `Encuentra escorts verificadas en ${place}. Revisa perfiles, galerias publicas y contacta directamente por WhatsApp en BelaClub.`;

  return {
    title,
    description,
    alternates: {
      canonical: `/prestadores/${city.slug}`,
    },
    openGraph: {
      title: `${title} | BelaClub`,
      description,
      url: `/prestadores/${city.slug}`,
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

export default async function PrestadoresCityPage({ params }: CityPageProps) {
  const { citySlug } = await params;
  const city = await findProviderCityBySlug(citySlug);

  if (!city) notFound();

  const title = `Escorts en ${city.city}`;
  const pageUrl = `${siteUrl}/prestadores/${city.slug}`;
  const allProviders = await getPublicProviderCards();

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description: `Perfiles aprobados en ${city.city}${
              city.department ? `, ${city.department}` : ""
            } dentro de BelaClub.`,
            url: pageUrl,
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
                item: `${siteUrl}/prestadores`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: city.city,
                item: pageUrl,
              },
            ],
          },
        ]}
      />
      <PrestadoresPage
        initialCity={city.city}
        initialDepartment={city.department}
        initialProviders={allProviders}
      />
    </>
  );
}
