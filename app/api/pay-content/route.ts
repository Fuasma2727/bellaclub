import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import admin from "firebase-admin";

export async function POST(req: Request) {
  console.log("🔥 PAY-CONTENT API HIT");

  try {
    const body = await req.json();

    const buyerId = body.buyerId;
    const sellerId = body.sellerId;
    const price = Number(body.price);
    const mediaUrl = body.mediaUrl;

    // ======================
    // Validaciones básicas
    // ======================
    if (!buyerId || !sellerId || !price || isNaN(price) || !mediaUrl) {
      return NextResponse.json(
        { error: "Datos incompletos o inválidos" },
        { status: 400 }
      );
    }

    // ❌ NO permitir comprarse a sí mismo
    if (buyerId === sellerId) {
      return NextResponse.json(
        { error: "No puedes comprar tu propio contenido" },
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

    const buyerData = buyerSnap.data()!;
    const sellerData = sellerSnap.data()!;

    const buyerBalance = Number(buyerData.balance || 0);
    const sellerBalance = Number(sellerData.balance || 0);

    if (buyerBalance < price) {
      return NextResponse.json(
        { error: "Saldo insuficiente" },
        { status: 400 }
      );
    }

    // ======================
    // 🔥 TRANSACCIÓN SEGURA
    // ======================
    await adminDb.runTransaction(async (tx) => {
      tx.update(buyerRef, {
        balance: buyerBalance - price,
        purchasedContent: admin.firestore.FieldValue.arrayUnion({
          sellerId,
          mediaUrl,
        }),
      });

      tx.update(sellerRef, {
        balance: sellerBalance + price,
      });
    });

    // ======================
    // RESPUESTA OK
    // ======================
    return NextResponse.json(
      { success: true },
      { status: 200 }
    );

  } catch (err) {
    console.error("❌ PAY CONTENT ERROR:", err);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
