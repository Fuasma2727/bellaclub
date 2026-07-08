import type { MetadataRoute } from "next";

const getBaseUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/prepagos",
          "/escorts",
          "/acompanantes",
          "/damas-de-compania",
          "/chicas",
          "/masajistas",
          "/universitarias",
          "/putas",
          "/terminos",
          "/privacidad",
          "/seguridad",
          "/reembolsos",
          "/soporte",
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
