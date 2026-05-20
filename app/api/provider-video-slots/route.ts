import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import { EXTRA_VIDEO_SLOT_PRICE } from "@/lib/providerMediaLimits";

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

      if (balance < EXTRA_VIDEO_SLOT_PRICE) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const currentSlots = Number(user.videoSlotsExtra || 0);
      const nextSlots = currentSlots + 1;

      tx.update(userRef, {
        balance: admin.firestore.FieldValue.increment(-EXTRA_VIDEO_SLOT_PRICE),
        videoSlotsExtra: admin.firestore.FieldValue.increment(1),
        videoSlotsUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      tx.set(adminDb.collection("providerVideoSlotPurchases").doc(), {
        providerId: decoded.uid,
        amount: EXTRA_VIDEO_SLOT_PRICE,
        slots: 1,
        status: "completed",
        createdAt: adminFieldValue.serverTimestamp(),
      });

      tx.set(adminDb.collection("notifications").doc(), {
        userId: decoded.uid,
        type: "provider_video_slot_purchase",
        title: "Cupo extra de video activado",
        message: `Compraste 1 cupo extra de video por $${EXTRA_VIDEO_SLOT_PRICE.toLocaleString(
          "es-CO"
        )}. Ahora tienes ${nextSlots} cupo${
          nextSlots === 1 ? "" : "s"
        } extra.`,
        amount: EXTRA_VIDEO_SLOT_PRICE,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      return { videoSlotsExtra: nextSlots };
    });

    return NextResponse.json({
      success: true,
      price: EXTRA_VIDEO_SLOT_PRICE,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, { message: string; status: number }> = {
        USER_NOT_FOUND: { message: "Usuario no encontrado", status: 404 },
        NOT_PROVIDER: { message: "Solo prestadores pueden comprar cupos", status: 403 },
        INSUFFICIENT_BALANCE: {
          message: "Saldo insuficiente para comprar un cupo extra de video",
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
