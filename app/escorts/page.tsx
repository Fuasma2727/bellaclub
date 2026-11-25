import type { Metadata } from "next";
import CatadorSignupInvite from "@/app/prestadores/_components/CatadorSignupInvite";
import PrestadoresPage from "@/app/prestadores/page";
import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import { providerSearchRoutes } from "@/lib/providerSearchRoutes";
import { absoluteSiteUrl, siteHomeUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

const pageTitle = "Escorts verificadas en Rionegro, Medellín y La Ceja";
const pageDescription =
  "Compara perfiles verificados en Rionegro, Medellín y La Ceja. Revisa fotos, tarifas y zonas por ciudad y contacta directamente por WhatsApp.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/escorts",
  },
  openGraph: {
    title: `${pageTitle} | BelaClub`,
    description: pageDescription,
    url: "/escorts",
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
    title: `${pageTitle} | BelaClub`,
    description: pageDescription,
    images: ["/og-image.png"],
  },
};

export default async function EscortsPage() {
  const pageUrl = absoluteSiteUrl("/escorts");
  const initialProviders = await getPublicProviderCards({ limit: 60 });
  const cityLinks = targetSeoCities.map((city) => ({
    href: `/escorts/${city.slug}`,
    label: `Escorts en ${city.city}`,
  }));
  const relatedCitySearchLinks = targetSeoCities.flatMap((city) =>
    providerSearchRoutes.map((route) => ({
      href: `/${route.segment}/${city.slug}`,
      label: `${route.title} en ${city.city}`,
    }))
  );

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: pageTitle,
          description: pageDescription,
          url: pageUrl,
          isPartOf: {
            "@type": "WebSite",
            name: "BelaClub",
            url: siteHomeUrl,
          },
        }}
      />
      <PrestadoresPage
        filtersFirst
        signupInvite={<CatadorSignupInvite />}
        pageTitle={pageTitle}
        pageDescription={pageDescription}
        initialProviders={initialProviders}
        seoCityLinks={[
          ...cityLinks,
          ...targetSeoCities.map((city) => ({
            href: `/prepagos/${city.slug}`,
            label: `Prepagos en ${city.city}`,
          })),
        ]}
        seoContent={{
          heading: "Qué puedes revisar en un perfil",
          paragraphs: [
            "En cada ficha puedes ver fotos públicas y, si están publicadas, la tarifa y la zona. Si una tarjeta muestra un distintivo, púlsalo para conocer el tipo de verificación del perfil.",
            "En Rionegro puedes comparar perfiles de zonas como San Antonio de Pereira, el Centro y Llanogrande. También puedes consultar los listados de Bello y Zipaquirá desde los enlaces por ciudad.",
          ],
          zones: [
            "Rionegro",
            "San Antonio de Pereira",
            "Llanogrande",
            "Centro",
            "Medellín",
            "La Ceja",
            "Bello",
            "Zipaquirá",
          ],
          relatedLinks: relatedCitySearchLinks,
        }}
      />
    </>
  );
}
