import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Prestadores verificados",
  description:
    "Explora perfiles aprobados en BelaClub, revisa galerias publicas, desbloquea contenido privado y contacta prestadores por WhatsApp.",
  alternates: {
    canonical: "/prestadores",
  },
  openGraph: {
    title: "Prestadores verificados | BelaClub",
    description:
      "Perfiles aprobados, galerias publicas, contenido privado y contacto directo dentro de BelaClub.",
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
    title: "Prestadores verificados | BelaClub",
    description:
      "Perfiles aprobados, galerias publicas, contenido privado y contacto directo dentro de BelaClub.",
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
