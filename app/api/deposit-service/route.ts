import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import admin from "firebase-admin";

export async function POST(req: Request) {
  try {
    // ======================
    // Leer body
    // ======================
    const { buyerId, sellerId, amount } = await req.json();

    // ======================
    // Validaciones básicas
    // ======================
    if (!buyerId || !sellerId || !amount || isNaN(amount)) {
      return NextResponse.json(
        { error: "Datos inválidos" },
        { status: 400 }
      );
    }

    // ❌ No permitir abonarse a sí mismo
    if (buyerId === sellerId) {
      return NextResponse.json(
        { error: "No puedes abonarte a ti mismo" },
        { status: 400 }
      );
    }

    // ======================
    // Referencias
    // ======================
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

    const buyerBalance = Number(buyerSnap.data()?.balance || 0);

    if (buyerBalance < amount) {
      return NextResponse.json(
        { error: "Saldo insuficiente" },
        { status: 400 }
      );
    }

    // ======================
    // Cálculo del 10%
    // ======================
    const releasedAmount = Math.floor(amount * 0.1);

    // 🔑 UID REAL del prestador (EL FIX)
    const sellerAuthUid = sellerRef.id;

    // ======================
    // 🔥 TRANSACCIÓN SEGURA
    // ======================
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
        sellerId: sellerAuthUid,
        totalAmount: amount,
        releasedAmount,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 4️⃣ 🔔 Crear notificación (CORREGIDO)
      const notificationRef = adminDb.collection("notifications").doc();
      tx.set(notificationRef, {
        userId: sellerAuthUid, // ✅ ESTE ahora coincide con user.uid
        type: "deposit",
        title: "Nuevo abono recibido",
        message: `Recibiste un abono de $${amount.toLocaleString("es-CO")}`,
        amount,
        fromUserId: buyerId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    // ======================
    // Respuesta OK
    // ======================
    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error) {
    console.error("❌ DEPOSIT SERVICE ERROR:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
