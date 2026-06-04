import { NextResponse } from "next/server";
import admin from "firebase-admin";
import { adminDb } from "@/lib/firebaseAdmin";
import { calculateCommission } from "@/lib/commission";
import { setLedgerEntry } from "@/lib/ledger";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

const allowedAmounts = [50000, 100000, 300000, 500000];

const createDepositCode = () => {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `BC-${random}`;
};

export async function POST(req: Request) {
  try {
    guardMutationRequest(req, {
      rateLimitKey: "deposit-service",
      limit: 30,
      windowMs: 60 * 1000,
      maxBodyBytes: 8 * 1024,
    });

    const decoded = await requireAuthenticatedUser(req);
    const { sellerId, amount } = await req.json();
    const buyerId = decoded.uid;
    const depositAmount = Number(amount);

    if (!sellerId || !depositAmount || isNaN(depositAmount)) {
      return NextResponse.json({ error: "Datos invalidos" }, { status: 400 });
    }

    if (!allowedAmounts.includes(depositAmount)) {
      return NextResponse.json(
        { error: "Monto de abono invalido" },
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
    const sellerSnap = await sellerRef.get();

    if (!sellerSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const sellerData = sellerSnap.data() || {};

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

    const {
      commissionAmount,
      commissionRate,
      releasedAmount,
      totalAmount,
    } = calculateCommission(depositAmount);
    const sellerName =
      sellerData.name ||
      sellerData.displayName ||
      sellerData.fullName ||
      sellerData.username ||
      sellerData.email ||
      "Escort";
    const depositCode = createDepositCode();

    await adminDb.runTransaction(async (tx) => {
      const buyerSnap = await tx.get(buyerRef);

      if (!buyerSnap.exists) {
        throw new Error("BUYER_NOT_FOUND");
      }

      const buyerData = buyerSnap.data() || {};
      const buyerBalance = Number(buyerData.balance || 0);

      if (buyerBalance < depositAmount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const buyerName =
        buyerData.name ||
        buyerData.displayName ||
        buyerData.fullName ||
        buyerData.username ||
        "Usuario";

      tx.update(buyerRef, {
        balance: admin.firestore.FieldValue.increment(-depositAmount),
      });

      tx.update(sellerRef, {
        balance: admin.firestore.FieldValue.increment(releasedAmount),
      });

      const depositRef = adminDb.collection("serviceDeposits").doc();

      tx.set(depositRef, {
        code: depositCode,
        buyerId,
        sellerId,
        totalAmount,
        commissionAmount,
        commissionRate,
        releasedAmount,
        status: "pending",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      setLedgerEntry(tx, {
        userId: buyerId,
        counterpartyUserId: sellerId,
        type: "service_deposit",
        direction: "debit",
        amount: totalAmount,
        commissionAmount,
        netAmount: releasedAmount,
        status: "completed",
        sourceCollection: "serviceDeposits",
        sourceId: depositRef.id,
        metadata: { code: depositCode },
      });

      setLedgerEntry(tx, {
        userId: sellerId,
        counterpartyUserId: buyerId,
        type: "service_deposit_received",
        direction: "credit",
        amount: releasedAmount,
        commissionAmount,
        netAmount: releasedAmount,
        status: "completed",
        sourceCollection: "serviceDeposits",
        sourceId: depositRef.id,
        metadata: { code: depositCode },
      });

      setLedgerEntry(tx, {
        userId: null,
        counterpartyUserId: sellerId,
        type: "service_deposit_commission",
        direction: "commission",
        amount: commissionAmount,
        commissionAmount,
        status: "completed",
        sourceCollection: "serviceDeposits",
        sourceId: depositRef.id,
        metadata: { buyerId, sellerId, code: depositCode },
      });

      tx.set(adminDb.collection("notifications").doc(), {
        userId: sellerId,
        type: "deposit",
        title: "Nuevo abono recibido",
        message: `${buyerName} te abonó $${totalAmount.toLocaleString("es-CO")}. Comisión BelaClub: $${commissionAmount.toLocaleString("es-CO")}. Total para ti: $${releasedAmount.toLocaleString("es-CO")}. Código: ${depositCode}`,
        code: depositCode,
        totalAmount,
        commissionAmount,
        commissionRate,
        releasedAmount,
        fromUserId: buyerId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.set(adminDb.collection("notifications").doc(), {
        userId: buyerId,
        type: "deposit_confirmation",
        title: "Abono confirmado",
        message: `Abonaste $${totalAmount.toLocaleString("es-CO")} a ${sellerName}. Codigo: ${depositCode}`,
        code: depositCode,
        totalAmount,
        commissionAmount,
        commissionRate,
        releasedAmount,
        sellerId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true, code: depositCode }, { status: 200 });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Saldo insuficiente" },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "BUYER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const authError = authRouteError(error);

    if (authError.status !== 401 || authError.message !== "No autorizado") {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("DEPOSIT SERVICE ERROR:", error);

    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
