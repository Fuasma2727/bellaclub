import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import {
  findProviderCityBySlug,
  getPublicProviderCities,
  targetSeoCities,
} from "@/lib/providerCitySeo";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.com";

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
  const description = `Encuentra escorts en ${place}. Revisa perfiles aprobados, galerias publicas y contacta directamente por WhatsApp en BelaClub.`;

  return {
    title,
    description,
    keywords: [
      `escorts en ${city.city}`,
      `escorts ${city.city}`,
      `escots en ${city.city}`,
      `escots ${city.city}`,
      `prepagos en ${city.city}`,
      `BelaClub ${city.city}`,
    ],
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
  const cityLinks = targetSeoCities
    .filter((item) => item.slug !== city.slug)
    .map((item) => ({
      href: `/escorts/${item.slug}`,
      label: `Escorts en ${item.city}`,
    }));

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
        ]}
      />
      <PrestadoresPage
        initialCity={city.city}
        initialDepartment={city.department}
        pageTitle={`Escorts en ${city.city}`}
        pageEyebrow="Escorts por ciudad"
        pageDescription={`Explora escorts verificadas en ${city.city}${
          city.department ? `, ${city.department}` : ""
        }. Revisa perfiles aprobados, galerias publicas, video del dia y contacto directo por WhatsApp.`}
        seoCityLinks={[
          { href: `/prepagos/${city.slug}`, label: `Prepagos en ${city.city}` },
          ...cityLinks,
        ]}
      />
    </>
  );
}
