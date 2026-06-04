import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";

const sumNumber = (value: unknown) => Math.floor(Number(value || 0));

export async function GET(request: Request) {
  try {
    await requireOwner(request);

    const [usersSnap, withdrawalsSnap, ledgerSnap] = await Promise.all([
      adminDb.collection("users").get(),
      adminDb
        .collection("withdrawals")
        .where("status", "==", "pending_wompi")
        .get(),
      adminDb.collection("ledger").where("direction", "==", "commission").get(),
    ]);

    const users = usersSnap.docs.map((doc) => doc.data());
    const providers = users.filter((user) => user.role === "prestador");

    const totalPlatformBalance = users.reduce(
      (total, user) => total + sumNumber(user.balance),
      0
    );
    const pendingWithdrawals = withdrawalsSnap.docs.reduce((total, doc) => {
      const data = doc.data();
      return total + sumNumber(data.releasedAmount || data.amount);
    }, 0);
    const commissionsEarned = ledgerSnap.docs.reduce((total, doc) => {
      const data = doc.data();
      return total + sumNumber(data.amount || data.commissionAmount);
    }, 0);
    const pastDueProviders = providers.filter(
      (provider) => provider.subscriptionStatus === "past_due"
    ).length;
    const blockedProviders = providers.filter((provider) =>
      Boolean(provider.blocked)
    ).length;
    const activeVisibleProviders = providers.filter(
      (provider) =>
        provider.verificationStatus === "approved" &&
        provider.profileVisible === true &&
        !provider.blocked
    ).length;

    return NextResponse.json({
      summary: {
        totalPlatformBalance,
        pendingWithdrawals,
        pendingWithdrawalsCount: withdrawalsSnap.size,
        commissionsEarned,
        pastDueProviders,
        blockedProviders,
        activeVisibleProviders,
        providerCount: providers.length,
      },
    });
  } catch (error) {
    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}
