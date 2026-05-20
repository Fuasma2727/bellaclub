import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

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
          media: sanitizeMediaForCard(data.media),
        };
      })
      .filter((provider) => !provider.blocked);

    return NextResponse.json({ providers });
  } catch (error) {
    console.error("Error loading providers:", error);
    return NextResponse.json(
      { error: "No pudimos cargar los prestadores" },
      { status: 500 }
    );
  }
}
