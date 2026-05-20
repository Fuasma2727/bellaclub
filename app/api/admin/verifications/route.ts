import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";

type VerificationStatus = "pending" | "approved" | "rejected";
type BadgeVerificationStatus = "none" | "pending" | "approved" | "rejected";
type VerificationBadge = "gold" | "diamond";

type ProviderVerification = {
  id: string;
  email?: string;
  name?: string;
  whatsapp?: string;
  city?: string;
  department?: string;
  photoUrl?: string;
  blocked?: boolean;
  verificationPhotoUrl?: string;
  verificationStatus?: VerificationStatus;
  verificationBadge?: VerificationBadge | null;
  badgeVerificationStatus?: BadgeVerificationStatus;
  badgeVerificationLevel?: 1 | 2;
  badgeVerificationVideoUrl?: string | null;
  badgeVerificationRequestedAt?: string | null;
  blockedAt?: string | null;
  createdAt?: string | null;
};

const toDateString = (value: FirebaseFirestore.Timestamp | undefined) => {
  return value?.toDate?.().toISOString() ?? null;
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
          whatsapp: data.whatsapp,
          city: data.city,
          department: data.department,
          photoUrl: data.photoUrl,
          blocked: Boolean(data.blocked),
          verificationPhotoUrl: data.verificationPhotoUrl,
          verificationStatus: data.verificationStatus,
          verificationBadge: data.verificationBadge || null,
          badgeVerificationStatus: data.badgeVerificationStatus,
          badgeVerificationLevel: data.badgeVerificationLevel,
          badgeVerificationVideoUrl: data.badgeVerificationVideoUrl || null,
          badgeVerificationRequestedAt: toDateString(
            data.badgeVerificationRequestedAt
          ),
          blockedAt: toDateString(data.blockedAt),
          createdAt: toDateString(data.createdAt),
        };
      })
      .filter((provider) => {
        const needsInitialApproval =
          !provider.verificationStatus ||
          provider.verificationStatus === "pending";

        if (filter === "blocked") {
          if (!provider.blocked) return false;

          if (!query) return true;

          const haystack = [
            provider.name,
            provider.email,
            provider.whatsapp,
            provider.city,
            provider.department,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(query);
        }

        if (query) {
          const haystack = [
            provider.name,
            provider.email,
            provider.whatsapp,
            provider.city,
            provider.department,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(query);
        }

        return needsInitialApproval || provider.badgeVerificationStatus === "pending";
      })
      .sort((a, b) => {
        if (filter === "blocked") {
          return String(b.blockedAt || b.createdAt || "").localeCompare(
            String(a.blockedAt || a.createdAt || "")
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
