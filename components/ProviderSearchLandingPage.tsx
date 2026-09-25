import type { Metadata } from "next";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import {
  getRelatedProviderSearchText,
  getProviderSearchKeywords,
  providerSearchRoutes,
  providerSearchRoutesByKey,
  type ProviderSearchRouteKey,
} from "@/lib/providerSearchRoutes";
import { absoluteSiteUrl, siteHomeUrl } from "@/lib/siteUrl";

type LandingContent = {
  paragraphs: string[];
  searchTerms: string[];
  faqs: {
    question: string;
    answer: string;
  }[];
};

const uniqueTexts = (items: string[]) =>
  Array.from(new Set(items.filter(Boolean)));

const defaultLandingContent: LandingContent = {
  paragraphs: [
    "BelaClub separa cada busqueda por ciudad para que los usuarios puedan revisar perfiles activos, zonas disponibles, fotos publicas y contacto directo sin mezclar resultados de todo el pais.",
    "Las paginas de ciudad ayudan a comparar opciones cercanas, revisar perfiles aprobados y pasar de una busqueda amplia a un listado local con mayor contexto.",
  ],
  searchTerms: [
    "escorts rionegro",
    "prepagos rionegro",
    "putas rionegro",
    "escorts medellin",
    "prepagos medellin",
    "escorts la ceja",
  ],
  faqs: [
    {
      question: "Como se ordenan los perfiles en BelaClub?",
      answer:
        "La pagina muestra perfiles publicos, aprobados y activos, con prioridad para disponibilidad, ciudad, galeria publica y datos utiles de contacto.",
    },
    {
      question: "Por que hay paginas por ciudad?",
      answer:
        "Las busquedas locales suelen depender de zona y desplazamiento, por eso BelaClub conecta cada categoria con paginas especificas de ciudad.",
    },
  ],
};

const landingContentByRoute: Partial<
  Record<ProviderSearchRouteKey, LandingContent>
> = {
  putas: {
    paragraphs: [
      "La busqueda de putas en Colombia se organiza en BelaClub como una entrada hacia perfiles visibles por ciudad, con foco en datos practicos y resultados locales.",
      "Rionegro, Medellin y La Ceja tienen enlaces propios para que la busqueda no dependa de una lista generica. Cada pagina local muestra perfiles aprobados cuando estan activos y disponibles.",
      "Tambien se conectan categorias relacionadas como escorts y prepagos para mantener una navegacion coherente si el usuario cambia la intencion de busqueda.",
    ],
    searchTerms: [
      "putas rionegro",
      "putas en rionegro",
      "putas medellin",
      "putas la ceja",
      "escorts rionegro",
      "prepagos rionegro",
    ],
    faqs: [
      {
        question: "Que encuentra un usuario en la pagina de putas?",
        answer:
          "Encuentra una ruta para revisar perfiles aprobados por ciudad, con enlaces hacia busquedas locales y categorias relacionadas dentro de BelaClub.",
      },
      {
        question: "La pagina muestra perfiles reales?",
        answer:
          "Si. Los listados usan perfiles publicos, aprobados y activos; cuando una cuenta se pausa o deja de estar visible, sale del listado publico.",
      },
      {
        question: "Por que aparecen enlaces a escorts y prepagos?",
        answer:
          "Porque muchas busquedas son cercanas entre si. Los enlaces relacionados ayudan a llegar a la pagina local mas precisa sin duplicar contenido.",
      },
    ],
  },
  acompanantes: {
    paragraphs: [
      "La pagina de acompanantes agrupa busquedas amplias y las lleva hacia ciudades concretas, donde es mas facil comparar perfiles, zonas y contacto.",
      "BelaClub prioriza perfiles aprobados y visibles, con enlaces hacia busquedas relacionadas como escorts, prepagos y damas de compania por ciudad.",
    ],
    searchTerms: [
      "acompanantes rionegro",
      "acompanantes medellin",
      "acompanantes la ceja",
      "escorts rionegro",
      "prepagos medellin",
    ],
    faqs: defaultLandingContent.faqs,
  },
  "damas-de-compania": {
    paragraphs: [
      "La pagina de damas de compania conecta una busqueda amplia con perfiles por ciudad, zonas cercanas y categorias relacionadas dentro de BelaClub.",
      "El objetivo es que el usuario llegue a una pagina local con perfiles activos en vez de navegar un listado sin contexto.",
    ],
    searchTerms: [
      "damas de compania rionegro",
      "damas de compania medellin",
      "damas de compania la ceja",
      "acompanantes medellin",
      "escorts rionegro",
    ],
    faqs: defaultLandingContent.faqs,
  },
};

export async function generateProviderSearchLandingMetadata(
  routeKey: ProviderSearchRouteKey
): Promise<Metadata> {
  const route = providerSearchRoutesByKey[routeKey];
  const description = `Encuentra perfiles de ${route.pluralNoun} en Rionegro, Medellín, La Ceja y otras ciudades de Colombia. Revisa fotos públicas, zonas disponibles y contacto por WhatsApp en BelaClub.`;

  return {
    title: route.baseTitle,
    description,
    keywords: [
      ...getProviderSearchKeywords(route, "Colombia"),
      `${route.pluralNoun} Rionegro`,
      `${route.pluralNoun} en Rionegro`,
      "escorts rionegro",
      "escorts en rionegro",
      "prepagos rionegro",
      "putas rionegro",
    ],
    alternates: {
      canonical: `/${route.segment}`,
    },
    openGraph: {
      title: `${route.baseTitle} | BelaClub`,
      description,
      url: `/${route.segment}`,
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
      title: `${route.baseTitle} | BelaClub`,
      description,
      images: ["/og-image.png"],
    },
  };
}

export default async function ProviderSearchLandingPage({
  routeKey,
}: {
  routeKey: ProviderSearchRouteKey;
}) {
  const route = providerSearchRoutesByKey[routeKey];
  const relatedSearchText = getRelatedProviderSearchText(routeKey);
  const initialProviders = await getPublicProviderCards({ limit: 60 });
  const pageUrl = `${siteUrl}/${route.segment}`;
  const cityLinks = targetSeoCities.map((city) => ({
    href: `/${route.segment}/${city.slug}`,
    label: `${route.title} en ${city.city}`,
  }));
  const relatedCitySearchLinks = targetSeoCities.flatMap((city) =>
    providerSearchRoutes.map((item) => ({
      href: `/${item.segment}/${city.slug}`,
      label: `${item.title} en ${city.city}`,
    }))
  );
  const searchTerms = [
    `${route.title} Rionegro`,
    `${route.title} en Rionegro`,
    "escorts rionegro",
    "escorts en rionegro",
    "prepagos rionegro",
    "putas rionegro",
  ];

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: route.baseTitle,
          description: `Perfiles aprobados de ${route.pluralNoun} por ciudad dentro de BelaClub, con búsquedas relacionadas de ${relatedSearchText}.`,
          url: pageUrl,
          isPartOf: {
            "@type": "WebSite",
            name: "BelaClub",
            url: siteUrl,
          },
        }}
      />
      <PrestadoresPage
        pageTitle={route.baseTitle}
        pageEyebrow="Explora por ciudad"
        pageDescription={`Encuentra perfiles de ${route.pluralNoun} por ciudad. Revisa galerías públicas, filtra por departamento o ciudad y contacta directamente por WhatsApp.`}
        initialProviders={initialProviders}
        seoCityLinks={cityLinks}
        seoContent={{
          heading: `${route.title} por ciudad en BelaClub`,
          paragraphs: [
            `BelaClub organiza perfiles aprobados de ${route.pluralNoun} por ciudad para que puedas revisar opciones activas, fotos publicas, zonas disponibles y contacto directo por WhatsApp.`,
            `También puedes explorar búsquedas relacionadas de ${relatedSearchText} en las ciudades principales de BelaClub.`,
            "En Rionegro se conectan busquedas frecuentes del oriente antioqueño como escorts rionegro, escorts en rionegro, prepagos rionegro y putas rionegro.",
          ],
          zones: [
            "Rionegro",
            "San Antonio de Pereira",
            "Llanogrande",
            "Centro",
            "La Ceja",
            "Medellín",
          ],
          searchTerms,
          relatedLinks: relatedCitySearchLinks,
        }}
      />
    </>
  );
}
