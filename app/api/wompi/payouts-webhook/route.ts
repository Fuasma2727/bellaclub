import crypto from "crypto";
import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { setLedgerEntry } from "@/lib/ledger";
import { assertBodySize, securityErrorResponse } from "@/lib/requestSecurity";

export const runtime = "nodejs";

const PAYOUT_EVENTS_SECRET = process.env.WOMPI_PAYOUTS_EVENTS_SECRET;

type WompiPayoutEvent = {
  event?: string;
  data?: Record<string, unknown>;
  signature?: {
    properties?: string[];
    checksum?: string;
  };
  timestamp?: number | string;
};

type WompiEventParts = {
  eventName: string;
  reference: string;
  payoutId: string;
  transactionId: string;
  status: string;
  amountInCents: number;
  failureReason: string | null;
};

const paidStatuses = new Set(["APPROVED", "TOTAL_PAYMENT"]);
const failedStatuses = new Set([
  "FAILED",
  "REJECTED",
  "NOT_APPROVED",
  "CANCELLED",
  "DECLINED",
  "ERROR",
]);

const getPathValue = (source: unknown, path: string) => {
  return path.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, source);
};

const safeCompare = (left: string, right: string) => {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }

  const leftBuffer = Buffer.from(left.toLowerCase(), "hex");
  const rightBuffer = Buffer.from(right.toLowerCase(), "hex");

  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const isValidWompiPayoutEvent = (
  event: WompiPayoutEvent,
  headerChecksum: string | null
) => {
  if (!PAYOUT_EVENTS_SECRET) return false;

  const properties = event.signature?.properties;
  const checksum = headerChecksum || event.signature?.checksum;

  if (!Array.isArray(properties) || !checksum || !event.timestamp) {
    return false;
  }

  const payload = properties
    .map((property) => {
      const cleanPath = property.startsWith("data.")
        ? property.slice("data.".length)
        : property;
      const value = getPathValue(event.data, cleanPath);
      return value === undefined || value === null ? "" : String(value);
    })
    .join("");

  const expected = crypto
    .createHash("sha256")
    .update(`${payload}${event.timestamp}${PAYOUT_EVENTS_SECRET}`)
    .digest("hex");

  return safeCompare(expected, checksum);
};

const getRecord = (value: unknown) => {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

const getString = (record: Record<string, unknown> | null, key: string) => {
  const value = record?.[key];
  return typeof value === "string" ? value : "";
};

const getNumber = (record: Record<string, unknown> | null, key: string) => {
  const value = record?.[key];
  return typeof value === "number" ? value : Number(value || 0);
};

const getFailureReason = (transaction: Record<string, unknown> | null) => {
  const failureReason = getRecord(transaction?.failureReason);
  const code = getString(failureReason, "code");
  const message = getString(failureReason, "message");

  if (code && message) return `${code}: ${message}`;
  return message || code || null;
};

const getEventParts = (event: WompiPayoutEvent): WompiEventParts => {
  const payout = getRecord(event.data?.payout);
  const transaction = getRecord(event.data?.transaction);
  const status =
    getString(transaction, "status") || getString(payout, "status");
  const payoutId =
    getString(transaction, "payoutId") || getString(payout, "id");
  const transactionId = getString(transaction, "id");
  const reference =
    getString(transaction, "reference") || getString(payout, "reference");
  const amountInCents =
    getNumber(transaction, "amountInCents") ||
    getNumber(payout, "amountInCents");

  return {
    eventName: event.event || "",
    reference,
    payoutId,
    transactionId,
    status,
    amountInCents,
    failureReason: getFailureReason(transaction),
  };
};

const findWithdrawalRef = async (parts: WompiEventParts) => {
  const withdrawalsRef = adminDb.collection("withdrawals");
  const lookups: Array<[string, string]> = [];

  if (parts.transactionId) lookups.push(["wompiTransactionId", parts.transactionId]);
  if (parts.payoutId) lookups.push(["wompiPayoutId", parts.payoutId]);
  if (parts.reference) lookups.push(["wompiReference", parts.reference]);

  for (const [field, value] of lookups) {
    const snapshot = await withdrawalsRef.where(field, "==", value).limit(1).get();
    const doc = snapshot.docs[0];
    if (doc) return doc.ref;
  }

  return null;
};

const applyPaidStatus = async (
  withdrawalRef: FirebaseFirestore.DocumentReference,
  parts: WompiEventParts
) => {
  const notificationRef = adminDb.collection("notifications").doc();
  let updated = false;

  await adminDb.runTransaction(async (tx) => {
    const withdrawalSnap = await tx.get(withdrawalRef);

    if (!withdrawalSnap.exists) return;

    const withdrawal = withdrawalSnap.data() || {};
    const currentStatus = String(withdrawal.status || "");

    if (currentStatus === "paid" || currentStatus === "rejected") return;

    const providerId = String(withdrawal.providerId || "");
    const amount = Number(withdrawal.amount || 0);
    const releasedAmount = Number(withdrawal.releasedAmount || 0);
    const commissionAmount = Number(withdrawal.commissionAmount || 0);

    if (!providerId) return;

    tx.update(withdrawalRef, {
      status: "paid",
      paidAt: adminFieldValue.serverTimestamp(),
      paidBy: "wompi",
      wompiStatus: parts.status,
      wompiPayoutId: parts.payoutId || withdrawal.wompiPayoutId || null,
      wompiTransactionId:
        parts.transactionId || withdrawal.wompiTransactionId || null,
      wompiAmountInCents: parts.amountInCents || null,
      wompiError: null,
      updatedAt: adminFieldValue.serverTimestamp(),
    });

    tx.set(notificationRef, {
      userId: providerId,
      type: "withdrawal_paid",
      title: "Retiro pagado",
      message: `Wompi confirmo tu retiro. Recibiste $${releasedAmount.toLocaleString(
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
      sourceId: withdrawalRef.id,
      createdBy: "wompi",
    });

    updated = true;
  });

  return updated;
};

const applyFailedStatus = async (
  withdrawalRef: FirebaseFirestore.DocumentReference,
  parts: WompiEventParts
) => {
  const notificationRef = adminDb.collection("notifications").doc();
  let updated = false;

  await adminDb.runTransaction(async (tx) => {
    const withdrawalSnap = await tx.get(withdrawalRef);

    if (!withdrawalSnap.exists) return;

    const withdrawal = withdrawalSnap.data() || {};
    const currentStatus = String(withdrawal.status || "");

    if (currentStatus === "paid" || currentStatus === "rejected") return;

    const providerId = String(withdrawal.providerId || "");
    const releasedAmount = Number(withdrawal.releasedAmount || 0);
    const failureMessage =
      parts.failureReason || "Wompi no pudo completar el retiro.";

    tx.update(withdrawalRef, {
      status: "failed_wompi",
      failedAt: adminFieldValue.serverTimestamp(),
      wompiStatus: parts.status,
      wompiPayoutId: parts.payoutId || withdrawal.wompiPayoutId || null,
      wompiTransactionId:
        parts.transactionId || withdrawal.wompiTransactionId || null,
      wompiAmountInCents: parts.amountInCents || null,
      wompiError: failureMessage,
      updatedAt: adminFieldValue.serverTimestamp(),
    });

    if (providerId) {
      tx.set(notificationRef, {
        userId: providerId,
        type: "withdrawal_failed",
        title: "Retiro por revisar",
        message: `Wompi no pudo completar tu retiro de $${releasedAmount.toLocaleString(
          "es-CO"
        )}. Revisaremos los datos y te avisaremos.`,
        releasedAmount,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });
    }

    updated = true;
  });

  return updated;
};

export async function POST(request: Request) {
  try {
    assertBodySize(request, 64 * 1024);

    const event = (await request.json()) as WompiPayoutEvent;
    const headerChecksum = request.headers.get("x-event-checksum");

    if (!isValidWompiPayoutEvent(event, headerChecksum)) {
      return NextResponse.json(
        { error: "Firma de evento invalida" },
        { status: 401 }
      );
    }

    const parts = getEventParts(event);

    await adminDb.collection("wompiPayoutEvents").doc().set({
      event: parts.eventName || null,
      reference: parts.reference || null,
      payoutId: parts.payoutId || null,
      transactionId: parts.transactionId || null,
      status: parts.status || null,
      hasHeaderChecksum: Boolean(headerChecksum),
      receivedAt: new Date().toISOString(),
    });

    const withdrawalRef = await findWithdrawalRef(parts);

    if (!withdrawalRef || !parts.status) {
      return NextResponse.json({ received: true, updated: false });
    }

    if (paidStatuses.has(parts.status)) {
      const updated = await applyPaidStatus(withdrawalRef, parts);
      return NextResponse.json({ received: true, updated });
    }

    if (failedStatuses.has(parts.status)) {
      const updated = await applyFailedStatus(withdrawalRef, parts);
      return NextResponse.json({ received: true, updated });
    }

    await withdrawalRef.update({
      status: "processing_wompi",
      wompiStatus: parts.status,
      wompiPayoutId: parts.payoutId || null,
      wompiTransactionId: parts.transactionId || null,
      updatedAt: adminFieldValue.serverTimestamp(),
    });

    return NextResponse.json({ received: true, updated: true });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    console.error("Error procesando webhook Wompi Payouts:", error);
    return NextResponse.json(
      { error: "Error procesando webhook" },
      { status: 500 }
    );
  }
}
