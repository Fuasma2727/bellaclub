import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Escorts verificadas",
  description:
    "Explora escorts verificadas, prepagos, acompañantes y damas de compañía en BelaClub. Revisa galerias publicas, desbloquea contenido privado y contacta por WhatsApp.",
  keywords: [
    "escorts verificadas",
    "prepagos",
    "acompañantes",
    "acompanantes",
    "damas de compañía",
    "damas de compania",
    "escorts Medellín",
    "prepagos Medellín",
  ],
  alternates: {
    canonical: "/prestadores",
  },
  openGraph: {
    title: "Escorts verificadas | BelaClub",
    description:
      "Escorts verificadas, prepagos y acompañantes con galerias publicas, contenido privado y contacto directo dentro de BelaClub.",
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
    title: "Escorts verificadas | BelaClub",
    description:
      "Escorts verificadas, prepagos y acompañantes con galerias publicas y contacto directo dentro de BelaClub.",
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
