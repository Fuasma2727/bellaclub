import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";
import {
  isProviderSubscriptionPastDue,
  isProviderSubscriptionPubliclyActive,
} from "@/lib/providerSubscription";

const sumNumber = (value: unknown) => Math.floor(Number(value || 0));

type FinanceSummary = {
  totalPlatformBalance: number;
  pendingWithdrawals: number;
  pendingWithdrawalsCount: number;
  commissionsEarned: number;
  pastDueProviders: number;
  blockedProviders: number;
  activeVisibleProviders: number;
  providerCount: number;
  normalUserCount: number;
};

type FinanceSummaryCache = {
  summary?: FinanceSummary;
  expiresAt: number;
  inFlight?: Promise<FinanceSummary>;
};

const FINANCE_SUMMARY_CACHE_TTL_MS = 0;

const globalForFinanceSummaryCache = globalThis as typeof globalThis & {
  __belaclubFinanceSummaryCache?: FinanceSummaryCache;
};

const financeSummaryCache =
  globalForFinanceSummaryCache.__belaclubFinanceSummaryCache || {
    expiresAt: 0,
  };

globalForFinanceSummaryCache.__belaclubFinanceSummaryCache =
  financeSummaryCache;

const loadFinanceSummary = async (): Promise<FinanceSummary> => {
  const [usersSnap, withdrawalsSnap, ledgerSnap, subscriptionsSnap] =
    await Promise.all([
      adminDb.collection("users").get(),
      adminDb
        .collection("withdrawals")
        .where("status", "==", "pending_wompi")
        .get(),
      adminDb.collection("ledger").where("direction", "==", "commission").get(),
      adminDb
        .collection("providerSubscriptions")
        .where("status", "==", "paid")
        .get(),
    ]);

  const users = usersSnap.docs.map((doc) => doc.data());
  const providers = users.filter((user) => user.role === "prestador");
  const normalUsers = users.filter((user) => user.role === "cliente");

  const totalPlatformBalance = users.reduce(
    (total, user) => total + sumNumber(user.balance),
    0
  );
  const pendingWithdrawals = withdrawalsSnap.docs.reduce((total, doc) => {
    const data = doc.data();
    return total + sumNumber(data.releasedAmount || data.amount);
  }, 0);
  const subscriptionCommissionSourceIds = new Set<string>();
  const ledgerCommissionsEarned = ledgerSnap.docs.reduce((total, doc) => {
    const data = doc.data();

    if (
      data.sourceCollection === "providerSubscriptions" &&
      typeof data.sourceId === "string" &&
      data.sourceId
    ) {
      subscriptionCommissionSourceIds.add(data.sourceId);
    }

    return total + sumNumber(data.amount || data.commissionAmount);
  }, 0);
  const legacySubscriptionRevenue = subscriptionsSnap.docs.reduce(
    (total, doc) => {
      if (subscriptionCommissionSourceIds.has(doc.id)) return total;

      const data = doc.data();
      return total + sumNumber(data.amount);
    },
    0
  );
  const commissionsEarned = ledgerCommissionsEarned + legacySubscriptionRevenue;
  const pastDueProviders = providers.filter((provider) =>
    isProviderSubscriptionPastDue(provider)
  ).length;
  const blockedProviders = providers.filter((provider) =>
    Boolean(provider.blocked)
  ).length;
  const activeVisibleProviders = providers.filter(
    (provider) =>
      provider.verificationStatus === "approved" &&
      provider.profileVisible === true &&
      !provider.blocked &&
      isProviderSubscriptionPubliclyActive(provider)
  ).length;

  return {
    totalPlatformBalance,
    pendingWithdrawals,
    pendingWithdrawalsCount: withdrawalsSnap.size,
    commissionsEarned,
    pastDueProviders,
    blockedProviders,
    activeVisibleProviders,
    providerCount: providers.length,
    normalUserCount: normalUsers.length,
  };
};

const getFinanceSummary = async () => {
  const now = Date.now();

  if (financeSummaryCache.summary && financeSummaryCache.expiresAt > now) {
    return financeSummaryCache.summary;
  }

  if (financeSummaryCache.inFlight) {
    return financeSummaryCache.inFlight;
  }

  financeSummaryCache.inFlight = loadFinanceSummary()
    .then((summary) => {
      financeSummaryCache.summary = summary;
      financeSummaryCache.expiresAt = Date.now() + FINANCE_SUMMARY_CACHE_TTL_MS;

      return summary;
    })
    .catch((error) => {
      if (financeSummaryCache.summary) {
        financeSummaryCache.expiresAt = Date.now() + 60 * 1000;
        console.error(
          "Error refreshing finance summary; serving stale summary:",
          error
        );

        return financeSummaryCache.summary;
      }

      throw error;
    })
    .finally(() => {
      financeSummaryCache.inFlight = undefined;
    });

  return financeSummaryCache.inFlight;
};

export async function GET(request: Request) {
  try {
    await requireOwner(request);

    const summary = await getFinanceSummary();

    return NextResponse.json({
      summary,
    });
  } catch (error) {
    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}
