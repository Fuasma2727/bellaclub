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
          whatsapp: data.whatsapp || "",
          rating: data.rating || 0,
          verificationBadge: data.verificationBadge || null,
          badgeVerificationLevel: data.badgeVerificationLevel || null,
          promotedUntil: data.promotedUntil?.toDate?.().toISOString() || null,
          promotedRank:
            data.promotedUntil?.toDate?.().getTime?.() > now ? 1 : 0,
          verificationRank: getVerificationRank(
            data.badgeVerificationLevel,
            data.verificationBadge
          ),
          createdAt: data.createdAt?.toDate?.().toISOString() || null,
          media: sanitizeMediaForCard(data.media),
        };
      })
      .filter((provider) => !provider.blocked)
      .sort((a, b) => {
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
        whatsapp: provider.whatsapp,
        rating: provider.rating,
        verificationBadge: provider.verificationBadge,
        badgeVerificationLevel: provider.badgeVerificationLevel,
        promotedUntil: provider.promotedUntil,
        media: provider.media,
      }));

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("Error loading providers:", error);
    return NextResponse.json(
      { error: "No pudimos cargar los prestadores" },
      { status: 500 }
    );
  }
}
