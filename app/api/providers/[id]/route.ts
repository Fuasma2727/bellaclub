import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { createPrivateMediaUrl } from "@/lib/privateMediaAccess";

type MediaItem = {
  id?: string;
  type?: "photo" | "video";
  url?: string;
  private?: boolean;
  price?: number | string | null;
  description?: string;
};

type PurchasedItem = {
  sellerId?: string;
  mediaId?: string;
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
    const decoded = await adminAuth.verifyIdToken(token);
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
    const providerSnap = await adminDb.collection("users").doc(id).get();

    if (!providerSnap.exists) {
      return NextResponse.json(
        { error: "Prestador no encontrado" },
        { status: 404 }
      );
    }

    const data = providerSnap.data()!;

    if (
      data.role !== "prestador" ||
      data.profileVisible !== true ||
      data.verificationStatus !== "approved" ||
      data.blocked === true
    ) {
      return NextResponse.json(
        { error: "Prestador no disponible" },
        { status: 404 }
      );
    }

    const purchased = await userPurchased(requesterId, id);
    const purchasedIds = new Set(purchased.map((item) => item.mediaId));
    const media = Array.isArray(data.media) ? (data.media as MediaItem[]) : [];

    const safeMedia = media.map((item, index) => {
      const mediaId = item.id || `legacy-${index}`;
      const unlocked = !item.private || purchasedIds.has(mediaId);

      return {
        id: mediaId,
        type: item.type || "photo",
        url:
          unlocked && item.private && requesterId
            ? createPrivateMediaUrl(request, {
                buyerId: requesterId,
                sellerId: id,
                mediaId,
              })
            : unlocked
              ? item.url || ""
              : "",
        private: Boolean(item.private),
        price: item.private ? item.price || 0 : null,
        description: item.private ? item.description || "" : "",
      };
    });

    return NextResponse.json({
      provider: {
        id,
        name: data.name || "",
        price: data.price || "",
        photoUrl: data.photoUrl || "",
        department: data.department || "",
        city: data.city || "",
        whatsapp: data.whatsapp || "",
        description: data.description || "",
        rating: data.rating || 0,
        verificationBadge: data.verificationBadge || null,
        badgeVerificationLevel: data.badgeVerificationLevel || null,
        media: safeMedia,
      },
    });
  } catch (error) {
    console.error("Error loading provider:", error);
    return NextResponse.json(
      { error: "No pudimos cargar el prestador" },
      { status: 500 }
    );
  }
}
