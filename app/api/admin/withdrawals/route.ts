import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { setLedgerEntry } from "@/lib/ledger";
import { ownerAuthError, requireOwner, type OwnerUser } from "@/lib/ownerAuth";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";
import {
  createWompiBankPayout,
  getWompiPayoutReference,
  getWompiPayoutsErrorMessage,
  WompiPayoutsApiError,
  WompiPayoutsConfigError,
} from "@/lib/wompiPayouts";

type WithdrawalStatus =
  | "pending_wompi"
  | "processing_wompi"
  | "failed_wompi"
  | "paid"
  | "rejected";
type WithdrawalAction = "approveWompi" | "markPaid" | "reject";

type WithdrawalForPayout = {
  id: string;
  providerId: string;
  providerEmail: string | null;
  amount: number;
  commissionAmount: number;
  releasedAmount: number;
  payoutMethod: string;
  payoutAccount: string;
  payoutAccountType: string;
  accountHolder: string;
  legalIdType: string;
  legalId: string;
};

const validStatuses = new Set<WithdrawalStatus>([
  "pending_wompi",
  "processing_wompi",
  "failed_wompi",
  "paid",
  "rejected",
]);

const toDateString = (value: unknown) => {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString() as string;
  }

  return null;
};

const maskLast4 = (value: unknown) => {
  const clean = String(value || "").replace(/\D/g, "");
  if (!clean) return "";
  return `****${clean.slice(-4)}`;
};

const withdrawalStatus = (value: unknown): WithdrawalStatus => {
  const status = String(value || "pending_wompi") as WithdrawalStatus;
  return validStatuses.has(status) ? status : "pending_wompi";
};

const isReviewableStatus = (status: string) => {
  return status === "pending_wompi" || status === "failed_wompi";
};

const isManualPayableStatus = (status: string) => {
  return (
    status === "pending_wompi" ||
    status === "processing_wompi" ||
    status === "failed_wompi"
  );
};

const cleanFirestoreUpdate = (input: Record<string, unknown>) => {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  );
};

const mapWithdrawal = (doc: FirebaseFirestore.QueryDocumentSnapshot) => {
  const data = doc.data();
  const status = withdrawalStatus(data.status);

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
    legalIdType: data.legalIdType || "",
    legalIdLast4: maskLast4(data.legalId),
    status,
    wompiReference: data.wompiReference || null,
    wompiPayoutId: data.wompiPayoutId || null,
    wompiTransactionId: data.wompiTransactionId || null,
    wompiStatus: data.wompiStatus || null,
    wompiTransactionStatus: data.wompiTransactionStatus || null,
    wompiError: data.wompiError || null,
    createdAt: toDateString(data.createdAt),
    approvedAt: toDateString(data.approvedAt),
    paidAt: toDateString(data.paidAt),
    failedAt: toDateString(data.failedAt),
    rejectedAt: toDateString(data.rejectedAt),
  };
};

export async function GET(request: Request) {
  try {
    await requireOwner(request);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status") || "pending_wompi";
    const query = searchParams.get("q")?.trim().toLowerCase() || "";
    const withdrawalsRef = adminDb.collection("withdrawals");
    const snapshot =
      statusParam === "reviewable"
        ? await withdrawalsRef
            .where("status", "in", [
              "pending_wompi",
              "processing_wompi",
              "failed_wompi",
            ])
            .get()
        : await withdrawalsRef
            .where(
              "status",
              "==",
              validStatuses.has(statusParam as WithdrawalStatus)
                ? statusParam
                : "pending_wompi"
            )
            .get();

    const withdrawals = snapshot.docs
      .map(mapWithdrawal)
      .filter((withdrawal) => {
        if (!query) return true;

        const haystack = [
          withdrawal.providerName,
          withdrawal.providerEmail,
          withdrawal.accountHolder,
          withdrawal.payoutMethod,
          withdrawal.payoutAccount,
          withdrawal.legalIdLast4,
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

const claimWithdrawalForWompi = async (
  withdrawalId: string,
  owner: OwnerUser
) => {
  const withdrawalRef = adminDb.collection("withdrawals").doc(withdrawalId);

  return await adminDb.runTransaction<WithdrawalForPayout>(async (tx) => {
    const withdrawalSnap = await tx.get(withdrawalRef);

    if (!withdrawalSnap.exists) {
      throw new Error("WITHDRAWAL_NOT_FOUND");
    }

    const withdrawal = withdrawalSnap.data() || {};
    const status = withdrawalStatus(withdrawal.status);

    if (!isReviewableStatus(status)) {
      throw new Error("WITHDRAWAL_ALREADY_PROCESSED");
    }

    const providerId = String(withdrawal.providerId || "");
    const releasedAmount = Number(withdrawal.releasedAmount || 0);
    const payoutMethod = String(withdrawal.payoutMethod || "");
    const payoutAccount = String(withdrawal.payoutAccount || "");
    const payoutAccountType = String(withdrawal.payoutAccountType || "");
    const accountHolder = String(withdrawal.accountHolder || "");
    const legalIdType = String(withdrawal.legalIdType || "");
    const legalId = String(withdrawal.legalId || "");

    if (!providerId) {
      throw new Error("PROVIDER_NOT_FOUND");
    }

    if (
      !releasedAmount ||
      !payoutMethod ||
      !payoutAccount ||
      !payoutAccountType ||
      !accountHolder ||
      !legalIdType ||
      !legalId
    ) {
      throw new Error("WITHDRAWAL_MISSING_PAYOUT_DATA");
    }

    const wompiReference =
      String(withdrawal.wompiReference || "") ||
      getWompiPayoutReference(withdrawalId);

    const withdrawalForPayout = {
      id: withdrawalId,
      providerId,
      providerEmail: withdrawal.providerEmail || null,
      amount: Number(withdrawal.amount || 0),
      commissionAmount: Number(withdrawal.commissionAmount || 0),
      releasedAmount,
      payoutMethod,
      payoutAccount,
      payoutAccountType,
      accountHolder,
      legalIdType,
      legalId,
    };

    tx.update(withdrawalRef, {
      status: "processing_wompi",
      approvedAt: adminFieldValue.serverTimestamp(),
      approvedBy: owner.uid,
      wompiReference,
      wompiIdempotencyKey: wompiReference,
      wompiError: null,
      updatedAt: adminFieldValue.serverTimestamp(),
    });

    return withdrawalForPayout;
  });
};

const markWithdrawalWompiFailed = async (
  withdrawalId: string,
  error: unknown
) => {
  const withdrawalRef = adminDb.collection("withdrawals").doc(withdrawalId);
  const message = getWompiPayoutsErrorMessage(error);

  await adminDb.runTransaction(async (tx) => {
    const withdrawalSnap = await tx.get(withdrawalRef);

    if (!withdrawalSnap.exists) return;

    const withdrawal = withdrawalSnap.data() || {};

    if (withdrawal.status !== "processing_wompi") return;

    tx.update(withdrawalRef, {
      status: "failed_wompi",
      failedAt: adminFieldValue.serverTimestamp(),
      wompiError: message,
      updatedAt: adminFieldValue.serverTimestamp(),
    });
  });
};

const approveWithdrawalWithWompi = async (
  withdrawalId: string,
  owner: OwnerUser
) => {
  const withdrawal = await claimWithdrawalForWompi(withdrawalId, owner);

  try {
    const wompiResult = await createWompiBankPayout({
      ...withdrawal,
      withdrawalId: withdrawal.id,
    });
    const withdrawalRef = adminDb.collection("withdrawals").doc(withdrawalId);
    const notificationRef = adminDb.collection("notifications").doc();

    await adminDb.runTransaction(async (tx) => {
      const withdrawalSnap = await tx.get(withdrawalRef);
      const current = withdrawalSnap.data() || {};

      if (!withdrawalSnap.exists || current.status !== "processing_wompi") {
        return;
      }

      tx.update(
        withdrawalRef,
        cleanFirestoreUpdate({
          status: "processing_wompi",
          wompiPayoutId: wompiResult.payoutId || null,
          wompiTransactionId: wompiResult.transactionId || null,
          wompiStatus: wompiResult.payoutStatus || null,
          wompiTransactionStatus: wompiResult.transactionStatus || null,
          wompiReference: wompiResult.reference,
          wompiIdempotencyKey: wompiResult.idempotencyKey,
          wompiBankId: wompiResult.bankId,
          wompiAmountInCents: wompiResult.amountInCents,
          wompiSubmittedAt: adminFieldValue.serverTimestamp(),
          wompiError: null,
          updatedAt: adminFieldValue.serverTimestamp(),
        })
      );

      tx.set(notificationRef, {
        userId: withdrawal.providerId,
        type: "withdrawal_processing",
        title: "Retiro aprobado",
        message: `Tu retiro por $${withdrawal.releasedAmount.toLocaleString(
          "es-CO"
        )} fue aprobado y enviado a Wompi. Te avisaremos cuando quede pagado.`,
        amount: withdrawal.amount,
        commissionAmount: withdrawal.commissionAmount,
        releasedAmount: withdrawal.releasedAmount,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      status: "processing_wompi",
      wompiPayoutId: wompiResult.payoutId || null,
      wompiTransactionId: wompiResult.transactionId || null,
    });
  } catch (error) {
    await markWithdrawalWompiFailed(withdrawalId, error);
    throw error;
  }
};

const processManualWithdrawalAction = async (
  withdrawalId: string,
  action: Exclude<WithdrawalAction, "approveWompi">,
  owner: OwnerUser
) => {
  const withdrawalRef = adminDb.collection("withdrawals").doc(withdrawalId);
  const notificationRef = adminDb.collection("notifications").doc();

  await adminDb.runTransaction(async (tx) => {
    const withdrawalSnap = await tx.get(withdrawalRef);

    if (!withdrawalSnap.exists) {
      throw new Error("WITHDRAWAL_NOT_FOUND");
    }

    const withdrawal = withdrawalSnap.data() || {};
    const status = withdrawalStatus(withdrawal.status);

    if (status === "paid" || status === "rejected") {
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
      if (status === "processing_wompi") {
        throw new Error("WITHDRAWAL_PROCESSING_WOMPI");
      }

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

    if (!isManualPayableStatus(status)) {
      throw new Error("WITHDRAWAL_ALREADY_PROCESSED");
    }

    tx.update(withdrawalRef, {
      status: "paid",
      paidAt: adminFieldValue.serverTimestamp(),
      paidBy: owner.uid,
      manualPaid: true,
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
};

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
      action?: WithdrawalAction;
    };

    if (!withdrawalId || !action) {
      return NextResponse.json(
        { error: "Datos incompletos" },
        { status: 400 }
      );
    }

    if (action === "approveWompi") {
      return await approveWithdrawalWithWompi(withdrawalId, owner);
    }

    if (action === "markPaid" || action === "reject") {
      return await processManualWithdrawalAction(withdrawalId, action, owner);
    }

    return NextResponse.json(
      { error: "Accion no soportada" },
      { status: 400 }
    );
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

    if (
      error instanceof Error &&
      error.message === "WITHDRAWAL_PROCESSING_WOMPI"
    ) {
      return NextResponse.json(
        {
          error:
            "Este retiro ya fue enviado a Wompi. Espera el resultado o marcalo como pagado manualmente si ya confirmaste la transferencia.",
        },
        { status: 400 }
      );
    }

    if (
      error instanceof Error &&
      error.message === "WITHDRAWAL_MISSING_PAYOUT_DATA"
    ) {
      return NextResponse.json(
        {
          error:
            "Este retiro no tiene todos los datos que Wompi pide. Rechazalo para devolver el saldo y pide que lo soliciten de nuevo.",
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "PROVIDER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Prestador no encontrado" },
        { status: 404 }
      );
    }

    if (error instanceof WompiPayoutsConfigError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof WompiPayoutsApiError) {
      return NextResponse.json(
        { error: getWompiPayoutsErrorMessage(error) },
        { status: 502 }
      );
    }

    const authError = ownerAuthError(error);

    if (authError.status !== 500) {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("ADMIN WITHDRAWALS ERROR:", error);

    return NextResponse.json(
      { error: "No pudimos actualizar el retiro" },
      { status: 500 }
    );
  }
}
