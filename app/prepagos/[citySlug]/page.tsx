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
  const description = `Encuentra prepagos en ${place}. Revisa perfiles aprobados, galerías públicas, zonas disponibles y contacto directo por WhatsApp en BelaClub.`;

  return {
    title: `${title} | Perfiles aprobados en BelaClub`,
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
            description: `Prepagos con perfiles aprobados en ${city.city}${
              city.department ? `, ${city.department}` : ""
            }, galerías públicas, zonas disponibles y contacto por WhatsApp dentro de BelaClub.`,
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
        ]}
      />
      <PrestadoresPage
        initialCity={city.city}
        initialDepartment={city.department}
        pageTitle={`Prepagos en ${city.city}`}
        pageEyebrow="Prepagos por ciudad"
        pageDescription={`Explora prepagos verificadas en ${city.city}${
          city.department ? `, ${city.department}` : ""
        }. Revisa perfiles aprobados, galerías públicas, video del día y contacto directo por WhatsApp.`}
        seoCityLinks={[
          { href: `/escorts/${city.slug}`, label: `Escorts en ${city.city}` },
          ...cityLinks,
        ]}
        seoContent={{
          heading: `Prepagos en ${city.city}: perfiles por ciudad y zonas`,
          paragraphs: [
            city.seoIntro ||
              `En BelaClub puedes explorar prepagos en ${city.city} con perfiles aprobados, galería pública y contacto directo por WhatsApp.`,
            `Esta página está pensada para búsquedas como prepagos ${city.city}, prepagos en ${city.city}, escorts ${city.city} y perfiles verificados en ${city.city}.`,
            "BelaClub permite revisar fotos públicas, ubicación, precio base, video del día cuando esté disponible y opciones de contenido privado dentro de una experiencia segura.",
          ],
          zones: city.zones,
          relatedLinks: [
            { href: `/escorts/${city.slug}`, label: `Escorts en ${city.city}` },
            { href: `/prestadores/${city.slug}`, label: `Prestadores en ${city.city}` },
            ...cityLinks,
          ],
        }}
      />
    </>
  );
}
