import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import {
  findProviderCityBySlug,
  targetSeoCities,
  type ProviderCitySeo,
} from "@/lib/providerCitySeo";
import { getPhoneSeoValues } from "@/lib/providerPhoneSeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import {
  getRelatedProviderSearchText,
  getProviderSearchKeywords,
  type ProviderSearchRoute,
  providerSearchRoutes,
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

type CityFaq = {
  question: string;
  answer: string;
};

const uniqueTexts = (items: string[]) =>
  Array.from(new Set(items.filter(Boolean)));

const rionegroFocusRouteKeys = new Set<ProviderSearchRouteKey>([
  "escorts",
  "prepagos",
  "putas",
]);

const isRionegroFocusRoute = (
  routeKey: ProviderSearchRouteKey,
  citySlug: string
) => citySlug === "rionegro" && rionegroFocusRouteKeys.has(routeKey);

const buildCityMetaTitle = (
  route: ProviderSearchRoute,
  city: ProviderCitySeo
) => {
  const title = `${route.title} en ${city.city}`;

  if (isRionegroFocusRoute(route.key, city.slug)) {
    return `${route.title} ${city.city} | ${title}`;
  }

  return `${title} | Perfiles aprobados`;
};

const buildCityMetaDescription = (
  route: ProviderSearchRoute,
  city: ProviderCitySeo,
  place: string
) => {
  if (isRionegroFocusRoute(route.key, city.slug)) {
    return `Encuentra ${route.pluralNoun} en ${place}: perfiles aprobados, fotos publicas, zonas como San Antonio de Pereira, Centro y Llanogrande, y contacto directo por WhatsApp. Busquedas relacionadas: escorts rionegro, escorts en rionegro, prepagos rionegro y putas rionegro en BelaClub.`;
  }

  const relatedSearchText = getRelatedProviderSearchText(route.key);

  return `Encuentra perfiles de ${route.pluralNoun} en ${place}. Revisa fotos públicas, zonas disponibles y contacto por WhatsApp en BelaClub. También puedes explorar ${relatedSearchText} en ${city.city}.`;
};

const buildCitySearchTerms = (
  route: ProviderSearchRoute,
  city: ProviderCitySeo
) =>
  uniqueTexts([
    `${route.title} en ${city.city}`,
    `${route.title} ${city.city}`,
    `${route.pluralNoun} en ${city.city}`,
    `${route.pluralNoun} ${city.city}`,
    ...(city.searchFocus || []),
    `escorts en ${city.city}`,
    `escorts ${city.city}`,
    `prepagos en ${city.city}`,
    `prepagos ${city.city}`,
    `putas en ${city.city}`,
    `putas ${city.city}`,
    `acompanantes en ${city.city}`,
    `damas de compania en ${city.city}`,
    `chicas en ${city.city}`,
    `masajistas en ${city.city}`,
    `universitarias en ${city.city}`,
  ]);

const buildCityFaqs = (
  routeTitle: string,
  routePluralNoun: string,
  cityName: string,
  place: string,
  profileCount: number
): CityFaq[] => {
  const profileText =
    profileCount > 0
      ? `${profileCount} perfiles visibles y aprobados`
      : "perfiles visibles y aprobados cuando esten disponibles";

  return [
    {
      question: `Donde encontrar ${routePluralNoun} en ${cityName}?`,
      answer: `En BelaClub puedes revisar ${profileText} en ${place}, filtrar por ciudad o zona cuando este disponible y abrir cada perfil para ver fotos publicas y opciones de contacto.`,
    },
    {
      question: `La pagina de ${routeTitle} en ${cityName} se actualiza?`,
      answer:
        "Si. La pagina usa los perfiles activos, visibles y aprobados dentro de BelaClub, por eso el listado puede cambiar cuando se aprueban, pausan o actualizan perfiles.",
    },
    {
      question: `Tambien sirve para buscar escorts, prepagos o putas en ${cityName}?`,
      answer: `Si. BelaClub conecta busquedas relacionadas como escorts, prepagos, putas, acompanantes, damas de compania, chicas, masajistas y universitarias en ${cityName} con paginas filtradas por ciudad.`,
    },
  ];
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
  const description = buildCityMetaDescription(route, city, place);
  const keywords = uniqueTexts([
    ...getProviderSearchKeywords(route, city.city),
    ...(city.searchFocus || []),
  ]);

  return {
    title: buildCityMetaTitle(route, city),
    description,
    keywords,
    alternates: {
      canonical: `/${route.segment}/${city.slug}`,
    },
    openGraph: {
      title: `${title} | BelaClub`,
      description,
      url: `/${route.segment}/${city.slug}`,
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
  const place = city.department
    ? `${city.city}, ${city.department}`
    : city.city;
  const pageUrl = `${siteUrl}/${route.segment}/${city.slug}`;
  const keywords = uniqueTexts([
    ...getProviderSearchKeywords(route, city.city),
    ...(city.searchFocus || []),
  ]);
  const cityProviders = await getPublicProviderCards({ citySlug: city.slug });
  const faqs = buildCityFaqs(
    route.title,
    route.pluralNoun,
    city.city,
    place,
    cityProviders.length
  );
  const relatedRoutes = targetSeoCities
    .filter((item) => item.slug !== city.slug)
    .slice(0, 6);
  const sameCityLinks = providerSearchRoutes
    .filter((item) => item.key !== route.key)
    .map((item) => ({
      href: `/${item.segment}/${city.slug}`,
      label: `${item.title} en ${city.city}`,
    }));
  const relatedCityLinks = relatedRoutes.map((item) => ({
    href: `/${route.segment}/${item.slug}`,
    label: `${route.title} en ${item.city}`,
  }));
  const cityDescription = isRionegroFocusRoute(route.key, city.slug)
    ? `Perfiles aprobados en Rionegro, Antioquia, para busquedas como escorts rionegro, escorts en rionegro, prepagos rionegro y putas rionegro, con fotos publicas, zonas disponibles y contacto directo por WhatsApp en BelaClub.`
    : `Perfiles aprobados en ${city.city}${
        city.department ? `, ${city.department}` : ""
      }, con fotos publicas, zonas disponibles y contacto directo por WhatsApp en BelaClub.`;
  const cityIntro =
    city.seoIntro ||
    `BelaClub organiza perfiles aprobados en ${city.city} para facilitar busquedas por ciudad, zonas disponibles y contacto directo.`;
  const searchTerms = buildCitySearchTerms(route, city);
  const relatedSearchText = getRelatedProviderSearchText(route.key);
  const rionegroFocusText = isRionegroFocusRoute(route.key, city.slug)
    ? "En Rionegro muchos usuarios comparan opciones en San Antonio de Pereira, Centro, Llanogrande y el sector del aeropuerto. Por eso esta vista mantiene el foco en perfiles visibles de la ciudad y categorias relacionadas."
    : "";
  const nearbyText =
    city.nearbyCities && city.nearbyCities.length > 0
      ? `Tambien se conectan busquedas cercanas desde ${city.nearbyCities.join(
          ", "
        )}, manteniendo el foco principal en perfiles de ${city.city}.`
      : "";

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description: `${route.title} con perfiles aprobados en ${city.city}${
              city.department ? `, ${city.department}` : ""
            }, fotos públicas, zonas disponibles y contacto por WhatsApp dentro de BelaClub. Búsquedas relacionadas: ${relatedSearchText}.`,
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
            spatialCoverage: {
              "@type": "City",
              name: city.city,
              containedInPlace: city.department
                ? {
                    "@type": "AdministrativeArea",
                    name: city.department,
                  }
                : undefined,
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
              .map((provider, index) => {
                const phoneSeo = getPhoneSeoValues(provider.whatsapp);

                return {
                  "@type": "ListItem",
                  position: index + 1,
                  name: phoneSeo.canonicalDigits
                    ? `${provider.name || `Perfil en ${city.city}`} WhatsApp ${phoneSeo.canonicalDigits}`
                    : provider.name || `Perfil en ${city.city}`,
                  url: `${siteUrl}${provider.profilePath}`,
                  item: {
                    "@type": "Person",
                    name: provider.name || `Perfil en ${city.city}`,
                    telephone:
                      phoneSeo.formattedInternational ||
                      phoneSeo.raw ||
                      undefined,
                    identifier: phoneSeo.canonicalDigits || undefined,
                    url: `${siteUrl}${provider.profilePath}`,
                  },
                };
              }),
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
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.question,
              acceptedAnswer: {
                "@type": "Answer",
                text: faq.answer,
              },
            })),
          },
        ]}
      />
      <PrestadoresPage
        initialCity={city.city}
        initialDepartment={city.department}
        pageTitle={title}
        pageEyebrow={`${route.label} por ciudad`}
        pageDescription={cityDescription}
        seoCityLinks={sameCityLinks.slice(0, 6)}
        initialProviders={cityProviders}
        seoContent={{
          heading: `${route.title} en ${city.city}: perfiles y busquedas relacionadas`,
          paragraphs: [
            cityIntro,
            cityProviders.length > 0
              ? `Actualmente se muestran ${cityProviders.length} perfiles activos para ${city.city}. El listado se alimenta de perfiles aprobados, visibles y actualizados dentro de BelaClub.`
              : `Esta pagina queda preparada para mostrar perfiles activos en ${city.city} tan pronto sean aprobados y visibles dentro de BelaClub.`,
            rionegroFocusText,
            `En esta pagina se agrupan perfiles de ${route.pluralNoun} en ${city.city} junto con busquedas relacionadas como ${relatedSearchText}.`,
            nearbyText,
            `La disponibilidad de perfiles en ${city.city} se mantiene alineada con los perfiles activos y aprobados dentro de BelaClub.`,
          ].filter(Boolean),
          searchTerms,
          faqs,
          zones: city.zones,
          relatedLinks: [...sameCityLinks, ...relatedCityLinks],
        }}
        showPageIntro={false}
      />
    </>
  );
}
