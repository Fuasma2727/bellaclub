import type { Metadata } from "next";

import JsonLd from "@/components/JsonLd";
import { targetSeoCities } from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import { providerSearchRoutes } from "@/lib/providerSearchRoutes";
import PrestadoresClientPage from "./prestadores/PrestadoresClientPage";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

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
  const initialProviders = await getPublicProviderCards({ limit: 60 });
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
          url: `${siteUrl}/`,
          isPartOf: {
            "@type": "WebSite",
            name: "BelaClub",
            url: siteUrl,
          },
        }}
      />
      <PrestadoresClientPage
        pageTitle="BelaClub: Escorts verificadas"
        pageEyebrow="Perfiles activos"
        pageDescription="Explora perfiles aprobados en Colombia con fotos publicas, zonas disponibles y contacto directo por WhatsApp."
        initialProviders={initialProviders}
        seoCityLinks={cityLinks}
      />
    </>
  );
}
