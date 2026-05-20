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
    type: "website",
  },
};

export default function PrestadoresLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
