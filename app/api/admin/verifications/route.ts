import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";
import { getAdminQualityRank } from "@/lib/providerPromotion";
import { isProviderSubscriptionPastDue } from "@/lib/providerSubscription";

type VerificationStatus = "pending" | "approved" | "rejected";
type BadgeVerificationStatus = "none" | "pending" | "approved" | "rejected";
type VerificationBadge = "bronze" | "silver" | "gold" | "platinum";

type AdminMediaItem = {
  id: string;
  type: "photo" | "video";
  url: string;
  private: boolean;
  description?: string;
};

type ProviderVerification = {
  id: string;
  email?: string;
  name?: string;
  price?: string | number;
  description?: string;
  whatsapp?: string;
  city?: string;
  department?: string;
  zone?: string;
  photoUrl?: string;
  blocked?: boolean;
  blockedReason?: string | null;
  balance?: number;
  verificationPhotoUrl?: string;
  verificationStatus?: VerificationStatus;
  verificationBadge?: VerificationBadge | null;
  badgeVerificationStatus?: BadgeVerificationStatus;
  badgeVerificationLevel?: 1 | 2 | 3 | 4;
  badgeVerificationVideoUrl?: string | null;
  badgeVerificationEvidenceType?: "photo" | "video" | null;
  badgeVerificationRequestedAt?: string | null;
  blockedAt?: string | null;
  subscriptionStatus?: string | null;
  subscriptionNextChargeAt?: string | null;
  subscriptionLastPaidAt?: string | null;
  subscriptionAmount?: number | null;
  subscriptionManualOverride?: boolean;
  adminQualityRank?: number | null;
  media?: AdminMediaItem[];
  createdAt?: string | null;
};

const toDateString = (value: FirebaseFirestore.Timestamp | undefined) => {
  return value?.toDate?.().toISOString() ?? null;
};

const sanitizeMediaForAdmin = (value: unknown): AdminMediaItem[] => {
  if (!Array.isArray(value)) return [];

  const items: Array<AdminMediaItem | null> = value.map((item, index) => {
      if (!item || typeof item !== "object") return null;

      const media = item as Record<string, unknown>;
      const url = typeof media.url === "string" ? media.url : "";

      if (!url) return null;

      return {
        id: typeof media.id === "string" ? media.id : `legacy-${index}`,
        type: media.type === "video" ? "video" : "photo",
        url,
        private: Boolean(media.private),
        description:
          typeof media.description === "string" ? media.description : "",
      };
    });

  return items.filter((item): item is AdminMediaItem => Boolean(item));
};

const matchesProviderSearch = (
  provider: ProviderVerification,
  query: string
) => {
  if (!query) return true;

  const haystack = [
    provider.name,
    provider.email,
    provider.whatsapp,
    provider.city,
    provider.department,
    provider.zone,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
};

export async function GET(request: Request) {
  try {
    await requireOwner(request);

    const searchParams = new URL(request.url).searchParams;
    const query = searchParams.get("q")?.trim().toLowerCase() || "";
    const filter = searchParams.get("filter");

    const snapshot = await adminDb
      .collection("users")
      .where("role", "==", "prestador")
      .get();

    const providers: ProviderVerification[] = snapshot.docs
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          email: data.email,
          name: data.name,
          price: data.price,
          description: data.description,
          whatsapp: data.whatsapp,
          city: data.city,
          department: data.department,
          zone: data.zone,
          photoUrl: data.photoUrl,
          blocked: Boolean(data.blocked),
          blockedReason: data.blockedReason || null,
          balance: Number(data.balance || 0),
          verificationPhotoUrl: data.verificationPhotoUrl,
          verificationStatus: data.verificationStatus,
          verificationBadge: data.verificationBadge || null,
          badgeVerificationStatus: data.badgeVerificationStatus,
          badgeVerificationLevel: data.badgeVerificationLevel,
          badgeVerificationVideoUrl: data.badgeVerificationVideoUrl || null,
          badgeVerificationEvidenceType:
            data.badgeVerificationEvidenceType || null,
          badgeVerificationRequestedAt: toDateString(
            data.badgeVerificationRequestedAt
          ),
          blockedAt: toDateString(data.blockedAt),
          subscriptionStatus: data.subscriptionStatus || null,
          subscriptionNextChargeAt: toDateString(data.subscriptionNextChargeAt),
          subscriptionLastPaidAt: toDateString(data.subscriptionLastPaidAt),
          subscriptionAmount: data.subscriptionAmount || null,
          subscriptionManualOverride: Boolean(data.subscriptionManualOverride),
          adminQualityRank: getAdminQualityRank(data.adminQualityRank) || null,
          media: sanitizeMediaForAdmin(data.media),
          createdAt: toDateString(data.createdAt),
        };
      })
      .filter((provider) => {
        if (filter === "blocked") {
          if (!provider.blocked) return false;

          return matchesProviderSearch(provider, query);
        }

        if (filter === "past_due") {
          if (!isProviderSubscriptionPastDue(provider)) return false;

          return matchesProviderSearch(provider, query);
        }

        if (query) {
          return matchesProviderSearch(provider, query);
        }

        return (
          !provider.verificationStatus ||
          provider.verificationStatus === "pending" ||
          provider.badgeVerificationStatus === "pending"
        );
      })
      .sort((a, b) => {
        if (filter === "blocked") {
          return String(b.blockedAt || b.createdAt || "").localeCompare(
            String(a.blockedAt || a.createdAt || "")
          );
        }

        if (filter === "past_due") {
          return String(
            a.subscriptionNextChargeAt || a.blockedAt || a.createdAt || ""
          ).localeCompare(
            String(
              b.subscriptionNextChargeAt || b.blockedAt || b.createdAt || ""
            )
          );
        }

        if (!a.verificationStatus || a.verificationStatus === "pending") {
          return -1;
        }
        if (!b.verificationStatus || b.verificationStatus === "pending") {
          return 1;
        }

        return String(
          b.badgeVerificationRequestedAt || b.createdAt || ""
        ).localeCompare(String(a.badgeVerificationRequestedAt || a.createdAt || ""));
      });

    return NextResponse.json({ providers });
  } catch (error) {
    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}
