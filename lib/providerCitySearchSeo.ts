import type { ProviderCitySeo } from "@/lib/providerCitySeo";
import { providerSearchRoutes } from "@/lib/providerSearchRoutes";

type CitySearchSeoOptions = {
  city: ProviderCitySeo;
  routeTitle: string;
  routeSegment: string;
  pluralNoun: string;
};

export function getCitySearchSeoContent({
  city,
  routeTitle,
  routeSegment,
  pluralNoun,
}: CitySearchSeoOptions) {
  const isLaCeja = city.slug === "la-ceja";
  const place = city.department ? `${city.city}, ${city.department}` : city.city;
  const cityLinks = providerSearchRoutes.map((route) => ({
    href: `/${route.segment}/${city.slug}`,
    label: `${route.title} ${city.city}`,
  }));
  const nearbyLinks =
    city.slug === "la-ceja"
      ? [
          { href: `/${routeSegment}/rionegro`, label: `${routeTitle} Rionegro` },
          { href: `/${routeSegment}/medellin`, label: `${routeTitle} Medellin` },
        ]
      : [];

  if (isLaCeja) {
    return {
      heading: `${routeTitle} La Ceja y perfiles en el Oriente Antioqueno`,
      paragraphs: [
        `BelaClub organiza perfiles aprobados para busquedas como ${pluralNoun} La Ceja, ${pluralNoun} en La Ceja, ${pluralNoun} La Ceja BelaClub y perfiles en el Oriente Antioqueno.`,
        `La pagina muestra perfiles visibles en ${place}, con fotos publicas, zona, precio base y contacto directo por WhatsApp cuando esta disponible.`,
      ],
      zones: ["La Ceja", "Centro", "Oriente Antioqueno", "Rionegro cercano"],
      relatedLinks: [...cityLinks, ...nearbyLinks],
    };
  }

  return {
    heading: `${routeTitle} en ${city.city}`,
    paragraphs: [
      `Explora perfiles aprobados de ${pluralNoun} en ${place}, con filtros por ciudad, zona y ubicacion disponible.`,
      `BelaClub actualiza esta pagina con perfiles visibles y enlaces a busquedas relacionadas por ciudad.`,
    ],
    zones: city.zones || [],
    relatedLinks: cityLinks,
  };
}
