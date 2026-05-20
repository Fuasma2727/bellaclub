import admin from "firebase-admin";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const PROVIDER_MONTHLY_FEE = 100000;

type ProcessResult =
  | "not_provider"
  | "not_approved"
  | "not_due"
  | "paid"
  | "blocked"
  | "manual_override";

const addOneMonth = (date: Date) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
};

const toDate = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate() as Date;
  }
  return null;
};

const shouldNotifyFailedPayment = (value: unknown) => {
  const lastFailedAt = toDate(value);
  if (!lastFailedAt) return true;

  const now = new Date();
  return lastFailedAt.toDateString() !== now.toDateString();
};

export async function processProviderSubscription(
  providerId: string
): Promise<ProcessResult> {
  const userRef = adminDb.collection("users").doc(providerId);
  const paymentRef = adminDb.collection("providerSubscriptions").doc();
  const successNotificationRef = adminDb.collection("notifications").doc();
  const failedNotificationRef = adminDb.collection("notifications").doc();
  const now = new Date();

  return await adminDb.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);

    if (!userSnap.exists) return "not_provider";

    const user = userSnap.data() || {};

    if (user.role !== "prestador") return "not_provider";
    if (user.verificationStatus !== "approved") return "not_approved";

    const nextChargeAt = toDate(user.subscriptionNextChargeAt);
    const isDue = !nextChargeAt || nextChargeAt.getTime() <= now.getTime();
    const manualOverride = Boolean(user.subscriptionManualOverride);

    if (!isDue && user.blockedReason !== "subscription_unpaid") {
      return "not_due";
    }

    const balance = Number(user.balance || 0);
    const nextPaidChargeAt = addOneMonth(now);

    if (balance >= PROVIDER_MONTHLY_FEE) {
      tx.update(userRef, {
        balance: admin.firestore.FieldValue.increment(-PROVIDER_MONTHLY_FEE),
        blocked: false,
        blockedReason: admin.firestore.FieldValue.delete(),
        profileVisible: true,
        subscriptionStatus: "active",
        subscriptionAmount: PROVIDER_MONTHLY_FEE,
        subscriptionManualOverride: false,
        subscriptionLastPaidAt: adminFieldValue.serverTimestamp(),
        subscriptionNextChargeAt: nextPaidChargeAt,
        subscriptionUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      tx.set(paymentRef, {
        providerId,
        amount: PROVIDER_MONTHLY_FEE,
        status: "paid",
        source: "balance",
        createdAt: adminFieldValue.serverTimestamp(),
        nextChargeAt: nextPaidChargeAt,
      });

      tx.set(successNotificationRef, {
        userId: providerId,
        type: "provider_subscription_paid",
        title: "Mensualidad descontada",
        message: `Se descontaron $${PROVIDER_MONTHLY_FEE.toLocaleString(
          "es-CO"
        )} de tu saldo por la mensualidad de BelaClub. Tu perfil sigue activo.`,
        amount: PROVIDER_MONTHLY_FEE,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      return "paid";
    }

    if (manualOverride) {
      tx.update(userRef, {
        subscriptionStatus: "admin_override",
        subscriptionAmount: PROVIDER_MONTHLY_FEE,
        subscriptionUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      return "manual_override";
    }

    const shouldNotify = shouldNotifyFailedPayment(user.subscriptionLastFailedAt);

    tx.update(userRef, {
      blocked: true,
      blockedReason: "subscription_unpaid",
      profileVisible: false,
      subscriptionStatus: "past_due",
      subscriptionAmount: PROVIDER_MONTHLY_FEE,
      subscriptionLastFailedAt: adminFieldValue.serverTimestamp(),
      subscriptionUpdatedAt: adminFieldValue.serverTimestamp(),
      blockedAt: adminFieldValue.serverTimestamp(),
    });

    tx.set(paymentRef, {
      providerId,
      amount: PROVIDER_MONTHLY_FEE,
      status: "failed",
      reason: "insufficient_balance",
      createdAt: adminFieldValue.serverTimestamp(),
    });

    if (shouldNotify) {
      tx.set(failedNotificationRef, {
        userId: providerId,
        type: "provider_subscription_failed",
        title: "Mensualidad pendiente",
        message: `No pudimos descontar la mensualidad de $${PROVIDER_MONTHLY_FEE.toLocaleString(
          "es-CO"
        )}. Recarga saldo para activar tu perfil nuevamente.`,
        amount: PROVIDER_MONTHLY_FEE,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });
    }

    return "blocked";
  });
}

export async function processDueProviderSubscriptions() {
  const snapshot = await adminDb
    .collection("users")
    .where("role", "==", "prestador")
    .where("verificationStatus", "==", "approved")
    .get();

  const summary = {
    checked: snapshot.size,
    paid: 0,
    blocked: 0,
    manualOverride: 0,
    skipped: 0,
  };

  for (const doc of snapshot.docs) {
    const result = await processProviderSubscription(doc.id);

    if (result === "paid") summary.paid += 1;
    else if (result === "blocked") summary.blocked += 1;
    else if (result === "manual_override") summary.manualOverride += 1;
    else summary.skipped += 1;
  }

  return summary;
}
