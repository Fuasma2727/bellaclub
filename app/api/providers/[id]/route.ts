import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { createPrivateMediaUrl } from "@/lib/privateMediaAccess";
import {
  getPublicVerificationBadge,
  getVerificationLevelFromBadge,
} from "@/lib/providerPromotion";
import { isProviderSubscriptionPubliclyActive } from "@/lib/providerSubscription";
import {
  isSupportedMediaUrl,
  isSupportedVideoUrl,
} from "@/lib/mediaCompatibility";

type MediaItem = {
  id?: string;
  type?: "photo" | "video";
  url?: string;
  previewUrl?: string;
  private?: boolean;
  price?: number | string | null;
  description?: string;
  duration?: number | string | null;
  playbackStatus?: "ready" | "failed" | null;
  purchased?: boolean;
  unavailable?: boolean;
  unavailableReason?: string;
};

type PurchasedItem = {
  sellerId?: string;
  mediaId?: string;
};

const hasConfirmedPlaybackFailure = (item: {
  url?: string;
  playbackStatus?: string | null;
}) => {
  return item.playbackStatus === "failed" && isSupportedVideoUrl(item.url);
};

const getActiveDailyVideo = (dailyVideo: unknown) => {
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
    expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  return {
    url: video.url,
    duration: Number(video.duration || 0) || null,
    playbackStatus: video.playbackStatus || null,
    expiresAt: expiresAt.toISOString(),
  };
};

type Params = {
  params: Promise<{
    id: string;
  }>;
};

const getRequesterId = async (request: Request) => {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;

  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token, true);
    return decoded.uid;
  } catch {
    return null;
  }
};

const userPurchased = async (userId: string | null, sellerId: string) => {
  if (!userId) return [];

  const snap = await adminDb.collection("users").doc(userId).get();
  const data = snap.data();

  return Array.isArray(data?.purchasedContent)
    ? (data.purchasedContent as PurchasedItem[]).filter(
        (item) => item.sellerId === sellerId
      )
    : [];
};

export async function GET(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const requesterId = await getRequesterId(request);
    const providerRef = adminDb.collection("users").doc(id);
    const providerSnap = await providerRef.get();

    if (!providerSnap.exists) {
      return NextResponse.json(
        { error: "Perfil no encontrado" },
        { status: 404 }
      );
    }

    const data = providerSnap.data()!;

    if (
      data.role !== "prestador" ||
      data.profileVisible !== true ||
      data.verificationStatus !== "approved" ||
      !data.photoUrl ||
      data.blocked === true ||
      !isProviderSubscriptionPubliclyActive(data)
    ) {
      return NextResponse.json(
        { error: "Perfil no disponible" },
        { status: 404 }
      );
    }

    const purchased = await userPurchased(requesterId, id);
    const purchasedIds = new Set(purchased.map((item) => item.mediaId));
    const media = Array.isArray(data.media) ? (data.media as MediaItem[]) : [];
    const publicVerificationBadge = getPublicVerificationBadge(
      data.verificationBadge || null,
      data.badgeVerificationStatus || null,
      data.badgeVerificationLevel || null
    );
    const publicBadgeVerificationLevel = getVerificationLevelFromBadge(
      publicVerificationBadge
    );

    if (requesterId !== id) {
      await providerRef.update({
        profileViews: adminFieldValue.increment(1),
        profileLastViewedAt: adminFieldValue.serverTimestamp(),
      });
    }

    const safeMedia = media.flatMap((item, index) => {
      const mediaId = item.id || `legacy-${index}`;
      const type = item.type || "photo";
      const isPrivate = Boolean(item.private);
      const isFailedVideo =
        type === "video" && hasConfirmedPlaybackFailure(item);

      if (isPrivate) {
        if (!item.url) return [];
      } else {
        if (type === "video" && (isFailedVideo || !item.url)) {
          return [];
        }

        if (type !== "video" && !isSupportedMediaUrl(type, item.url)) {
          return [];
        }
      }

      const purchased = isPrivate && purchasedIds.has(mediaId);
      const canServePrivateMedia =
        isPrivate && purchased && requesterId && !isFailedVideo;

      return [
        {
          id: mediaId,
          type,
          url: isPrivate
            ? canServePrivateMedia
              ? createPrivateMediaUrl(request, {
                  buyerId: requesterId,
                  sellerId: id,
                  mediaId,
                })
              : ""
            : item.url || "",
          private: isPrivate,
          price: isPrivate ? item.price || 0 : null,
          description: isPrivate ? item.description || "" : "",
          previewUrl: isPrivate ? item.previewUrl || "" : "",
          duration:
            type === "video" ? Number(item.duration || 0) || null : null,
          playbackStatus: type === "video" ? item.playbackStatus || null : null,
          purchased,
          unavailable: isPrivate && isFailedVideo,
          unavailableReason:
            isPrivate && isFailedVideo
              ? "Video no disponible por formato incompatible"
              : "",
        },
      ];
    });

    return NextResponse.json({
      provider: {
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
        dailyVideo: getActiveDailyVideo(data.dailyVideo),
        media: safeMedia,
      },
    });
  } catch (error) {
    console.error("Error loading provider:", error);
    return NextResponse.json(
      { error: "No pudimos cargar el perfil" },
      { status: 500 }
    );
  }
}
