import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { setLedgerEntry } from "@/lib/ledger";
import {
  PROVIDER_REFERRAL_REWARD,
  normalizeReferralCode,
} from "@/lib/referralCodes";

export type ReferralRewardKind = "provider_bronze";

const rewardConfig: Record<
  ReferralRewardKind,
  {
    amount: number;
    expectedRole: "prestador";
    statusField: string;
    paidAtField: string;
  }
> = {
  provider_bronze: {
    amount: PROVIDER_REFERRAL_REWARD,
    expectedRole: "prestador",
    statusField: "providerReferralRewardStatus",
    paidAtField: "providerReferralRewardPaidAt",
  },
};

const levelByBadge = (badge?: string | null) => {
  if (badge === "bronze") return 1;
  if (badge === "silver") return 2;
  if (badge === "gold") return 3;
  if (badge === "platinum") return 4;
  return 0;
};

export async function releaseReferralReward(
  referredUserId: string,
  kind: ReferralRewardKind,
  metadata: Record<string, unknown> = {}
) {
  const config = rewardConfig[kind];
  const referredRef = adminDb.collection("users").doc(referredUserId);
  const rewardRef = adminDb
    .collection("referralRewards")
    .doc(`${kind}_${referredUserId}`);

  let result:
    | {
        released: true;
        amount: number;
        referrerId: string;
      }
    | {
        released: false;
        reason: string;
      } = { released: false, reason: "not_started" };

  await adminDb.runTransaction(async (tx) => {
    const rewardSnap = await tx.get(rewardRef);

    if (rewardSnap.exists) {
      result = { released: false, reason: "already_paid" };
      return;
    }

    const referredSnap = await tx.get(referredRef);

    if (!referredSnap.exists) {
      result = { released: false, reason: "referred_user_not_found" };
      return;
    }

    const referred = referredSnap.data() || {};
    const referrerId = normalizeReferralCode(String(referred.referredBy || ""));

    if (!referrerId) {
      result = { released: false, reason: "no_referrer" };
      return;
    }

    if (referrerId === referredUserId) {
      result = { released: false, reason: "self_referral" };
      return;
    }

    if (referred.role !== config.expectedRole) {
      result = { released: false, reason: "role_not_eligible" };
      return;
    }

    const level =
      Number(referred.badgeVerificationLevel || 0) ||
      levelByBadge(referred.verificationBadge);

    if (level < 1) {
      result = { released: false, reason: "provider_not_bronze" };
      return;
    }

    const referrerRef = adminDb.collection("users").doc(referrerId);
    const referrerSnap = await tx.get(referrerRef);

    if (!referrerSnap.exists) {
      result = { released: false, reason: "referrer_not_found" };
      return;
    }

    const referrer = referrerSnap.data() || {};

    if (referrer.blocked === true) {
      result = { released: false, reason: "referrer_blocked" };
      return;
    }

    const amount = config.amount;

    tx.update(referrerRef, {
      balance: adminFieldValue.increment(amount),
      referralRewardsTotal: adminFieldValue.increment(amount),
      referralRewardsCount: adminFieldValue.increment(1),
      referralRewardsUpdatedAt: adminFieldValue.serverTimestamp(),
    });

    tx.update(referredRef, {
      [config.statusField]: "paid",
      [config.paidAtField]: adminFieldValue.serverTimestamp(),
      referralRewardPaidTo: referrerId,
      referralRewardUpdatedAt: adminFieldValue.serverTimestamp(),
    });

    tx.set(rewardRef, {
      kind,
      amount,
      referrerId,
      referredUserId,
      referredRole: referred.role,
      status: "completed",
      metadata,
      createdAt: adminFieldValue.serverTimestamp(),
    });

    setLedgerEntry(tx, {
      userId: referrerId,
      counterpartyUserId: referredUserId,
      type: "referral_reward",
      direction: "credit",
      amount,
      status: "completed",
      sourceCollection: "referralRewards",
      sourceId: rewardRef.id,
      metadata: {
        kind,
        referredRole: referred.role,
        ...metadata,
      },
    });

    tx.set(adminDb.collection("notifications").doc(), {
      userId: referrerId,
      type: "referral_reward",
      title: "Bono de referido acreditado",
      message: `Ganaste $${amount.toLocaleString(
        "es-CO"
      )} porque tu escort referida alcanzo nivel bronce.`,
      amount,
      referredUserId,
      referralKind: kind,
      read: false,
      createdAt: adminFieldValue.serverTimestamp(),
    });

    result = { released: true, amount, referrerId };
  });

  return result;
}
