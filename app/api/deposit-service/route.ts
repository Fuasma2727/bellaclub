import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import admin from "firebase-admin";

export async function POST(req: Request) {
  try {
    const { buyerId, sellerId, amount } = await req.json();

    if (!buyerId || !sellerId || !amount || isNaN(amount)) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 }
      );
    }

    if (buyerId === sellerId) {
      return NextResponse.json(
        { error: "No puedes abonarte a ti mismo" },
        { status: 400 }
      );
    }

    const buyerRef = adminDb.collection("users").doc(buyerId);
    const sellerRef = adminDb.collection("users").doc(sellerId);

    const buyerSnap = await buyerRef.get();
    const sellerSnap = await sellerRef.get();

    if (!buyerSnap.exists || !sellerSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const buyerData = buyerSnap.data();
    const sellerData = sellerSnap.data();

    const buyerBalance = Number(buyerData?.balance || 0);

    if (buyerBalance < amount) {
      return NextResponse.json(
        { error: "Saldo insuficiente" },
        { status: 400 }
      );
    }

    // 🔥 Nombre del comprador
const buyerName =
  buyerData?.name ||
  buyerData?.displayName ||
  buyerData?.fullName ||
  buyerData?.username ||
  "Usuario";

    // ======================
    // Cálculo del 10%
    // ======================
    const releasedAmount = Math.floor(Number(amount) * 1);

    await adminDb.runTransaction(async (tx) => {
      // 1️⃣ Restar saldo al comprador
      tx.update(buyerRef, {
        balance: buyerBalance - amount,
      });

      // 2️⃣ Sumar SOLO el 10% al prestador
      tx.update(sellerRef, {
        balance: admin.firestore.FieldValue.increment(releasedAmount),
      });

      // 3️⃣ Registrar el abono
      const depositRef = adminDb.collection("serviceDeposits").doc();
      tx.set(depositRef, {
        buyerId,
        sellerId,
        totalAmount: amount,
        releasedAmount,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 4️⃣ 🔔 Crear notificación CORRECTA
      const notificationRef = adminDb.collection("notifications").doc();
      tx.set(notificationRef, {
        userId: sellerId,
        type: "deposit",
        title: "Nuevo abono recibido",
        message: `${buyerName} te abonó $${releasedAmount.toLocaleString("es-CO")}`,
        totalAmount: amount,
        releasedAmount,
        fromUserId: buyerId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("❌ DEPOSIT SERVICE ERROR:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}