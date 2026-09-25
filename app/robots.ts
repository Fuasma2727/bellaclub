import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/siteUrl";

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
          "/telefono",
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
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
