import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Perfil de usuario",
  robots: {
    index: false,
    follow: false,
  },
};

export default function UsuarioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
