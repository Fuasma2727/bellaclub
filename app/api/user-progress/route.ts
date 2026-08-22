import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  authRouteError,
  requireAuthenticatedUser,
  requireUserDocument,
} from "@/lib/serverAuth";
import { getPublicProviderProfileById } from "@/lib/publicProviders";

const PREMIUM_BALANCE_REQUIREMENT = 500000;

type PurchasedContentItem = {
  sellerId?: string;
  mediaId?: string;
  purchasedAt?: string;
};

type PurchaseCandidate = {
  sellerId: string;
  mediaId: string;
  purchasedAtMs: number;
  order: number;
};

const countLimited = async (
  collectionName: string,
  field: string,
  value: string
) => {
  const snapshot = await adminDb
    .collection(collectionName)
    .where(field, "==", value)
    .limit(50)
    .get();

  return {
    count: snapshot.size,
    hasAny: !snapshot.empty,
  };
};

const toMillis = (value: unknown) => {
  if (!value) return 0;
  if (typeof value === "string") {
    const millis = new Date(value).getTime();
    return Number.isFinite(millis) ? millis : 0;
  }
  if (value instanceof Date) return value.getTime();

  const maybeTimestamp = value as { toDate?: () => Date };
  return maybeTimestamp.toDate?.().getTime() || 0;
};

const getContentPurchaseStats = async (buyerId: string) => {
  const snapshot = await adminDb
    .collection("contentPurchases")
    .where("buyerId", "==", buyerId)
    .limit(50)
    .get();

  return {
    count: snapshot.size,
    hasAny: !snapshot.empty,
    purchases: snapshot.docs.flatMap((doc, index) => {
      const data = doc.data();
      const sellerId = String(data.sellerId || "");
      const mediaId = String(data.mediaId || "");

      if (!sellerId || !mediaId) return [];

      return [
        {
          sellerId,
          mediaId,
          purchasedAtMs: toMillis(data.createdAt),
          order: index,
        },
      ];
    }),
  };
};

const getLatestUnlockedProvider = async (purchase?: PurchaseCandidate) => {
  if (!purchase) return null;

  const provider = await getPublicProviderProfileById(purchase.sellerId);

  if (!provider) return null;

  return {
    id: provider.id,
    name: provider.name || "",
    profilePath: provider.profilePath || "",
    mediaId: purchase.mediaId,
  };
};

export async function GET(request: Request) {
  try {
    const decoded = await requireAuthenticatedUser(request);
    const { data } = await requireUserDocument(decoded.uid);

    const purchasedContent = Array.isArray(data.purchasedContent)
      ? (data.purchasedContent as PurchasedContentItem[])
      : [];
    const validPurchasedContent = purchasedContent.filter(
      (item) => item?.sellerId && item?.mediaId
    );
    const [purchaseStats, depositStats] = await Promise.all([
      getContentPurchaseStats(decoded.uid),
      countLimited("serviceDeposits", "buyerId", decoded.uid),
    ]);
    const purchaseCandidates = [
      ...validPurchasedContent.map((item, index) => ({
        sellerId: item.sellerId || "",
        mediaId: item.mediaId || "",
        purchasedAtMs: toMillis(item.purchasedAt),
        order: index,
      })),
      ...purchaseStats.purchases.map((item, index) => ({
        ...item,
        order: validPurchasedContent.length + index,
      })),
    ].filter(
      (item): item is PurchaseCandidate =>
        Boolean(item.sellerId && item.mediaId)
    );
    const latestPurchase = purchaseCandidates.sort(
      (a, b) => b.purchasedAtMs - a.purchasedAtMs || b.order - a.order
    )[0];
    const latestUnlockedProvider =
      await getLatestUnlockedProvider(latestPurchase);

    const unlockedContentCount = Math.max(
      validPurchasedContent.length,
      purchaseStats.count
    );
    const hasUnlockedContent =
      unlockedContentCount > 0 || purchaseStats.hasAny;
    const serviceDepositCount = depositStats.count;
    const hasServiceDeposit = depositStats.hasAny;
    const balance = Number(data.balance || 0);

    let level = 1;

    if (hasUnlockedContent) level = 2;
    if (level >= 2 && hasServiceDeposit) level = 3;
    if (level >= 3 && balance >= PREMIUM_BALANCE_REQUIREMENT) level = 4;

    return NextResponse.json({
      level,
      maxLevel: 4,
      balance,
      unlockedContentCount,
      hasUnlockedContent,
      serviceDepositCount,
      hasServiceDeposit,
      premiumBalanceRequirement: PREMIUM_BALANCE_REQUIREMENT,
      isCatadorPremium: level >= 4,
      latestUnlockedProvider,
    });
  } catch (error) {
    const authError = authRouteError(error);

    if (authError.status !== 401 || authError.message !== "No autorizado") {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("USER PROGRESS ERROR:", error);

    return NextResponse.json(
      { error: "No pudimos cargar tu progreso" },
      { status: 500 }
    );
  }
}
