import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { processProviderSubscription } from "@/lib/providerSubscription";

type WompiTransactionStatus =
  | "APPROVED"
  | "DECLINED"
  | "ERROR"
  | "PENDING"
  | "VOIDED";

type WompiTransaction = {
  id: string;
  reference: string;
  status: WompiTransactionStatus;
  amount_in_cents: number;
  currency: string;
};

export async function creditApprovedRecharge(transaction: WompiTransaction) {
  if (transaction.status !== "APPROVED") {
    return { credited: false, reason: "not_approved" };
  }

  const rechargeRef = adminDb.collection("recharges").doc(transaction.reference);
  const rechargeSnap = await rechargeRef.get();

  if (!rechargeSnap.exists) {
    return { credited: false, reason: "recharge_not_found" };
  }

  const recharge = rechargeSnap.data();

  if (!recharge?.userId) {
    return { credited: false, reason: "missing_user" };
  }

  if (Number(recharge.amountInCents) !== Number(transaction.amount_in_cents)) {
    return { credited: false, reason: "amount_mismatch" };
  }

  if (transaction.currency !== "COP") {
    return { credited: false, reason: "currency_mismatch" };
  }

  await adminDb.runTransaction(async (tx) => {
    const currentRecharge = await tx.get(rechargeRef);
    const rechargeData = currentRecharge.data();

    if (rechargeData?.status === "APPROVED") {
      return;
    }

    tx.update(adminDb.collection("users").doc(recharge.userId), {
      balance: adminFieldValue.increment(transaction.amount_in_cents / 100),
    });

    tx.update(rechargeRef, {
      status: "APPROVED",
      wompiTransactionId: transaction.id,
      approvedAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    });
  });

  await processProviderSubscription(recharge.userId);

  return { credited: true };
}
