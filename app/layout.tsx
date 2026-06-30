import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/context/AuthContext";
import JsonLd from "@/components/JsonLd";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co").replace(
  /\/+$/,
  ""
);
const siteHomeUrl = `${siteUrl}/`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "BelaClub",
    template: "%s | BelaClub",
  },
  description:
    "Plataforma privada para conectar clientes con escorts verificadas, prepagos, acompañantes y damas de compañía, contenido seguro y abonos dentro de BelaClub.",
  applicationName: "BelaClub",
  creator: "BelaClub",
  publisher: "BelaClub",
  keywords: [
    "BelaClub",
    "escorts verificadas",
    "prepagos",
    "acompañantes",
    "damas de compañía",
    "servicios privados",
    "contenido privado",
    "abonos seguros",
  ],
  alternates: {
    canonical: "/prestadores",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/logo.jpg",
  },
  openGraph: {
    title: "BelaClub",
    description:
      "Conecta con escorts verificadas, prepagos y acompañantes de forma segura.",
    url: "/",
    siteName: "BelaClub",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "BelaClub",
      },
    ],
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "BelaClub",
    description:
      "Conecta con escorts verificadas, prepagos y acompañantes de forma segura.",
    images: ["/og-image.png"],
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
  const siteSchema = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "BelaClub",
      alternateName: ["Bela Club", "belaclub.co"],
      url: siteHomeUrl,
      inLanguage: "es-CO",
      publisher: {
        "@id": `${siteUrl}/#organization`,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "BelaClub",
      alternateName: "Bela Club",
      url: siteHomeUrl,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/logo.jpg`,
      },
    },
  ];

  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <Script
          async
          src="https://www.googletagmanager.com/gtag/js?id=AW-18196881969"
          strategy="afterInteractive"
        />
        <Script id="google-ads-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-18196881969');
          `}
        </Script>

        <JsonLd data={siteSchema} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
