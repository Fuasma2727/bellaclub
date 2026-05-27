import type { MetadataRoute } from "next";
import { getPublicProviderCities } from "@/lib/providerCitySeo";

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const now = new Date();
  const cities = await getPublicProviderCities();

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
  ];

  const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${baseUrl}/prestadores/${city.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.85,
  }));
  const prepagosRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${baseUrl}/prepagos/${city.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));
  const escortsRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
    url: `${baseUrl}/escorts/${city.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [...staticRoutes, ...cityRoutes, ...prepagosRoutes, ...escortsRoutes];
}
