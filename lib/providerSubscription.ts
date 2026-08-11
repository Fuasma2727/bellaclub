import admin from "firebase-admin";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { setLedgerEntry } from "@/lib/ledger";
import {
  DEFAULT_PROVIDER_SUBSCRIPTION_PLAN,
  getProviderSubscriptionPlan,
  type ProviderSubscriptionPlanId,
} from "@/lib/providerSubscriptionPlans";

export const PROVIDER_MONTHLY_FEE = DEFAULT_PROVIDER_SUBSCRIPTION_PLAN.amount;

type ProcessResult =
  | "not_provider"
  | "not_approved"
  | "not_due"
  | "paid"
  | "blocked"
  | "manual_override";

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const toDate = (value: unknown) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate() as Date;
  }
  return null;
};

export const isProviderSubscriptionPubliclyActive = (
  user: {
    subscriptionStatus?: unknown;
    subscriptionManualOverride?: unknown;
    subscriptionNextChargeAt?: unknown;
  },
  now = new Date()
) => {
  if (
    user.subscriptionManualOverride === true ||
    user.subscriptionStatus === "admin_override"
  ) {
    return true;
  }

  if (user.subscriptionStatus !== "active") return false;

  const nextChargeAt = toDate(user.subscriptionNextChargeAt);

  return Boolean(nextChargeAt && nextChargeAt.getTime() > now.getTime());
};

export const isProviderSubscriptionPastDue = (
  user: {
    blockedReason?: unknown;
    subscriptionStatus?: unknown;
    subscriptionManualOverride?: unknown;
    subscriptionNextChargeAt?: unknown;
    verificationStatus?: unknown;
  },
  now = new Date()
) => {
  if (user.verificationStatus && user.verificationStatus !== "approved") {
    return false;
  }

  if (
    user.subscriptionManualOverride === true ||
    user.subscriptionStatus === "admin_override" ||
    user.subscriptionStatus === "paused"
  ) {
    return false;
  }

  if (
    user.blockedReason === "subscription_unpaid" ||
    user.subscriptionStatus === "past_due" ||
    user.subscriptionStatus === "pending_payment"
  ) {
    return true;
  }

  const nextChargeAt = toDate(user.subscriptionNextChargeAt);

  if (user.subscriptionStatus === "active") {
    return !nextChargeAt || nextChargeAt.getTime() <= now.getTime();
  }

  return !user.subscriptionStatus;
};

const shouldNotifyFailedPayment = (value: unknown) => {
  const lastFailedAt = toDate(value);
  if (!lastFailedAt) return true;

  const now = new Date();
  return lastFailedAt.toDateString() !== now.toDateString();
};

export async function processProviderSubscription(
  providerId: string,
  options: { planId?: ProviderSubscriptionPlanId | string | null } = {}
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
    const selectedPlan = getProviderSubscriptionPlan(
      options.planId || user.pendingSubscriptionPlanId || user.subscriptionPlanId
    );

    if (manualOverride) {
      tx.update(userRef, {
        subscriptionStatus: user.subscriptionStatus || "admin_override",
        subscriptionAmount: selectedPlan.amount,
        subscriptionPlanId: selectedPlan.id,
        subscriptionPlanDays: selectedPlan.durationDays,
        subscriptionUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      return "manual_override";
    }

    if (!isDue && user.blockedReason !== "subscription_unpaid") {
      return "not_due";
    }

    const balance = Number(user.balance || 0);
    const nextPaidChargeAt = addDays(now, selectedPlan.durationDays);
    const hasProfilePhoto = Boolean(user.photoUrl);

    if (balance >= selectedPlan.amount) {
      tx.update(userRef, {
        balance: admin.firestore.FieldValue.increment(-selectedPlan.amount),
        blocked: false,
        blockedReason: admin.firestore.FieldValue.delete(),
        profileVisible: hasProfilePhoto,
        subscriptionStatus: "active",
        subscriptionAmount: selectedPlan.amount,
        subscriptionPlanId: selectedPlan.id,
        subscriptionPlanDays: selectedPlan.durationDays,
        subscriptionManualOverride: false,
        subscriptionLastPaidAt: adminFieldValue.serverTimestamp(),
        subscriptionNextChargeAt: nextPaidChargeAt,
        subscriptionUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      tx.set(paymentRef, {
        providerId,
        amount: selectedPlan.amount,
        planId: selectedPlan.id,
        planDays: selectedPlan.durationDays,
        status: "paid",
        source: "balance",
        createdAt: adminFieldValue.serverTimestamp(),
        nextChargeAt: nextPaidChargeAt,
      });

      setLedgerEntry(tx, {
        userId: providerId,
        type: "provider_subscription",
        direction: "debit",
        amount: selectedPlan.amount,
        status: "completed",
        sourceCollection: "providerSubscriptions",
        sourceId: paymentRef.id,
        metadata: {
          planId: selectedPlan.id,
          planDays: selectedPlan.durationDays,
        },
      });

      tx.set(successNotificationRef, {
        userId: providerId,
        type: "provider_subscription_paid",
        title: "Plan descontado",
        message: `Se descontaron $${selectedPlan.amount.toLocaleString(
          "es-CO"
        )} de tu saldo por el plan BelaClub de ${
          selectedPlan.durationDays
        } dias. Tu perfil sigue activo.`,
        amount: selectedPlan.amount,
        planId: selectedPlan.id,
        planDays: selectedPlan.durationDays,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      return "paid";
    }

    const shouldNotify = shouldNotifyFailedPayment(user.subscriptionLastFailedAt);

    tx.update(userRef, {
      blocked: true,
      blockedReason: "subscription_unpaid",
      profileVisible: false,
      subscriptionStatus: "past_due",
      subscriptionAmount: selectedPlan.amount,
      subscriptionPlanId: selectedPlan.id,
      subscriptionPlanDays: selectedPlan.durationDays,
      subscriptionLastFailedAt: adminFieldValue.serverTimestamp(),
      subscriptionUpdatedAt: adminFieldValue.serverTimestamp(),
      blockedAt: adminFieldValue.serverTimestamp(),
    });

    tx.set(paymentRef, {
      providerId,
      amount: selectedPlan.amount,
      planId: selectedPlan.id,
      planDays: selectedPlan.durationDays,
      status: "failed",
      reason: "insufficient_balance",
      createdAt: adminFieldValue.serverTimestamp(),
    });

    if (shouldNotify) {
      tx.set(failedNotificationRef, {
        userId: providerId,
        type: "provider_subscription_failed",
        title: "Plan pendiente",
        message: `No pudimos descontar $${selectedPlan.amount.toLocaleString(
          "es-CO"
        )} por el plan BelaClub de ${
          selectedPlan.durationDays
        } dias. Recarga saldo para activar tu perfil nuevamente.`,
        amount: selectedPlan.amount,
        planId: selectedPlan.id,
        planDays: selectedPlan.durationDays,
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
