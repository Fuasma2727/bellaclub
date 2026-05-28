import type { MetadataRoute } from "next";

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/prestadores",
          "/prepagos",
          "/escorts",
          "/terminos",
          "/privacidad",
          "/seguridad",
        ],
        disallow: [
          "/admin/",
          "/api/",
          "/dashboard",
          "/prestador/",
          "/usuario/",
          "/login",
          "/register",
          "/wompi/",
        ],
      },
    ],
    sitemap: `${getBaseUrl()}/sitemap.xml`,
  };
}
