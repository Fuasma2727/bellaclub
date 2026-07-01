import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import admin from "firebase-admin";
import { calculateCommission } from "@/lib/commission";
import { setLedgerEntry } from "@/lib/ledger";
import { createPrivateMediaUrl } from "@/lib/privateMediaAccess";
import { releaseReferralReward } from "@/lib/referrals";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

type MediaItem = {
  id?: string;
  url?: string;
  private?: boolean;
  price?: number | string | null;
};

export async function POST(req: Request) {
  try {
    guardMutationRequest(req, {
      rateLimitKey: "pay-content",
      limit: 30,
      windowMs: 60 * 1000,
      maxBodyBytes: 8 * 1024,
    });

    const decoded = await requireAuthenticatedUser(req);
    const body = await req.json();

    const buyerId = decoded.uid;
    const sellerId = body.sellerId;
    const mediaId = body.mediaId;

    if (!buyerId || !sellerId || !mediaId) {
      return NextResponse.json(
        { error: "Datos incompletos o invalidos" },
        { status: 400 }
      );
    }

    if (buyerId === sellerId) {
      return NextResponse.json(
        { error: "No puedes comprar tu propio contenido" },
        { status: 400 }
      );
    }

    const buyerRef = adminDb.collection("users").doc(buyerId);
    const sellerRef = adminDb.collection("users").doc(sellerId);

    const sellerSnap = await sellerRef.get();

    if (!sellerSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const sellerData = sellerSnap.data()!;

    if (
      sellerData.role !== "prestador" ||
      sellerData.profileVisible !== true ||
      sellerData.verificationStatus !== "approved" ||
      sellerData.blocked === true
    ) {
      return NextResponse.json(
        { error: "Perfil no disponible" },
        { status: 404 }
      );
    }

    const sellerMedia = Array.isArray(sellerData.media)
      ? (sellerData.media as MediaItem[])
      : [];
    const targetIndex = sellerMedia.findIndex(
      (item, index) => (item.id || `legacy-${index}`) === mediaId
    );
    const targetMedia = targetIndex >= 0 ? sellerMedia[targetIndex] : null;

    if (!targetMedia?.private || !targetMedia.url) {
      return NextResponse.json(
        { error: "Contenido privado no encontrado" },
        { status: 404 }
      );
    }

    const price = Number(targetMedia.price || 0);

    if (!price || isNaN(price)) {
      return NextResponse.json(
        { error: "Precio invalido" },
        { status: 400 }
      );
    }

    const {
      commissionAmount,
      commissionRate,
      releasedAmount,
      totalAmount,
    } = calculateCommission(price);

    let purchaseAlreadyCompleted = false;

    await adminDb.runTransaction(async (tx) => {
      const buyerSnap = await tx.get(buyerRef);

      if (!buyerSnap.exists) {
        throw new Error("BUYER_NOT_FOUND");
      }

      const buyerData = buyerSnap.data() || {};
      const buyerBalance = Number(buyerData.balance || 0);
      const purchasedContent = Array.isArray(buyerData.purchasedContent)
        ? buyerData.purchasedContent
        : [];

      const alreadyPurchased = purchasedContent.some(
        (item) => item?.sellerId === sellerId && item?.mediaId === mediaId
      );

      if (alreadyPurchased) {
        purchaseAlreadyCompleted = true;
        return;
      }

      if (buyerBalance < totalAmount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      tx.update(buyerRef, {
        balance: admin.firestore.FieldValue.increment(-totalAmount),
        purchasedContent: admin.firestore.FieldValue.arrayUnion({
          sellerId,
          mediaId,
          totalAmount,
          commissionAmount,
          commissionRate,
          releasedAmount,
          purchasedAt: new Date().toISOString(),
        }),
      });

      tx.update(sellerRef, {
        balance: admin.firestore.FieldValue.increment(releasedAmount),
      });

      const purchaseRef = adminDb.collection("contentPurchases").doc();

      tx.set(purchaseRef, {
        buyerId,
        sellerId,
        mediaId,
        totalAmount,
        commissionAmount,
        commissionRate,
        releasedAmount,
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      setLedgerEntry(tx, {
        userId: buyerId,
        counterpartyUserId: sellerId,
        type: "content_purchase",
        direction: "debit",
        amount: totalAmount,
        commissionAmount,
        netAmount: releasedAmount,
        status: "completed",
        sourceCollection: "contentPurchases",
        sourceId: purchaseRef.id,
        metadata: { mediaId },
      });

      setLedgerEntry(tx, {
        userId: sellerId,
        counterpartyUserId: buyerId,
        type: "content_sale",
        direction: "credit",
        amount: releasedAmount,
        commissionAmount,
        netAmount: releasedAmount,
        status: "completed",
        sourceCollection: "contentPurchases",
        sourceId: purchaseRef.id,
        metadata: { mediaId },
      });

      setLedgerEntry(tx, {
        userId: null,
        counterpartyUserId: sellerId,
        type: "content_commission",
        direction: "commission",
        amount: commissionAmount,
        commissionAmount,
        status: "completed",
        sourceCollection: "contentPurchases",
        sourceId: purchaseRef.id,
        metadata: { buyerId, sellerId, mediaId },
      });
    });

    if (!purchaseAlreadyCompleted) {
      try {
        await releaseReferralReward(buyerId, "client_activation", {
          trigger: "content_purchase",
          sellerId,
          mediaId,
        });
      } catch (referralError) {
        console.error("REFERRAL REWARD ERROR:", referralError);
      }
    }

    return NextResponse.json(
      {
        success: true,
        alreadyPurchased: purchaseAlreadyCompleted,
        mediaId,
        commissionAmount,
        releasedAmount,
        mediaUrl: createPrivateMediaUrl(req, {
          buyerId,
          sellerId,
          mediaId,
        }),
      },
      { status: 200 }
    );
  } catch (err) {
    const securityError = securityErrorResponse(err);
    if (securityError) return securityError;

    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Saldo insuficiente" },
        { status: 400 }
      );
    }

    if (err instanceof Error && err.message === "BUYER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const authError = authRouteError(err);

    if (authError.status !== 401 || authError.message !== "No autorizado") {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("PAY CONTENT ERROR:", err);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
