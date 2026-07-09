import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import { setLedgerEntry } from "@/lib/ledger";
import {
  PROVIDER_PROMOTION_DAYS,
  PROVIDER_PROMOTION_PRICE,
} from "@/lib/providerPromotion";
import { isProviderSubscriptionPubliclyActive } from "@/lib/providerSubscription";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "provider-promotion",
      limit: 12,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: 4 * 1024,
    });

    const decoded = await requireAuthenticatedUser(request);
    const userRef = adminDb.collection("users").doc(decoded.uid);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      if (!snap.exists) throw new Error("USER_NOT_FOUND");

      const user = snap.data() || {};

      if (user.role !== "prestador") throw new Error("NOT_PROVIDER");
      if (user.blocked === true) throw new Error("PROVIDER_BLOCKED");
      if (user.verificationStatus !== "approved") {
        throw new Error("PROVIDER_NOT_APPROVED");
      }
      if (!isProviderSubscriptionPubliclyActive(user)) {
        throw new Error("SUBSCRIPTION_NOT_ACTIVE");
      }

      const balance = Number(user.balance || 0);

      if (balance < PROVIDER_PROMOTION_PRICE) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const currentPromotedUntil = user.promotedUntil?.toDate?.();
      const baseDate =
        currentPromotedUntil && currentPromotedUntil.getTime() > Date.now()
          ? currentPromotedUntil
          : new Date();
      const promotedUntil = new Date(
        baseDate.getTime() + PROVIDER_PROMOTION_DAYS * 24 * 60 * 60 * 1000
      );

      tx.update(userRef, {
        balance: admin.firestore.FieldValue.increment(-PROVIDER_PROMOTION_PRICE),
        promotedUntil: admin.firestore.Timestamp.fromDate(promotedUntil),
        promotedUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      const promotionRef = adminDb.collection("providerPromotions").doc();

      tx.set(promotionRef, {
        providerId: decoded.uid,
        amount: PROVIDER_PROMOTION_PRICE,
        days: PROVIDER_PROMOTION_DAYS,
        promotedUntil: admin.firestore.Timestamp.fromDate(promotedUntil),
        status: "completed",
        createdAt: adminFieldValue.serverTimestamp(),
      });

      setLedgerEntry(tx, {
        userId: decoded.uid,
        type: "provider_promotion",
        direction: "debit",
        amount: PROVIDER_PROMOTION_PRICE,
        status: "completed",
        sourceCollection: "providerPromotions",
        sourceId: promotionRef.id,
        metadata: { days: PROVIDER_PROMOTION_DAYS },
      });

      tx.set(adminDb.collection("notifications").doc(), {
        userId: decoded.uid,
        type: "provider_promotion",
        title: "Perfil promocionado",
        message: `Tu perfil estara entre los primeros durante ${PROVIDER_PROMOTION_DAYS} dias. Valor: $${PROVIDER_PROMOTION_PRICE.toLocaleString(
          "es-CO"
        )}.`,
        amount: PROVIDER_PROMOTION_PRICE,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      return { promotedUntil: promotedUntil.toISOString() };
    });

    return NextResponse.json({
      success: true,
      price: PROVIDER_PROMOTION_PRICE,
      days: PROVIDER_PROMOTION_DAYS,
      ...result,
    });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    if (error instanceof Error) {
      const messages: Record<string, { message: string; status: number }> = {
        USER_NOT_FOUND: { message: "Usuario no encontrado", status: 404 },
        NOT_PROVIDER: {
          message: "Solo las escorts pueden promocionar su perfil",
          status: 403,
        },
        PROVIDER_BLOCKED: {
          message: "No puedes promocionar un perfil bloqueado",
          status: 403,
        },
        PROVIDER_NOT_APPROVED: {
          message: "Tu perfil debe estar aprobado para promocionarlo",
          status: 403,
        },
        SUBSCRIPTION_NOT_ACTIVE: {
          message: "Debes tener la mensualidad al dia para promocionar tu perfil",
          status: 403,
        },
        INSUFFICIENT_BALANCE: {
          message: "Saldo insuficiente para promocionar tu perfil",
          status: 400,
        },
      };

      if (messages[error.message]) {
        return NextResponse.json(
          { error: messages[error.message].message },
          { status: messages[error.message].status }
        );
      }
    }

    const authError = authRouteError(error);

    if (authError.status !== 401 || authError.message !== "No autorizado") {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("PROVIDER PROMOTION ERROR:", error);
    return NextResponse.json(
      { error: "No pudimos promocionar el perfil" },
      { status: 500 }
    );
  }
}
