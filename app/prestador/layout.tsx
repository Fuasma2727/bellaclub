import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Perfil de escort",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PrestadorLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
