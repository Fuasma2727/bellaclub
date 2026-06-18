import type { MediaItem, Prestador } from "@/app/prestadores/_components/types";
import { adminDb } from "@/lib/firebaseAdmin";
import { citySlug } from "@/lib/providerCitySeo";
import { getPhoneSeoValues } from "@/lib/providerPhoneSeo";
import { getVerificationRank } from "@/lib/providerPromotion";

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

const isPublicProvider = (data: RawProviderData) => {
  return (
    data.role === "prestador" &&
    data.profileVisible === true &&
    data.verificationStatus === "approved" &&
    Boolean(data.photoUrl) &&
    data.blocked !== true
  );
};

const toPublicProviderCard = (
  id: string,
  data: RawProviderData,
  now = Date.now()
): PublicProviderCard | null => {
  if (!isPublicProvider(data)) return null;

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
    verificationBadge: data.verificationBadge || null,
    badgeVerificationLevel: data.badgeVerificationLevel || null,
    promotedUntil: toIsoString(data.promotedUntil),
    dailyVideo: getActiveDailyVideo(data.dailyVideo, now),
    media: sanitizeMediaForCard(data.media),
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt || data.profileUpdatedAt),
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
  },
  b: PublicProviderCard & {
    promotedRank?: number;
    dailyVideoRank?: number;
    verificationRank?: number;
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

  return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
};

export async function getPublicProviderCards(options?: {
  citySlug?: string;
  limit?: number;
}) {
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
          data.badgeVerificationLevel,
          data.verificationBadge
        ),
      };
    })
    .filter((provider): provider is PublicProviderCard & {
      promotedRank: number;
      dailyVideoRank: number;
      verificationRank: number;
    } => Boolean(provider))
    .filter((provider) => {
      if (!options?.citySlug) return true;
      return citySlug(provider.city || "") === options.citySlug;
    })
    .sort(sortProviders);

  const limited = options?.limit ? providers.slice(0, options.limit) : providers;

  return limited.map((provider) => {
    const publicProvider: Partial<typeof provider> = { ...provider };

    delete publicProvider.promotedRank;
    delete publicProvider.dailyVideoRank;
    delete publicProvider.verificationRank;

    return publicProvider as PublicProviderCard;
  });
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
