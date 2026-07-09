import type { MediaItem, Prestador } from "@/app/prestadores/_components/types";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { adminDb } from "@/lib/firebaseAdmin";
import { citySlug } from "@/lib/providerCitySeo";
import { getPhoneSeoValues } from "@/lib/providerPhoneSeo";
import {
  getAdminQualityRank,
  getPublicVerificationBadge,
  getVerificationLevelFromBadge,
  getVerificationRank,
} from "@/lib/providerPromotion";
import { isProviderSubscriptionPubliclyActive } from "@/lib/providerSubscription";

type RawMediaItem = {
  id?: string;
  type?: "photo" | "video";
  url?: string;
  private?: boolean;
  price?: number | string | null;
  description?: string;
};

type RawProviderData = FirebaseFirestore.DocumentData;

export type PublicProviderCard = Prestador & {
  createdAt?: string | null;
  updatedAt?: string | null;
  profileSlug: string;
  profilePath: string;
};

export type PublicProviderProfile = PublicProviderCard & {
  publicMedia: MediaItem[];
  privateMediaCount: number;
};

type PublicProviderCache = {
  providers: PublicProviderCard[];
  expiresAt: number;
  staleUntil: number;
  inFlight?: Promise<PublicProviderCard[]>;
  loaded?: boolean;
  diskLoaded?: boolean;
};

const PUBLIC_PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000;
const PUBLIC_PROVIDER_STALE_TTL_MS = 24 * 60 * 60 * 1000;
const PUBLIC_PROVIDER_DISK_CACHE_PATH = path.join(
  process.cwd(),
  ".runtime-cache",
  "public-providers-v2.json"
);

const globalForPublicProviderCache = globalThis as typeof globalThis & {
  __belaclubPublicProviderCache?: PublicProviderCache;
};

const publicProviderCache =
  globalForPublicProviderCache.__belaclubPublicProviderCache || {
    providers: [],
    expiresAt: 0,
    staleUntil: 0,
    loaded: false,
    diskLoaded: false,
  };

globalForPublicProviderCache.__belaclubPublicProviderCache =
  publicProviderCache;

const readPublicProviderDiskCache = async () => {
  try {
    const raw = await readFile(PUBLIC_PROVIDER_DISK_CACHE_PATH, "utf8");
    const parsed = JSON.parse(raw) as { providers?: PublicProviderCard[] };

    return Array.isArray(parsed.providers) ? parsed.providers : null;
  } catch {
    return null;
  }
};

const writePublicProviderDiskCache = async (
  providers: PublicProviderCard[]
) => {
  try {
    await mkdir(path.dirname(PUBLIC_PROVIDER_DISK_CACHE_PATH), {
      recursive: true,
    });
    await writeFile(
      PUBLIC_PROVIDER_DISK_CACHE_PATH,
      JSON.stringify(
        {
          updatedAt: new Date().toISOString(),
          providers,
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    console.error("Error writing public provider disk cache:", error);
  }
};

const isFirestoreQuotaError = (error: unknown) => {
  const typed = error as { code?: unknown; details?: unknown; message?: unknown };
  const message = String(typed.details || typed.message || "");

  return typed.code === 8 || message.includes("Quota exceeded");
};

const toIsoString = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();

  const maybeTimestamp = value as { toDate?: () => Date };
  return maybeTimestamp.toDate?.().toISOString() || null;
};

const toMillis = (value: unknown) => {
  const iso = toIsoString(value);
  return iso ? new Date(iso).getTime() : 0;
};

const getActiveDailyVideo = (dailyVideo: unknown, now = Date.now()) => {
  if (!dailyVideo || typeof dailyVideo !== "object") return null;

  const video = dailyVideo as {
    url?: string;
    duration?: number | string | null;
    expiresAt?: { toDate?: () => Date } | string | Date | null;
  };
  const expiresAt =
    typeof video.expiresAt === "string"
      ? new Date(video.expiresAt)
      : video.expiresAt instanceof Date
        ? video.expiresAt
        : video.expiresAt?.toDate?.() || null;

  if (!video.url || !expiresAt || expiresAt.getTime() <= now) return null;

  return {
    url: video.url,
    duration: Number(video.duration || 0) || null,
    expiresAt: expiresAt.toISOString(),
  };
};

export const textSlug = (value: string) => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const getProviderProfileSlug = (provider: {
  id: string;
  name?: string;
  whatsapp?: string;
}) => {
  const nameSlug = textSlug(provider.name || "perfil");
  const phoneSlug = getPhoneSeoValues(provider.whatsapp).canonicalDigits;
  const publicSlug = [nameSlug || "perfil", phoneSlug]
    .filter(Boolean)
    .join("-");

  return `${publicSlug || "perfil"}--${provider.id}`;
};

export const getProviderIdFromProfileSlug = (profileSlug: string) => {
  const [, id] = profileSlug.split("--");
  return id || "";
};

export const getProviderProfilePath = (provider: {
  id: string;
  name?: string;
  city?: string;
  whatsapp?: string;
}) => `/escorts/${citySlug(provider.city || "colombia")}/${getProviderProfileSlug(provider)}`;

const sanitizeMediaForCard = (media?: RawMediaItem[]) => {
  return Array.isArray(media)
    ? media.map((item, index) => ({
        id: item.id || `legacy-${index}`,
        type: item.type || "photo",
        private: Boolean(item.private),
        price: item.private ? item.price || 0 : null,
        description: item.private ? item.description || "" : "",
      }))
    : [];
};

const sanitizeMediaForProfile = (media?: RawMediaItem[]) => {
  return Array.isArray(media)
    ? media.map((item, index) => {
        const isPrivate = Boolean(item.private);

        return {
          id: item.id || `legacy-${index}`,
          type: item.type || "photo",
          url: isPrivate ? "" : item.url || "",
          private: isPrivate,
          price: isPrivate ? item.price || 0 : null,
          description: isPrivate ? item.description || "" : "",
        };
      })
    : [];
};

const isPublicProvider = (data: RawProviderData, now = new Date()) => {
  return (
    data.role === "prestador" &&
    data.profileVisible === true &&
    data.verificationStatus === "approved" &&
    Boolean(data.photoUrl) &&
    data.blocked !== true &&
    isProviderSubscriptionPubliclyActive(data, now)
  );
};

const toPublicProviderCard = (
  id: string,
  data: RawProviderData,
  now = Date.now()
): PublicProviderCard | null => {
  if (!isPublicProvider(data, new Date(now))) return null;

  const publicVerificationBadge = getPublicVerificationBadge(
    data.verificationBadge || null,
    data.badgeVerificationStatus || null,
    data.badgeVerificationLevel || null
  );
  const publicBadgeVerificationLevel = getVerificationLevelFromBadge(
    publicVerificationBadge
  );

  const provider: PublicProviderCard = {
    id,
    name: data.name || "",
    price: data.price || "",
    photoUrl: data.photoUrl || "",
    department: data.department || "",
    city: data.city || "",
    zone: data.zone || "",
    whatsapp: data.whatsapp || "",
    description: data.description || "",
    rating: data.rating || 0,
    verificationBadge: publicVerificationBadge,
    badgeVerificationLevel: publicBadgeVerificationLevel,
    promotedUntil: toIsoString(data.promotedUntil),
    dailyVideo: getActiveDailyVideo(data.dailyVideo, now),
    media: sanitizeMediaForCard(data.media),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.profileUpdatedAt || data.updatedAt),
    profileSlug: "",
    profilePath: "",
  };

  provider.profileSlug = getProviderProfileSlug(provider);
  provider.profilePath = getProviderProfilePath(provider);

  return provider;
};

const sortProviders = (
  a: PublicProviderCard & {
    promotedRank?: number;
    dailyVideoRank?: number;
    verificationRank?: number;
    adminQualityRank?: number;
  },
  b: PublicProviderCard & {
    promotedRank?: number;
    dailyVideoRank?: number;
    verificationRank?: number;
    adminQualityRank?: number;
  }
) => {
  if ((b.dailyVideoRank || 0) !== (a.dailyVideoRank || 0)) {
    return (b.dailyVideoRank || 0) - (a.dailyVideoRank || 0);
  }

  if ((b.promotedRank || 0) !== (a.promotedRank || 0)) {
    return (b.promotedRank || 0) - (a.promotedRank || 0);
  }

  if ((b.verificationRank || 0) !== (a.verificationRank || 0)) {
    return (b.verificationRank || 0) - (a.verificationRank || 0);
  }

  if ((b.adminQualityRank || 0) !== (a.adminQualityRank || 0)) {
    return (b.adminQualityRank || 0) - (a.adminQualityRank || 0);
  }

  return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
};

export async function getPublicProviderCards(options?: {
  citySlug?: string;
  limit?: number;
}) {
  const providers = await readPublicProviderCards();
  const filtered = options?.citySlug
    ? providers.filter(
        (provider) => citySlug(provider.city || "") === options.citySlug
      )
    : providers;
  const limited =
    options?.limit && options.limit > 0
      ? filtered.slice(0, options.limit)
      : filtered;

  return limited;
}

async function fetchPublicProviderCards() {
  const now = Date.now();
  const snapshot = await adminDb
    .collection("users")
    .where("role", "==", "prestador")
    .where("profileVisible", "==", true)
    .where("verificationStatus", "==", "approved")
    .get();

  const providers = snapshot.docs
    .map((doc) => {
      const data = doc.data();
      const provider = toPublicProviderCard(doc.id, data, now);

      if (!provider) return null;

      return {
        ...provider,
        promotedRank: toMillis(data.promotedUntil) > now ? 1 : 0,
        dailyVideoRank: getActiveDailyVideo(data.dailyVideo, now) ? 1 : 0,
        verificationRank: getVerificationRank(
          provider.badgeVerificationLevel,
          provider.verificationBadge
        ),
        adminQualityRank: getAdminQualityRank(data.adminQualityRank),
      };
    })
    .filter((provider): provider is PublicProviderCard & {
      promotedRank: number;
      dailyVideoRank: number;
      verificationRank: number;
      adminQualityRank: number;
    } => Boolean(provider))
    .sort(sortProviders);

  return providers.map((provider) => {
    const publicProvider: Partial<typeof provider> = { ...provider };

    delete publicProvider.promotedRank;
    delete publicProvider.dailyVideoRank;
    delete publicProvider.verificationRank;
    delete publicProvider.adminQualityRank;

    return publicProvider as PublicProviderCard;
  });
}

async function readPublicProviderCards() {
  const now = Date.now();

  if (
    publicProviderCache.providers.length === 0 &&
    !publicProviderCache.diskLoaded
  ) {
    const diskProviders = await readPublicProviderDiskCache();

    publicProviderCache.diskLoaded = true;

    if (diskProviders?.length) {
      publicProviderCache.providers = diskProviders;
      publicProviderCache.expiresAt = now + PUBLIC_PROVIDER_CACHE_TTL_MS;
      publicProviderCache.staleUntil = now + PUBLIC_PROVIDER_STALE_TTL_MS;
      publicProviderCache.loaded = true;
    }
  }

  if (publicProviderCache.loaded) {
    if (publicProviderCache.expiresAt > now) {
      return publicProviderCache.providers;
    }

    if (publicProviderCache.inFlight) {
      return publicProviderCache.providers;
    }
  }

  if (publicProviderCache.inFlight) {
    return publicProviderCache.inFlight;
  }

  publicProviderCache.inFlight = fetchPublicProviderCards()
    .then((providers) => {
      const refreshedAt = Date.now();

      publicProviderCache.providers = providers;
      publicProviderCache.expiresAt =
        refreshedAt + PUBLIC_PROVIDER_CACHE_TTL_MS;
      publicProviderCache.staleUntil =
        refreshedAt + PUBLIC_PROVIDER_STALE_TTL_MS;
      publicProviderCache.loaded = true;

      void writePublicProviderDiskCache(providers);

      return providers;
    })
    .catch((error) => {
      if (
        publicProviderCache.providers.length > 0 &&
        publicProviderCache.staleUntil > Date.now()
      ) {
        console.error(
          "Error refreshing public provider cache; serving stale providers:",
          error
        );
        return publicProviderCache.providers;
      }

      if (isFirestoreQuotaError(error)) {
        const failedAt = Date.now();

        publicProviderCache.providers = [];
        publicProviderCache.expiresAt =
          failedAt + PUBLIC_PROVIDER_CACHE_TTL_MS;
        publicProviderCache.staleUntil =
          failedAt + PUBLIC_PROVIDER_STALE_TTL_MS;
        publicProviderCache.loaded = true;
        console.error(
          "Public providers unavailable because Firestore quota is exhausted:",
          error
        );
        return [];
      }

      throw error;
    })
    .finally(() => {
      publicProviderCache.inFlight = undefined;
    });

  return publicProviderCache.inFlight;
}

export async function getPublicProviderProfileById(id: string) {
  if (!id) return null;

  const snap = await adminDb.collection("users").doc(id).get();
  const data = snap.data();

  if (!snap.exists || !data) return null;

  const card = toPublicProviderCard(snap.id, data);
  if (!card) return null;

  const media = sanitizeMediaForProfile(data.media);
  const privateMediaCount = media.filter((item) => item.private).length;

  return {
    ...card,
    media,
    publicMedia: media.filter((item) => !item.private && Boolean(item.url)),
    privateMediaCount,
  };
}

export async function getPublicProviderProfileBySlug(
  profileSlug: string,
  expectedCitySlug?: string
) {
  const id = getProviderIdFromProfileSlug(profileSlug);
  const provider = await getPublicProviderProfileById(id);

  if (!provider) return null;
  if (expectedCitySlug && citySlug(provider.city || "") !== expectedCitySlug) {
    return null;
  }

  return provider;
}
