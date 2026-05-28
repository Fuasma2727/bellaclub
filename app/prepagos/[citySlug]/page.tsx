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
  const description = `Encuentra prepagos en ${place}. Revisa perfiles aprobados, galerias publicas y contacta directamente por WhatsApp en BelaClub.`;

  return {
    title,
    description,
    keywords: [
      `prepagos en ${city.city}`,
      `prepagos ${city.city}`,
      `escorts en ${city.city}`,
      `escorts ${city.city}`,
      `BelaClub ${city.city}`,
    ],
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
  const cityLinks = targetSeoCities
    .filter((item) => item.slug !== city.slug)
    .map((item) => ({
      href: `/prepagos/${item.slug}`,
      label: `Prepagos en ${item.city}`,
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
        ]}
      />
      <PrestadoresPage
        initialCity={city.city}
        initialDepartment={city.department}
        pageTitle={`Prepagos en ${city.city}`}
        pageEyebrow="Prepagos por ciudad"
        pageDescription={`Explora prepagos verificadas en ${city.city}${
          city.department ? `, ${city.department}` : ""
        }. Revisa perfiles aprobados, galerias publicas, video del dia y contacto directo por WhatsApp.`}
        seoCityLinks={[
          { href: `/escorts/${city.slug}`, label: `Escorts en ${city.city}` },
          ...cityLinks,
        ]}
      />
    </>
  );
}
