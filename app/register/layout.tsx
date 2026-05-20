import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crear cuenta",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RegisterLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
