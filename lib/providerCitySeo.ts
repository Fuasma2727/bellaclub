import { adminDb } from "@/lib/firebaseAdmin";

export type ProviderCitySeo = {
  city: string;
  department: string;
  slug: string;
  count: number;
  zones?: string[];
  seoIntro?: string;
  nearbyCities?: string[];
};

type ProviderCityCache = {
  cities: ProviderCitySeo[];
  expiresAt: number;
  staleUntil: number;
  inFlight?: Promise<ProviderCitySeo[]>;
};

const PROVIDER_CITY_CACHE_TTL_MS = 5 * 60 * 1000;
const PROVIDER_CITY_STALE_TTL_MS = 24 * 60 * 60 * 1000;

export const targetSeoCities: ProviderCitySeo[] = [
  {
    city: "Medellín",
    department: "Antioquia",
    slug: "medellin",
    count: 0,
    nearbyCities: ["Envigado", "Itagui", "Sabaneta", "Rionegro"],
    zones: [
      "El Poblado",
      "Laureles",
      "Belén",
      "Estadio",
      "Centro",
      "Ciudad del Río",
    ],
    seoIntro:
      "Medellín es una de las ciudades con mayor movimiento para encontrar perfiles por zonas como El Poblado, Laureles, Belén, Estadio, Centro y Ciudad del Río.",
  },
  {
    city: "La Ceja",
    department: "Antioquia",
    slug: "la-ceja",
    count: 0,
    nearbyCities: ["Rionegro", "El Retiro", "El Carmen de Viboral"],
    zones: ["Centro", "zonas cercanas", "oriente antioqueno"],
    seoIntro:
      "La Ceja conecta usuarios que buscan perfiles en el oriente antioqueño con opciones cercanas y contacto directo.",
  },
  {
    city: "Rionegro",
    department: "Antioquia",
    slug: "rionegro",
    count: 0,
    nearbyCities: ["La Ceja", "Marinilla", "Guarne", "El Carmen de Viboral"],
    zones: ["San Antonio", "Centro", "Llanogrande", "Aeropuerto JMC"],
    seoIntro:
      "Rionegro concentra busquedas en zonas como San Antonio y Centro, con perfiles visibles y contacto directo por WhatsApp.",
  },
];

const globalForProviderCityCache = globalThis as typeof globalThis & {
  __belaclubProviderCityCache?: ProviderCityCache;
};

const providerCityCache =
  globalForProviderCityCache.__belaclubProviderCityCache || {
    cities: [],
    expiresAt: 0,
    staleUntil: 0,
  };

globalForProviderCityCache.__belaclubProviderCityCache = providerCityCache;

export const citySlug = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

const isFirestoreQuotaError = (error: unknown) => {
  const typed = error as { code?: unknown; details?: unknown; message?: unknown };
  const message = String(typed.details || typed.message || "");

  return typed.code === 8 || message.includes("Quota exceeded");
};

async function fetchPublicProviderCities(): Promise<ProviderCitySeo[]> {
  const snapshot = await adminDb
    .collection("users")
    .where("role", "==", "prestador")
    .where("profileVisible", "==", true)
    .where("verificationStatus", "==", "approved")
    .get();

  const bySlug = new Map<string, ProviderCitySeo>();

  snapshot.docs.forEach((doc) => {
    const data = doc.data();

    if (data.blocked === true) return;

    const city = String(data.city || "").trim();
    const department = String(data.department || "").trim();
    const slug = citySlug(city);

    if (!city || !slug) return;

    const current = bySlug.get(slug);

    bySlug.set(slug, {
      city,
      department: current?.department || department,
      slug,
      count: (current?.count || 0) + 1,
    });
  });

  targetSeoCities.forEach((city) => {
    const current = bySlug.get(city.slug);

    bySlug.set(city.slug, {
      ...city,
      city: current?.city || city.city,
      department: current?.department || city.department,
      count: current?.count || city.count,
      zones: current?.zones || city.zones,
      seoIntro: current?.seoIntro || city.seoIntro,
      nearbyCities: current?.nearbyCities || city.nearbyCities,
    });
  });

  return Array.from(bySlug.values()).sort((a, b) =>
    a.city.localeCompare(b.city, "es")
  );
}

export async function getPublicProviderCities(): Promise<ProviderCitySeo[]> {
  const now = Date.now();

  if (providerCityCache.cities.length > 0) {
    if (providerCityCache.expiresAt > now) {
      return providerCityCache.cities;
    }

    if (providerCityCache.inFlight) {
      return providerCityCache.cities;
    }
  }

  if (providerCityCache.inFlight) {
    return providerCityCache.inFlight;
  }

  providerCityCache.inFlight = fetchPublicProviderCities()
    .then((cities) => {
      const refreshedAt = Date.now();

      providerCityCache.cities = cities;
      providerCityCache.expiresAt = refreshedAt + PROVIDER_CITY_CACHE_TTL_MS;
      providerCityCache.staleUntil =
        refreshedAt + PROVIDER_CITY_STALE_TTL_MS;

      return cities;
    })
    .catch((error) => {
      if (
        providerCityCache.cities.length > 0 &&
        providerCityCache.staleUntil > Date.now()
      ) {
        console.error(
          "Error refreshing provider city cache; serving stale cities:",
          error
        );
        return providerCityCache.cities;
      }

      if (isFirestoreQuotaError(error)) {
        console.error(
          "Provider cities unavailable because Firestore quota is exhausted:",
          error
        );
        return targetSeoCities;
      }

      throw error;
    })
    .finally(() => {
      providerCityCache.inFlight = undefined;
    });

  return providerCityCache.inFlight;
}

export async function findProviderCityBySlug(slug: string) {
  const cities = await getPublicProviderCities();
  return cities.find((city) => city.slug === slug) || null;
}
