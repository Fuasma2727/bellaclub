import type { Metadata } from "next";

import CatadorSignupInvite from "@/app/prestadores/_components/CatadorSignupInvite";
import JsonLd from "@/components/JsonLd";
import SupportAdvisors from "@/components/SupportAdvisors";
import { getPublicSupportAdvisors } from "@/lib/supportAdvisors.server";
import { targetSeoCities } from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import { toProviderListingCard } from "@/lib/providerListing";
import { providerSearchRoutes } from "@/lib/providerSearchRoutes";
import { siteHomeUrl, siteUrl } from "@/lib/siteUrl";
import PrestadoresClientPage from "./prestadores/PrestadoresClientPage";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: "BelaClub: Escorts verificadas",
  },
  description:
    "Explora escorts verificadas, prepagos, acompanantes y damas de compania en BelaClub. Revisa galerias publicas, contenido privado y contacto por WhatsApp.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "BelaClub: Escorts verificadas",
    description:
      "Escorts verificadas, prepagos y acompanantes con galerias publicas, contenido privado y contacto directo en BelaClub.",
    url: "/",
    siteName: "BelaClub",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BelaClub",
      },
    ],
    locale: "es_CO",
    type: "website",
  },
};

export default async function Home() {
  const [initialProviders, advisors] = await Promise.all([
    getPublicProviderCards({ limit: 60 }),
    getPublicSupportAdvisors(),
  ]);
  const cityLinks = targetSeoCities.flatMap((city) =>
    providerSearchRoutes
      .filter((route) => route.key === "escorts" || route.key === "prepagos")
      .map((route) => ({
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
          name: "BelaClub: Escorts verificadas",
          description:
            "Perfiles aprobados en BelaClub por ciudad, con galerias publicas, zonas disponibles y contacto por WhatsApp.",
          url: siteHomeUrl,
          isPartOf: {
            "@type": "WebSite",
            name: "BelaClub",
            url: siteHomeUrl,
          },
        }}
      />
      {advisors.length > 0 && (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "Organization",
            "@id": `${siteUrl}/#organization`,
            name: "BelaClub",
            url: siteHomeUrl,
            contactPoint: advisors.map((advisor) => ({
              "@type": "ContactPoint",
              name: advisor.name,
              telephone: advisor.phone,
              contactType: "customer support",
              availableLanguage: "Spanish",
              url: siteHomeUrl,
            })),
          }}
        />
      )}
      <PrestadoresClientPage
        filtersFirst
        pageTitle="BelaClub: Escorts verificadas"
        pageEyebrow=""
        pageDescription="Explora perfiles aprobados en Colombia con fotos públicas, zonas disponibles y contacto directo por WhatsApp."
        signupInvite={<CatadorSignupInvite />}
        initialProviders={initialProviders.map(toProviderListingCard)}
        seoCityLinks={cityLinks}
        supportContent={<SupportAdvisors advisors={advisors} />}
      />
    </>
  );
}
