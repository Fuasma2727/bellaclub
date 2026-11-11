import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/header";
import JsonLd from "@/components/JsonLd";
import ScreenProtection from "@/app/prestadores/_components/ScreenProtection";
import PublicProfileMediaViewer from "./PublicProfileMediaViewer";
import { citySlug as toCitySlug } from "@/lib/providerCitySeo";
import { getPhoneSeoValues } from "@/lib/providerPhoneSeo";
import { getProviderPhonePath } from "@/lib/publicProviders";
import { resolvePublicProfileRoute } from "@/lib/publicProfileRoute";
import {
  formatMoney,
  getWhatsAppMessage,
  getWhatsAppUrl,
} from "@/app/prestadores/_components/utils";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export const revalidate = 300;
export const dynamicParams = true;

type ProfilePageProps = {
  params: Promise<{
    citySlug: string;
    profileSlug: string;
  }>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { profileSlug } = await params;
  const provider = await resolvePublicProfileRoute(profileSlug);

  if (!provider) {
    return {
      title: "Perfil no disponible",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const name = provider.name?.trim() || "Escort verificada";
  const place = [provider.zone, provider.city, provider.department]
    .filter(Boolean)
    .join(", ");
  const phoneSeo = getPhoneSeoValues(provider.whatsapp);
  const title = `${name}${
    phoneSeo.canonicalDigits ? ` WhatsApp ${phoneSeo.canonicalDigits}` : ""
  } en ${provider.city || "Colombia"}`;
  const phoneDescription = phoneSeo.canonicalDigits
    ? ` WhatsApp ${phoneSeo.canonicalDigits}${
        phoneSeo.formattedInternational
          ? ` (${phoneSeo.formattedInternational})`
          : ""
      }`
    : "";
  const description = `${name} en ${place || "BelaClub"}. Revisa perfil aprobado, fotos públicas, precio base y contacto directo por${phoneDescription || " WhatsApp"} en BelaClub.`;

  return {
    title,
    description,
    keywords: [
      `${name} ${provider.city || ""}`.trim(),
      `escort en ${provider.city || "Colombia"}`,
      `escorts ${provider.city || "Colombia"}`,
      `prepagos ${provider.city || "Colombia"}`,
      `acompañantes ${provider.city || "Colombia"}`,
      `damas de compañía ${provider.city || "Colombia"}`,
      ...phoneSeo.variants,
    ].filter(Boolean),
    alternates: {
      canonical: provider.profilePath,
    },
    openGraph: {
      title: `${title} | BelaClub`,
      description,
      url: provider.profilePath,
      siteName: "BelaClub",
      images: [
        {
          url: provider.photoUrl || "/og-image.png",
          width: 1200,
          height: 1600,
          alt: name,
        },
      ],
      type: "profile",
      locale: "es_CO",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | BelaClub`,
      description,
      images: [provider.photoUrl || "/og-image.png"],
    },
  };
}

export default async function EscortProfilePage({ params }: ProfilePageProps) {
  const { profileSlug } = await params;
  const provider = await resolvePublicProfileRoute(profileSlug);

  if (!provider) notFound();

  const name = provider.name?.trim() || "Escort verificada";
  const location = [provider.zone, provider.city, provider.department]
    .filter(Boolean)
    .join(", ");
  const whatsappUrl = getWhatsAppUrl(
    provider.whatsapp,
    getWhatsAppMessage(provider.name)
  );
  const phoneSeo = getPhoneSeoValues(provider.whatsapp);
  const phonePath = getProviderPhonePath(provider);
  const gallery = [
    {
      id: "profile-photo",
      type: "photo" as const,
      url: provider.photoUrl || "",
      description: `Foto principal de ${name}`,
    },
    ...(provider.media || []).filter(
      (item) =>
        item.url !== provider.photoUrl &&
        (item.url || item.previewUrl || item.private)
    ),
  ];
  const pageUrl = `${siteUrl}${provider.profilePath}`;
  const providerCitySlug = toCitySlug(provider.city || "");
  const cityPath = providerCitySlug
    ? `/escorts/${providerCitySlug}`
    : "/escorts";

  return (
    <div className="min-h-screen bg-[#050505] pb-12 pt-14 text-white sm:pt-16">
      <ScreenProtection active />
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "ProfilePage",
            name: `${name} en ${provider.city || "Colombia"}`,
            url: pageUrl,
            image: provider.photoUrl,
            dateModified: provider.updatedAt || provider.createdAt || undefined,
            mainEntity: {
              "@type": "Person",
              name,
              image: provider.photoUrl,
              sameAs: phonePath ? [`${siteUrl}${phonePath}`] : undefined,
              telephone:
                phoneSeo.formattedInternational ||
                phoneSeo.raw ||
                undefined,
              identifier: phoneSeo.canonicalDigits
                ? [
                    {
                      "@type": "PropertyValue",
                      propertyID: "WhatsApp",
                      value: phoneSeo.canonicalDigits,
                    },
                    phoneSeo.internationalDigits
                      ? {
                          "@type": "PropertyValue",
                          propertyID: "WhatsApp internacional",
                          value: phoneSeo.internationalDigits,
                        }
                      : null,
                  ].filter(Boolean)
                : undefined,
              description: provider.description || undefined,
              contactPoint: phoneSeo.internationalDigits
                ? {
                    "@type": "ContactPoint",
                    telephone: `+${phoneSeo.internationalDigits}`,
                    contactType: "WhatsApp",
                    availableLanguage: "es",
                  }
                : undefined,
              address: {
                "@type": "PostalAddress",
                addressLocality: provider.city || undefined,
                addressRegion: provider.department || undefined,
                addressCountry: "CO",
              },
            },
            isPartOf: {
              "@type": "WebSite",
              name: "BelaClub",
              url: siteUrl,
            },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "BelaClub",
                item: siteUrl,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: `Escorts en ${provider.city || "Colombia"}`,
                item: `${siteUrl}${cityPath}`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name,
                item: pageUrl,
              },
            ],
          },
        ]}
      />
      <Header />

      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <nav className="mb-4 flex flex-wrap gap-2 text-xs text-neutral-500">
          <Link href="/escorts" className="transition hover:text-white">
            Escorts
          </Link>
          <span>/</span>
          <Link href={cityPath} className="transition hover:text-white">
            {provider.city || "Colombia"}
          </Link>
          <span>/</span>
          <span className="text-neutral-300">{name}</span>
        </nav>

        <section className="grid gap-5 lg:grid-cols-[minmax(280px,420px)_1fr]">
          <PublicProfileMediaViewer
            items={gallery}
            providerId={provider.id}
            name={name}
            city={provider.city || ""}
            variant="hero"
          />

          <div className="flex flex-col justify-between rounded-md border border-white/[0.08] bg-[#101012] p-4 sm:p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                Perfil aprobado
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                {name}
              </h1>
              <p className="mt-2 text-sm text-neutral-400">
                {location || "Ubicacion por confirmar"}
              </p>
              {phoneSeo.variants.length > 0 && (
                <div className="mt-3 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                    WhatsApp
                  </p>
                  <p className="mt-1 text-sm text-neutral-300">
                    Numero de WhatsApp:{" "}
                    <span className="font-semibold text-white">
                      {phoneSeo.canonicalDigits || phoneSeo.raw}
                    </span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-neutral-500">
                    {[
                      phoneSeo.formattedInternational,
                      phoneSeo.internationalDigits,
                    ]
                      .filter(Boolean)
                      .map((phone) => (
                        <span key={phone} className="font-medium">
                          {phone}
                        </span>
                      ))}
                  </div>
                  {phonePath && (
                    <Link
                      href={phonePath}
                      className="mt-2 inline-flex text-xs font-semibold text-blue-200 transition hover:text-white"
                    >
                      Ficha del numero {phoneSeo.canonicalDigits}
                    </Link>
                  )}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {provider.price && (
                  <span className="rounded-full border border-blue-300/20 bg-blue-400/10 px-3 py-1.5 text-sm font-semibold text-blue-100">
                    {formatMoney(provider.price)}
                  </span>
                )}
                {provider.verificationBadge && (
                  <span className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1.5 text-sm font-semibold text-emerald-100">
                    Verificada
                  </span>
                )}
                {provider.privateMediaCount > 0 && (
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-neutral-200">
                    {provider.privateMediaCount} privado
                    {provider.privateMediaCount === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              <p className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-7 text-neutral-300">
                {provider.description ||
                  "Perfil aprobado en BelaClub con fotos publicas y contacto directo."}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                >
                  Contactar por WhatsApp
                </a>
              )}
              <Link
                href={cityPath}
                className="inline-flex items-center justify-center rounded-md border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-neutral-200 transition hover:bg-white/[0.07]"
              >
                Ver más perfiles en {provider.city || "BelaClub"}
              </Link>
            </div>
          </div>
        </section>

        <PublicProfileMediaViewer
          items={gallery}
          providerId={provider.id}
          name={name}
          city={provider.city || ""}
          variant="gallery"
        />
      </main>
    </div>
  );
}
