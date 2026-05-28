import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import { setLedgerEntry } from "@/lib/ledger";
import {
  EXTRA_VIDEO_SECONDS,
  EXTRA_VIDEO_TIME_PRICE,
} from "@/lib/providerMediaLimits";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const decoded = await requireAuthenticatedUser(request);
    const userRef = adminDb.collection("users").doc(decoded.uid);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      if (!snap.exists) throw new Error("USER_NOT_FOUND");

      const user = snap.data() || {};

      if (user.role !== "prestador") throw new Error("NOT_PROVIDER");

      const balance = Number(user.balance || 0);

      if (balance < EXTRA_VIDEO_TIME_PRICE) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const currentSeconds = Number(user.videoSecondsExtra || 0);
      const nextSeconds = currentSeconds + EXTRA_VIDEO_SECONDS;
      const nextMinutes = Math.floor(nextSeconds / 60);

      tx.update(userRef, {
        balance: admin.firestore.FieldValue.increment(-EXTRA_VIDEO_TIME_PRICE),
        videoSecondsExtra: admin.firestore.FieldValue.increment(
          EXTRA_VIDEO_SECONDS
        ),
        videoTimeUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      const purchaseRef = adminDb.collection("providerVideoTimePurchases").doc();

      tx.set(purchaseRef, {
        providerId: decoded.uid,
        amount: EXTRA_VIDEO_TIME_PRICE,
        seconds: EXTRA_VIDEO_SECONDS,
        status: "completed",
        createdAt: adminFieldValue.serverTimestamp(),
      });

      setLedgerEntry(tx, {
        userId: decoded.uid,
        type: "provider_video_time_purchase",
        direction: "debit",
        amount: EXTRA_VIDEO_TIME_PRICE,
        status: "completed",
        sourceCollection: "providerVideoTimePurchases",
        sourceId: purchaseRef.id,
        metadata: { seconds: EXTRA_VIDEO_SECONDS },
      });

      tx.set(adminDb.collection("notifications").doc(), {
        userId: decoded.uid,
        type: "provider_video_time_purchase",
        title: "Tiempo extra de video activado",
        message: `Compraste 1 minuto extra de video por $${EXTRA_VIDEO_TIME_PRICE.toLocaleString(
          "es-CO"
        )}. Ahora tienes ${nextMinutes} minuto${
          nextMinutes === 1 ? "" : "s"
        } extra.`,
        amount: EXTRA_VIDEO_TIME_PRICE,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      return { videoSecondsExtra: nextSeconds };
    });

    return NextResponse.json({
      success: true,
      price: EXTRA_VIDEO_TIME_PRICE,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, { message: string; status: number }> = {
        USER_NOT_FOUND: { message: "Usuario no encontrado", status: 404 },
        NOT_PROVIDER: { message: "Solo las escorts pueden comprar cupos", status: 403 },
        INSUFFICIENT_BALANCE: {
          message: "Saldo insuficiente para comprar tiempo extra de video",
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

    console.error("PROVIDER VIDEO SLOT ERROR:", error);
    return NextResponse.json(
      { error: "No pudimos comprar el cupo extra" },
      { status: 500 }
    );
  }
}
