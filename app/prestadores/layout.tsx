import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Escorts verificadas por ciudad",
  description:
    "Explora escorts verificadas, prepagos, acompanantes y damas de compania en Medellin, La Ceja, Rionegro y otras ciudades dentro de BelaClub.",
  keywords: [
    "escorts verificadas",
    "prepagos",
    "acompanantes",
    "damas de compania",
    "escorts Medellin",
    "prepagos Medellin",
    "escorts La Ceja",
    "escorts en La Ceja",
    "escorts La Ceja BelaClub",
    "escorts en La Ceja BelaClub",
    "prepagos La Ceja",
    "prepagos en La Ceja",
    "prepagos La Ceja BelaClub",
    "prepagos en La Ceja BelaClub",
    "BelaClub La Ceja",
    "escorts Rionegro",
    "prepagos Rionegro",
  ],
  alternates: {
    canonical: "/prestadores",
  },
  openGraph: {
    title: "Escorts verificadas por ciudad | BelaClub",
    description:
      "Escorts verificadas, prepagos y acompanantes en Medellin, La Ceja y Rionegro con galerias publicas y contacto directo dentro de BelaClub.",
    url: "/prestadores",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BelaClub",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Escorts verificadas por ciudad | BelaClub",
    description:
      "Escorts verificadas, prepagos y acompanantes en Medellin, La Ceja y Rionegro dentro de BelaClub.",
    images: ["/og-image.png"],
  },
};

export default function PrestadoresLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
