import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import {
  authRouteError,
  requireAuthenticatedUser,
  requireUserDocument,
} from "@/lib/serverAuth";

const PREMIUM_BALANCE_REQUIREMENT = 500000;

type PurchasedContentItem = {
  sellerId?: string;
  mediaId?: string;
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
      countLimited("contentPurchases", "buyerId", decoded.uid),
      countLimited("serviceDeposits", "buyerId", decoded.uid),
    ]);

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
