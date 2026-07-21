import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import Header from "@/components/header";
import JsonLd from "@/components/JsonLd";
import { getPhoneSeoValues } from "@/lib/providerPhoneSeo";
import {
  getProviderPhonePath,
  getPublicProviderProfileByPhone,
} from "@/lib/publicProviders";
import { formatMoney, getWhatsAppUrl } from "@/app/prestadores/_components/utils";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://belaclub.co";

export const revalidate = 300;
export const dynamicParams = true;

type PhonePageProps = {
  params: Promise<{
    phoneSlug: string;
  }>;
};

export async function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: PhonePageProps): Promise<Metadata> {
  const { phoneSlug } = await params;
  const provider = await getPublicProviderProfileByPhone(phoneSlug);

  if (!provider) {
    return {
      title: "Telefono no disponible",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const phoneSeo = getPhoneSeoValues(provider.whatsapp);
  const name = provider.name?.trim() || "Escort verificada";
  const place = [provider.city, provider.department].filter(Boolean).join(", ");
  const phonePath = getProviderPhonePath(provider);
  const title = `WhatsApp ${phoneSeo.canonicalDigits || phoneSeo.raw} de ${name}`;
  const description = `Encuentra el perfil de ${name} en BelaClub por el numero de WhatsApp ${phoneSeo.canonicalDigits || phoneSeo.raw}${place ? ` en ${place}` : ""}.`;

  return {
    title,
    description,
    keywords: [
      phoneSeo.raw,
      phoneSeo.digits,
      phoneSeo.localDigits,
      phoneSeo.internationalDigits,
      phoneSeo.formattedLocal,
      phoneSeo.formattedInternational,
      `${name} WhatsApp`,
      `${name} ${phoneSeo.canonicalDigits || ""}`.trim(),
      `telefono ${phoneSeo.canonicalDigits || ""}`.trim(),
      `numero ${phoneSeo.canonicalDigits || ""}`.trim(),
      `perfil ${phoneSeo.canonicalDigits || ""}`.trim(),
      provider.city ? `${phoneSeo.canonicalDigits} ${provider.city}` : "",
    ].filter(Boolean),
    alternates: {
      canonical: phonePath || provider.profilePath,
    },
    openGraph: {
      title: `${title} | BelaClub`,
      description,
      url: phonePath || provider.profilePath,
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

export default async function PhoneLookupPage({ params }: PhonePageProps) {
  const { phoneSlug } = await params;
  const provider = await getPublicProviderProfileByPhone(phoneSlug);

  if (!provider) notFound();

  const phoneSeo = getPhoneSeoValues(provider.whatsapp);
  const phonePath = getProviderPhonePath(provider);

  if (phonePath && `/telefono/${phoneSlug}` !== phonePath) {
    permanentRedirect(phonePath);
  }

  const name = provider.name?.trim() || "Escort verificada";
  const location = [provider.zone, provider.city, provider.department]
    .filter(Boolean)
    .join(", ");
  const profileUrl = `${siteUrl}${provider.profilePath}`;
  const pageUrl = `${siteUrl}${phonePath}`;
  const whatsappUrl = getWhatsAppUrl(
    provider.whatsapp,
    `Hola, vi tu perfil en BelaClub: ${name}`
  );
  const displayPhone =
    phoneSeo.formattedLocal ||
    phoneSeo.formattedInternational ||
    phoneSeo.canonicalDigits ||
    phoneSeo.raw;
  const phoneVariants = [
    phoneSeo.canonicalDigits,
    phoneSeo.formattedLocal,
    phoneSeo.internationalDigits,
    phoneSeo.formattedInternational,
  ].filter((value, index, values): value is string =>
    Boolean(value && values.indexOf(value) === index)
  );

  return (
    <div className="min-h-screen bg-[#050505] pb-12 pt-14 text-white sm:pt-16">
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: `WhatsApp ${phoneSeo.canonicalDigits || phoneSeo.raw} de ${name}`,
            url: pageUrl,
            isPartOf: {
              "@type": "WebSite",
              name: "BelaClub",
              url: siteUrl,
            },
            mainEntity: {
              "@type": "Person",
              name,
              image: provider.photoUrl,
              telephone:
                phoneSeo.formattedInternational ||
                phoneSeo.raw ||
                undefined,
              identifier: phoneSeo.canonicalDigits || undefined,
              url: profileUrl,
              sameAs: [profileUrl],
              address: {
                "@type": "PostalAddress",
                addressLocality: provider.city || undefined,
                addressRegion: provider.department || undefined,
                addressCountry: "CO",
              },
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
                name: `Telefono ${phoneSeo.canonicalDigits || phoneSeo.raw}`,
                item: pageUrl,
              },
            ],
          },
        ]}
      />
      <Header />

      <main className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
        <nav className="mb-4 flex flex-wrap gap-2 text-xs text-neutral-500">
          <Link href="/escorts" className="transition hover:text-white">
            Escorts
          </Link>
          <span>/</span>
          <span className="text-neutral-300">
            WhatsApp {phoneSeo.canonicalDigits || phoneSeo.raw}
          </span>
        </nav>

        <section className="grid gap-5 rounded-md border border-white/[0.08] bg-[#101012] p-4 sm:p-5 lg:grid-cols-[240px_1fr]">
          <Link
            href={provider.profilePath}
            className="relative aspect-[3/4] overflow-hidden rounded-md bg-zinc-900"
          >
            <Image
              src={provider.photoUrl || "/default-avatar.png"}
              alt={`${name} en ${provider.city || "BelaClub"}`}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 1024px) 240px, 100vw"
            />
          </Link>

          <div className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                Perfil por telefono
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                WhatsApp {phoneSeo.canonicalDigits || displayPhone}
              </h1>
              <p className="mt-2 text-sm text-neutral-300">
                {name}
                {location ? ` · ${location}` : ""}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {phoneVariants.map((phone) => (
                  <span
                    key={phone}
                    className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-sm font-semibold text-neutral-100"
                  >
                    {phone}
                  </span>
                ))}
              </div>

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
              </div>

              <p className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-7 text-neutral-300">
                {provider.description ||
                  "Perfil aprobado en BelaClub con fotos publicas y contacto directo por WhatsApp."}
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={provider.profilePath}
                className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Ver perfil completo
              </Link>
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
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
