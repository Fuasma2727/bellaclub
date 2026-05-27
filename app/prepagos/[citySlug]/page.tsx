import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrestadoresPage from "@/app/prestadores/page";
import {
  findProviderCityBySlug,
  getPublicProviderCities,
} from "@/lib/providerCitySeo";

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
  const description = `Encuentra perfiles aprobados en ${place}. Revisa galerias publicas y contacta directamente por WhatsApp en BelaClub.`;

  return {
    title,
    description,
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

  return (
    <PrestadoresPage
      initialCity={city.city}
      initialDepartment={city.department}
      pageTitle={`Prepagos en ${city.city}`}
      pageEyebrow="Prepagos por ciudad"
    />
  );
}
