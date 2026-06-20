import PrestadoresPage from "./PrestadoresClientPage";
import JsonLd from "@/components/JsonLd";
import {
  getPublicProviderCities,
  targetSeoCities,
} from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";
import { providerSearchRoutes } from "@/lib/providerSearchRoutes";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export const revalidate = 300;

const cityPriority = (slug: string) => {
  const index = targetSeoCities.findIndex((city) => city.slug === slug);
  return index === -1 ? 99 : index;
};

export default async function PrestadoresIndexPage() {
  const [initialProviders, cities] = await Promise.all([
    getPublicProviderCards(),
    getPublicProviderCities(),
  ]);

  const sortedCities = [...cities].sort((a, b) => {
    const priority = cityPriority(a.slug) - cityPriority(b.slug);

    if (priority !== 0) return priority;

    return a.city.localeCompare(b.city, "es");
  });
  const relatedLinks = sortedCities.flatMap((city) =>
    providerSearchRoutes.map((route) => ({
      href: `/${route.segment}/${city.slug}`,
      label: `${route.title} ${city.city}`,
    }))
  );

  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: "Escorts verificadas en BelaClub",
            description:
              "Perfiles aprobados por ciudad en BelaClub, con galerias publicas, zonas disponibles y contacto directo por WhatsApp.",
            url: `${siteUrl}/prestadores`,
            isPartOf: {
              "@type": "WebSite",
              name: "BelaClub",
              url: siteUrl,
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Perfiles aprobados en BelaClub",
            itemListElement: initialProviders
              .slice(0, 30)
              .map((provider, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: provider.name || "Perfil en BelaClub",
                url: `${siteUrl}${provider.profilePath}`,
              })),
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: "Busquedas por ciudad en BelaClub",
            itemListElement: relatedLinks
              .slice(0, 80)
              .map((link, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: link.label,
                url: `${siteUrl}${link.href}`,
              })),
          },
        ]}
      />
      <PrestadoresPage
        initialProviders={initialProviders}
        pageTitle="Escorts verificadas en BelaClub"
        pageDescription="Explora escorts, prepagos, acompanantes, damas de compania, chicas, masajistas y universitarias por ciudad. Revisa perfiles aprobados, fotos publicas y contacto directo por WhatsApp."
        showPageIntro={false}
        seoContent={{
          heading: "Escorts, prepagos y acompanantes por ciudad",
          paragraphs: [
            "BelaClub organiza perfiles aprobados por ciudad para busquedas como escorts Medellin, prepagos La Ceja, escorts La Ceja, acompanantes Rionegro, damas de compania, chicas, masajistas y universitarias.",
            "Las paginas por ciudad muestran perfiles disponibles, fotos publicas, zona, precio base y contacto por WhatsApp cuando esta disponible.",
          ],
          zones: sortedCities.slice(0, 12).map((city) => city.city),
          relatedLinks,
        }}
      />
    </>
  );
}
