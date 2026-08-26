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
import {
  getProviderPhonePath,
  getPublicProviderCards,
} from "@/lib/publicProviders";
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

const formatList = (items: string[]) => {
  if (items.length <= 1) return items[0] || "";

  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
};

const routeIntentFallback: Record<ProviderSearchRouteKey, string> = {
  escorts:
    "Esta categoria ayuda a revisar perfiles activos por ciudad, zona y contacto directo, con una lectura rapida desde movil.",
  prepagos:
    "Esta busqueda se organiza para comparar perfiles aprobados, fotos publicas y zonas disponibles dentro de la misma ciudad.",
  acompanantes:
    "La pagina conecta busquedas de acompanantes con perfiles visibles y datos practicos de ubicacion.",
  "damas-de-compania":
    "La vista agrupa perfiles aprobados para quienes buscan damas de compania por ciudad y zonas cercanas.",
  chicas:
    "La categoria sirve para explorar perfiles activos con fotos publicas, ubicacion y contacto directo.",
  masajistas:
    "La pagina ordena perfiles por ciudad para que la busqueda sea mas precisa y menos repetitiva.",
  universitarias:
    "La vista concentra perfiles visibles y relacionados con busquedas locales dentro de BelaClub.",
  putas:
    "La pagina conecta esta busqueda con perfiles visibles y categorias relacionadas como escorts y prepagos.",
};

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
  route: ProviderSearchRoute,
  city: ProviderCitySeo,
  place: string,
  profileCount: number,
  relatedSearchText: string
): CityFaq[] => {
  const profileText =
    profileCount > 0
      ? `${profileCount} perfiles visibles y aprobados`
      : "perfiles visibles y aprobados cuando esten disponibles";
  const zonesText =
    city.zones && city.zones.length > 0
      ? formatList(city.zones.slice(0, 5))
      : "las zonas disponibles en cada perfil";
  const nearbyText =
    city.nearbyCities && city.nearbyCities.length > 0
      ? `Tambien puedes revisar busquedas cercanas en ${formatList(
          city.nearbyCities.slice(0, 4)
        )}.`
      : "Tambien puedes revisar otras ciudades disponibles dentro de BelaClub.";

  return [
    {
      question: `Donde encontrar ${route.pluralNoun} en ${city.city}?`,
      answer: `En BelaClub puedes revisar ${profileText} en ${place}. La pagina prioriza perfiles activos, fotos publicas y contacto directo por WhatsApp.`,
    },
    {
      question: `Que zonas de ${city.city} se pueden revisar?`,
      answer: `Las busquedas se organizan alrededor de ${zonesText}. ${nearbyText}`,
    },
    {
      question: `La pagina de ${route.title} en ${city.city} se actualiza?`,
      answer:
        "Si. La pagina usa los perfiles activos, visibles y aprobados dentro de BelaClub, por eso el listado puede cambiar cuando se aprueban, pausan o actualizan perfiles.",
    },
    {
      question: `Tambien sirve para buscar ${relatedSearchText} en ${city.city}?`,
      answer:
        "Si. BelaClub conecta busquedas relacionadas con paginas filtradas por ciudad para que el usuario pueda comparar categorias sin salir del contexto local.",
    },
  ];
};

const buildCityContentParagraphs = ({
  route,
  city,
  profileCount,
  relatedSearchText,
}: {
  route: ProviderSearchRoute;
  city: ProviderCitySeo;
  profileCount: number;
  relatedSearchText: string;
}) => {
  const routeNote = city.routeNotes?.[route.key] || routeIntentFallback[route.key];
  const zonesText =
    city.zones && city.zones.length > 0
      ? `Zonas utiles para comparar: ${formatList(city.zones.slice(0, 6))}.`
      : "";
  const profileText =
    profileCount > 0
      ? `Actualmente se muestran ${profileCount} perfiles activos en ${city.city}; el listado cambia cuando un perfil se aprueba, se pausa o actualiza su informacion.`
      : `Esta pagina queda preparada para mostrar perfiles activos en ${city.city} tan pronto sean aprobados y visibles dentro de BelaClub.`;

  return uniqueTexts([
    city.seoIntro || "",
    city.localContext || "",
    routeNote,
    profileText,
    zonesText,
    city.mobilityContext || "",
    `Tambien se conectan busquedas relacionadas como ${relatedSearchText}, manteniendo el foco principal en perfiles de ${city.city}.`,
    city.trustContext || "",
  ]);
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
  const relatedSearchText = getRelatedProviderSearchText(route.key);
  const faqs = buildCityFaqs(
    route,
    city,
    place,
    cityProviders.length,
    relatedSearchText
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
  const searchTerms = buildCitySearchTerms(route, city);
  const cityContentParagraphs = buildCityContentParagraphs({
    route,
    city,
    profileCount: cityProviders.length,
    relatedSearchText,
  });

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
                const phonePath = getProviderPhonePath(provider);

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
                    sameAs: phonePath ? [`${siteUrl}${phonePath}`] : undefined,
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
          heading: `${route.title} en ${city.city}: perfiles, zonas y contexto local`,
          paragraphs: cityContentParagraphs,
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
