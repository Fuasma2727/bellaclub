import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getVerificationRank } from "@/lib/providerPromotion";

type MediaItem = {
  id?: string;
  type?: "photo" | "video";
  url?: string;
  private?: boolean;
  price?: number | string | null;
  description?: string;
};

const getActiveDailyVideo = (dailyVideo: unknown, now: number) => {
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

const sanitizeMediaForCard = (media?: MediaItem[]) => {
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

export async function GET() {
  try {
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

        return {
          id: doc.id,
          blocked: Boolean(data.blocked),
          name: data.name || "",
          price: data.price || "",
          photoUrl: data.photoUrl || "",
          department: data.department || "",
          city: data.city || "",
          zone: data.zone || "",
          whatsapp: data.whatsapp || "",
          rating: data.rating || 0,
          verificationBadge: data.verificationBadge || null,
          badgeVerificationLevel: data.badgeVerificationLevel || null,
          promotedUntil: data.promotedUntil?.toDate?.().toISOString() || null,
          promotedRank:
            data.promotedUntil?.toDate?.().getTime?.() > now ? 1 : 0,
          dailyVideo: getActiveDailyVideo(data.dailyVideo, now),
          dailyVideoRank: getActiveDailyVideo(data.dailyVideo, now) ? 1 : 0,
          verificationRank: getVerificationRank(
            data.badgeVerificationLevel,
            data.verificationBadge
          ),
          createdAt: data.createdAt?.toDate?.().toISOString() || null,
          media: sanitizeMediaForCard(data.media),
        };
      })
      .filter((provider) => !provider.blocked && Boolean(provider.photoUrl))
      .sort((a, b) => {
        if (b.dailyVideoRank !== a.dailyVideoRank) {
          return b.dailyVideoRank - a.dailyVideoRank;
        }

        if (b.promotedRank !== a.promotedRank) {
          return b.promotedRank - a.promotedRank;
        }

        if (b.verificationRank !== a.verificationRank) {
          return b.verificationRank - a.verificationRank;
        }

        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      })
      .map((provider) => ({
        id: provider.id,
        blocked: provider.blocked,
        name: provider.name,
        price: provider.price,
        photoUrl: provider.photoUrl,
        department: provider.department,
        city: provider.city,
        zone: provider.zone,
        whatsapp: provider.whatsapp,
        rating: provider.rating,
        verificationBadge: provider.verificationBadge,
        badgeVerificationLevel: provider.badgeVerificationLevel,
        promotedUntil: provider.promotedUntil,
        dailyVideo: provider.dailyVideo,
        media: provider.media,
      }));

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("Error loading providers:", error);
    return NextResponse.json(
      { error: "No pudimos cargar los perfiles" },
      { status: 500 }
    );
  }
}
