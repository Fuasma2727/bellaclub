import type { MetadataRoute } from "next";
import {
  citySlug,
  getProviderCityPriority,
  getPublicProviderCities,
  targetSeoCities,
} from "@/lib/providerCitySeo";
import {
  getProviderPhonePath,
  getPublicProviderCards,
} from "@/lib/publicProviders";
import { providerSearchRoutes } from "@/lib/providerSearchRoutes";

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export const dynamic = "force-dynamic";

const rionegroFocusRouteKeys = new Set(["escorts", "prepagos", "putas"]);

const getSearchCityRoutePriority = (
  routeKey: string,
  city: { slug: string }
) => {
  if (city.slug === "rionegro") {
    return rionegroFocusRouteKeys.has(routeKey) ? 1 : 0.96;
  }

  const cityPriority = getProviderCityPriority(city.slug);

  if (cityPriority >= 0.85) {
    return routeKey === "escorts" ? 0.96 : 0.9;
  }

  return routeKey === "escorts" ? 0.84 : 0.8;
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();
  const cities = await getPublicProviderCities();
  const providers = await getPublicProviderCards();
  const targetCitySlugs = new Set(targetSeoCities.map((city) => city.slug));

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...providerSearchRoutes.map((route) => ({
      url: `${baseUrl}/${route.segment}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: route.key === "escorts" ? 1 : 0.9,
    })),
    {
      url: `${baseUrl}/terminos`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/privacidad`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/seguridad`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/reembolsos`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/soporte`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];

  const searchCityRoutes: MetadataRoute.Sitemap = providerSearchRoutes.flatMap(
    (route) =>
      cities.map((city) => ({
        url: `${baseUrl}/${route.segment}/${city.slug}`,
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: getSearchCityRoutePriority(route.key, city),
      }))
  );
  const profileRoutes: MetadataRoute.Sitemap = providers.map((provider) => ({
    url: `${baseUrl}${provider.profilePath}`,
    lastModified: provider.updatedAt ? new Date(provider.updatedAt) : now,
    changeFrequency: "weekly",
    priority:
      citySlug(provider.city || "") === "rionegro"
        ? 0.9
        : targetCitySlugs.has(citySlug(provider.city || ""))
          ? 0.84
          : 0.72,
  }));
  const phoneRouteMap = new Map<string, MetadataRoute.Sitemap[number]>();

  providers.forEach((provider) => {
    const phonePath = getProviderPhonePath(provider);

    if (!phonePath || phoneRouteMap.has(phonePath)) return;

    phoneRouteMap.set(phonePath, {
      url: `${baseUrl}${phonePath}`,
      lastModified: provider.updatedAt ? new Date(provider.updatedAt) : now,
      changeFrequency: "weekly",
      priority:
        citySlug(provider.city || "") === "rionegro"
          ? 0.86
          : targetCitySlugs.has(citySlug(provider.city || ""))
            ? 0.8
            : 0.68,
    });
  });

  return [
    ...staticRoutes,
    ...searchCityRoutes,
    ...profileRoutes,
    ...phoneRouteMap.values(),
  ];
}
