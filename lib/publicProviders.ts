import type { MediaItem, Prestador } from "@/app/prestadores/_components/types";
import { mkdir, readFile, stat, writeFile } from "fs/promises";
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
import {
  isSupportedMediaUrl,
  isSupportedVideoUrl,
} from "@/lib/mediaCompatibility";

type RawMediaItem = {
  id?: string;
  type?: "photo" | "video";
  url?: string;
  previewUrl?: string;
  private?: boolean;
  price?: number | string | null;
  description?: string;
  duration?: number | string | null;
  playbackStatus?: "ready" | "failed" | null;
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
  version: number;
  providers: PublicProviderCard[];
  expiresAt: number;
  staleUntil: number;
  inFlight?: Promise<PublicProviderCard[]>;
  loaded?: boolean;
  diskLoaded?: boolean;
  mustRefresh?: boolean;
};

const PUBLIC_PROVIDER_CACHE_VERSION = 8;
const PUBLIC_PROVIDER_CACHE_TTL_MS = 60 * 60 * 1000;
const PUBLIC_PROVIDER_STALE_TTL_MS = 72 * 60 * 60 * 1000;
const PUBLIC_PROVIDER_DISK_CACHE_PATH = path.join(
  process.cwd(),
  ".runtime-cache",
  "public-providers-v8.json"
);

const globalForPublicProviderCache = globalThis as typeof globalThis & {
  __belaclubPublicProviderCache?: PublicProviderCache;
};

const publicProviderCache =
  globalForPublicProviderCache.__belaclubPublicProviderCache || {
    version: PUBLIC_PROVIDER_CACHE_VERSION,
    providers: [],
    expiresAt: 0,
    staleUntil: 0,
    loaded: false,
    diskLoaded: false,
    mustRefresh: false,
  };

if (publicProviderCache.version !== PUBLIC_PROVIDER_CACHE_VERSION) {
  publicProviderCache.version = PUBLIC_PROVIDER_CACHE_VERSION;
  publicProviderCache.providers = [];
  publicProviderCache.expiresAt = 0;
  publicProviderCache.staleUntil = 0;
  publicProviderCache.inFlight = undefined;
  publicProviderCache.loaded = false;
  publicProviderCache.diskLoaded = false;
  publicProviderCache.mustRefresh = false;
}

globalForPublicProviderCache.__belaclubPublicProviderCache =
  publicProviderCache;

export const invalidatePublicProviderCache = () => {
  const now = Date.now();

  publicProviderCache.expiresAt = 0;
  publicProviderCache.staleUntil = Math.max(
    publicProviderCache.staleUntil,
    now + PUBLIC_PROVIDER_STALE_TTL_MS
  );
  publicProviderCache.inFlight = undefined;
  publicProviderCache.loaded = publicProviderCache.providers.length > 0;
  publicProviderCache.mustRefresh = true;
};

const readPublicProviderDiskCache = async () => {
  try {
    const [raw, fileStats] = await Promise.all([
      readFile(PUBLIC_PROVIDER_DISK_CACHE_PATH, "utf8"),
      stat(PUBLIC_PROVIDER_DISK_CACHE_PATH).catch(() => null),
    ]);
    const parsed = JSON.parse(raw) as {
      providers?: PublicProviderCard[];
      updatedAt?: string;
    };

    if (!Array.isArray(parsed.providers)) return null;

    const updatedAt = parsed.updatedAt
      ? new Date(parsed.updatedAt).getTime()
      : 0;
    const updatedAtMs =
      Number.isFinite(updatedAt) && updatedAt > 0
        ? updatedAt
        : fileStats?.mtimeMs || 0;

    return {
      providers: parsed.providers,
      updatedAtMs,
    };
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

const hasConfirmedPlaybackFailure = (video: {
  url?: string;
  playbackStatus?: string | null;
}) => {
  return video.playbackStatus === "failed" && isSupportedVideoUrl(video.url);
};

const isPublicPlayableVideo = (video: {
  url?: string;
  playbackStatus?: string | null;
}) => {
  return !hasConfirmedPlaybackFailure(video) && Boolean(video.url);
};

const isPublicMediaAvailable = (item: RawMediaItem) => {
  if ((item.type || "photo") !== "video") {
    return isSupportedMediaUrl(item.type || "photo", item.url);
  }

  return isPublicPlayableVideo(item);
};

const shouldExposeMediaSummary = (item: RawMediaItem) => {
  if (item.private) {
    return Boolean(item.url);
  }

  return isPublicMediaAvailable(item);
};

const getActiveDailyVideo = (dailyVideo: unknown, now = Date.now()) => {
  if (!dailyVideo || typeof dailyVideo !== "object") return null;

  const video = dailyVideo as {
    url?: string;
    duration?: number | string | null;
    playbackStatus?: "ready" | "failed" | null;
    expiresAt?: { toDate?: () => Date } | string | Date | null;
  };
  const expiresAt =
    typeof video.expiresAt === "string"
      ? new Date(video.expiresAt)
      : video.expiresAt instanceof Date
        ? video.expiresAt
        : video.expiresAt?.toDate?.() || null;

  if (
    !video.url ||
    video.playbackStatus === "failed" ||
    !isSupportedVideoUrl(video.url) ||
    !expiresAt ||
    expiresAt.getTime() <= now
  ) {
    return null;
  }

  return {
    url: video.url,
    duration: Number(video.duration || 0) || null,
    expiresAt: expiresAt.toISOString(),
    playbackStatus: video.playbackStatus || null,
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

export const getProviderPhonePath = (provider: { whatsapp?: string }) => {
  const phoneSlug = getPhoneSeoValues(provider.whatsapp).canonicalDigits;

  return phoneSlug ? `/telefono/${phoneSlug}` : "";
};

const sanitizeMediaForCard = (media?: RawMediaItem[]) => {
  return Array.isArray(media)
    ? media.flatMap((item, index) => {
        if (!shouldExposeMediaSummary(item)) {
          return [];
        }

        const type = item.type || "photo";
        const isPrivate = Boolean(item.private);
        const isFailedVideo =
          type === "video" && hasConfirmedPlaybackFailure(item);

        return [
          {
            id: item.id || `legacy-${index}`,
            type,
            url: isPrivate ? "" : item.url || "",
            private: isPrivate,
            price: isPrivate ? item.price || 0 : null,
            description: isPrivate ? item.description || "" : "",
            previewUrl: isPrivate ? item.previewUrl || "" : "",
            duration:
              type === "video" ? Number(item.duration || 0) || null : null,
            playbackStatus: type === "video" ? item.playbackStatus || null : null,
            unavailable: isPrivate && isFailedVideo,
            unavailableReason:
              isPrivate && isFailedVideo
                ? "Video no disponible por formato incompatible"
                : "",
          },
        ];
      })
    : [];
};

const sanitizeMediaForProfile = (media?: RawMediaItem[]) => {
  return Array.isArray(media)
    ? media.flatMap((item, index) => {
        if (!shouldExposeMediaSummary(item)) {
          return [];
        }

        const type = item.type || "photo";
        const isPrivate = Boolean(item.private);
        const isFailedVideo =
          type === "video" && hasConfirmedPlaybackFailure(item);

        return [
          {
            id: item.id || `legacy-${index}`,
            type,
            url: isPrivate ? "" : item.url || "",
            private: isPrivate,
            price: isPrivate ? item.price || 0 : null,
            description: isPrivate ? item.description || "" : "",
            previewUrl: isPrivate ? item.previewUrl || "" : "",
            duration:
              type === "video" ? Number(item.duration || 0) || null : null,
            playbackStatus: type === "video" ? item.playbackStatus || null : null,
            unavailable: isPrivate && isFailedVideo,
            unavailableReason:
              isPrivate && isFailedVideo
                ? "Video no disponible por formato incompatible"
                : "",
          },
        ];
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

const refreshPublicProviderCache = () => {
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
      publicProviderCache.mustRefresh = false;

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
        publicProviderCache.mustRefresh = false;
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
        publicProviderCache.mustRefresh = false;
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
};

async function readPublicProviderCards() {
  const now = Date.now();

  if (
    publicProviderCache.providers.length === 0 &&
    !publicProviderCache.diskLoaded
  ) {
    const diskCache = await readPublicProviderDiskCache();

    publicProviderCache.diskLoaded = true;

    if (diskCache?.providers.length) {
      const cacheAge = Math.max(0, now - diskCache.updatedAtMs);

      if (cacheAge <= PUBLIC_PROVIDER_STALE_TTL_MS) {
        publicProviderCache.providers = diskCache.providers;
        publicProviderCache.expiresAt =
          cacheAge <= PUBLIC_PROVIDER_CACHE_TTL_MS
            ? diskCache.updatedAtMs + PUBLIC_PROVIDER_CACHE_TTL_MS
            : 0;
        publicProviderCache.staleUntil =
          diskCache.updatedAtMs + PUBLIC_PROVIDER_STALE_TTL_MS;
        publicProviderCache.loaded = true;
      }
    }
  }

  if (publicProviderCache.loaded && !publicProviderCache.mustRefresh) {
    if (publicProviderCache.expiresAt > now) {
      return publicProviderCache.providers;
    }

    if (publicProviderCache.staleUntil > now) {
      void refreshPublicProviderCache().catch(() => {});
      return publicProviderCache.providers;
    }
  }

  if (publicProviderCache.inFlight) {
    return publicProviderCache.inFlight;
  }

  return refreshPublicProviderCache();
}

const toPublicProviderProfile = (
  provider: PublicProviderCard,
  media: MediaItem[]
): PublicProviderProfile => ({
  ...provider,
  media,
  publicMedia: media.filter((item) => !item.private && Boolean(item.url)),
  privateMediaCount: media.filter((item) => item.private).length,
});

const getCachedPublicProviderProfile = async (id: string) => {
  const cachedProvider = (await getPublicProviderCards()).find(
    (provider) => provider.id === id
  );

  if (!cachedProvider) return null;

  const media = Array.isArray(cachedProvider.media)
    ? cachedProvider.media
    : [];

  return toPublicProviderProfile(cachedProvider, media);
};

export async function getPublicProviderProfileById(id: string) {
  if (!id) return null;

  try {
    const snap = await adminDb.collection("users").doc(id).get();
    const data = snap.data();

    if (!snap.exists || !data) return null;

    const card = toPublicProviderCard(snap.id, data);
    if (!card) return null;

    return toPublicProviderProfile(card, sanitizeMediaForProfile(data.media));
  } catch (error) {
    const cachedProfile = await getCachedPublicProviderProfile(id);

    if (cachedProfile) {
      console.error(
        "Error loading fresh public provider profile; serving cached profile:",
        error
      );
      return cachedProfile;
    }

    throw error;
  }
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

export async function getPublicProviderProfileByPhone(phoneSlug: string) {
  const requestedPhone = getPhoneSeoValues(phoneSlug);
  const requestedVariants = new Set(
    [
      requestedPhone.digits,
      requestedPhone.localDigits,
      requestedPhone.internationalDigits,
      requestedPhone.canonicalDigits,
    ].filter(Boolean)
  );

  if (requestedVariants.size === 0) return null;

  const providers = await getPublicProviderCards();
  const match = providers.find((provider) => {
    const providerPhone = getPhoneSeoValues(provider.whatsapp);

    return [
      providerPhone.digits,
      providerPhone.localDigits,
      providerPhone.internationalDigits,
      providerPhone.canonicalDigits,
    ]
      .filter(Boolean)
      .some((value) => requestedVariants.has(value));
  });

  return match ? getPublicProviderProfileById(match.id) : null;
}
