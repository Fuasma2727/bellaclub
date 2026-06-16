import type { MetadataRoute } from "next";
import {
  citySlug,
  getPublicProviderCities,
  targetSeoCities,
} from "@/lib/providerCitySeo";
import { getPublicProviderCards } from "@/lib/publicProviders";

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

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
    {
      url: `${baseUrl}/prestadores`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/prepagos`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/escorts`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
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

  const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${baseUrl}/prestadores/${city.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: targetCitySlugs.has(city.slug) ? 0.9 : 0.75,
  }));
  const prepagosRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${baseUrl}/prepagos/${city.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: targetCitySlugs.has(city.slug) ? 0.98 : 0.8,
  }));
  const escortsRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${baseUrl}/escorts/${city.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: targetCitySlugs.has(city.slug) ? 0.98 : 0.8,
  }));
  const profileRoutes: MetadataRoute.Sitemap = providers.map((provider) => ({
    url: `${baseUrl}${provider.profilePath}`,
    lastModified: provider.updatedAt ? new Date(provider.updatedAt) : now,
    changeFrequency: "weekly",
    priority: targetCitySlugs.has(citySlug(provider.city || ""))
      ? 0.86
      : 0.72,
  }));

  return [
    ...staticRoutes,
    ...cityRoutes,
    ...prepagosRoutes,
    ...escortsRoutes,
    ...profileRoutes,
  ];
}
