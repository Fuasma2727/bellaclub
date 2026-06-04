import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { setLedgerEntry } from "@/lib/ledger";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

type WithdrawalStatus = "pending_wompi" | "paid" | "rejected";

const toDateString = (value: FirebaseFirestore.Timestamp | undefined) => {
  return value?.toDate?.().toISOString() ?? null;
};

export async function GET(request: Request) {
  try {
    await requireOwner(request);

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get("status") ||
      "pending_wompi") as WithdrawalStatus;
    const query = searchParams.get("q")?.trim().toLowerCase() || "";
    const snapshot = await adminDb
      .collection("withdrawals")
      .where("status", "==", status)
      .get();

    const withdrawals = snapshot.docs
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          providerId: data.providerId || "",
          providerEmail: data.providerEmail || "",
          providerName: data.providerName || "Prestador sin nombre",
          amount: Number(data.amount || 0),
          commissionAmount: Number(data.commissionAmount || 0),
          releasedAmount: Number(data.releasedAmount || 0),
          payoutProvider: data.payoutProvider || "wompi",
          payoutMethod: data.payoutMethod || "",
          payoutAccount: data.payoutAccount || "",
          payoutAccountType: data.payoutAccountType || "",
          accountHolder: data.accountHolder || "",
          status: data.status || "pending_wompi",
          createdAt: toDateString(data.createdAt),
          paidAt: toDateString(data.paidAt),
          rejectedAt: toDateString(data.rejectedAt),
        };
      })
      .filter((withdrawal) => {
        if (!query) return true;

        const haystack = [
          withdrawal.providerName,
          withdrawal.providerEmail,
          withdrawal.accountHolder,
          withdrawal.payoutMethod,
          withdrawal.payoutAccount,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );

    return NextResponse.json({ withdrawals });
  } catch (error) {
    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "admin-withdrawals-action",
      limit: 60,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: 8 * 1024,
    });

    const owner = await requireOwner(request);
    const { withdrawalId, action } = (await request.json()) as {
      withdrawalId?: string;
      action?: "markPaid" | "reject";
    };

    if (!withdrawalId || !action) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 400 }
      );
    }

    const withdrawalRef = adminDb.collection("withdrawals").doc(withdrawalId);
    const notificationRef = adminDb.collection("notifications").doc();

    await adminDb.runTransaction(async (tx) => {
      const withdrawalSnap = await tx.get(withdrawalRef);

      if (!withdrawalSnap.exists) {
        throw new Error("WITHDRAWAL_NOT_FOUND");
      }

      const withdrawal = withdrawalSnap.data() || {};

      if (withdrawal.status !== "pending_wompi") {
        throw new Error("WITHDRAWAL_ALREADY_PROCESSED");
      }

      const providerId = String(withdrawal.providerId || "");
      const amount = Number(withdrawal.amount || 0);
      const releasedAmount = Number(withdrawal.releasedAmount || 0);
      const commissionAmount = Number(withdrawal.commissionAmount || 0);

      if (!providerId) {
        throw new Error("PROVIDER_NOT_FOUND");
      }

      if (action === "reject") {
        const providerRef = adminDb.collection("users").doc(providerId);

        tx.update(providerRef, {
          balance: adminFieldValue.increment(amount),
          updatedAt: adminFieldValue.serverTimestamp(),
        });

        tx.update(withdrawalRef, {
          status: "rejected",
          rejectedAt: adminFieldValue.serverTimestamp(),
          rejectedBy: owner.uid,
          updatedAt: adminFieldValue.serverTimestamp(),
        });

        tx.set(notificationRef, {
          userId: providerId,
          type: "withdrawal_rejected",
          title: "Retiro rechazado",
          message: `Tu retiro de $${amount.toLocaleString(
            "es-CO"
          )} fue rechazado y el saldo fue devuelto a tu cuenta.`,
          amount,
          read: false,
          createdAt: adminFieldValue.serverTimestamp(),
        });

        setLedgerEntry(tx, {
          userId: providerId,
          type: "withdrawal_refund",
          direction: "refund",
          amount,
          status: "completed",
          sourceCollection: "withdrawals",
          sourceId: withdrawalId,
          createdBy: owner.uid,
        });

        return;
      }

      tx.update(withdrawalRef, {
        status: "paid",
        paidAt: adminFieldValue.serverTimestamp(),
        paidBy: owner.uid,
        updatedAt: adminFieldValue.serverTimestamp(),
      });

      tx.set(notificationRef, {
        userId: providerId,
        type: "withdrawal_paid",
        title: "Retiro pagado",
        message: `Tu retiro fue marcado como pagado. Recibiste $${releasedAmount.toLocaleString(
          "es-CO"
        )}. Comision BelaClub: $${commissionAmount.toLocaleString("es-CO")}.`,
        amount,
        commissionAmount,
        releasedAmount,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      setLedgerEntry(tx, {
        userId: providerId,
        type: "withdrawal_paid",
        direction: "debit",
        amount,
        commissionAmount,
        netAmount: releasedAmount,
        status: "completed",
        sourceCollection: "withdrawals",
        sourceId: withdrawalId,
        createdBy: owner.uid,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    if (error instanceof Error && error.message === "WITHDRAWAL_NOT_FOUND") {
      return NextResponse.json(
        { error: "Retiro no encontrado" },
        { status: 404 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "WITHDRAWAL_ALREADY_PROCESSED"
    ) {
      return NextResponse.json(
        { error: "Este retiro ya fue procesado" },
        { status: 400 }
      );
    }

    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}
