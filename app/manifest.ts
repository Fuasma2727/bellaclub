import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BelaClub",
    short_name: "BelaClub",
    description:
      "Plataforma privada para conectar clientes con escorts verificadas.",
    start_url: "/escorts",
    display: "standalone",
    background_color: "#050505",
    theme_color: "#050505",
    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
