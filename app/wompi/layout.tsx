import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Resultado de pago",
  robots: {
    index: false,
    follow: false,
  },
};

export default function WompiLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
