import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/context/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: {
    default: "BelaClub",
    template: "%s | BelaClub",
  },
  description:
    "Plataforma privada para conectar clientes con prestadores verificados, contenido seguro y abonos dentro de BelaClub.",
  applicationName: "BelaClub",
  keywords: [
    "BelaClub",
    "prestadores verificados",
    "servicios privados",
    "contenido privado",
    "abonos seguros",
  ],
  alternates: {
    canonical: "/prestadores",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.png",
  },
  openGraph: {
    title: "BelaClub",
    description:
      "Conecta con prestadores verificados y gestiona contenido privado de forma segura.",
    url: "/prestadores",
    siteName: "BelaClub",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "BelaClub",
      },
    ],
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "BelaClub",
    description:
      "Conecta con prestadores verificados y gestiona contenido privado de forma segura.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
