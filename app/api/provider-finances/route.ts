import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";

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

export async function GET(request: Request) {
  try {
    const decoded = await requireAuthenticatedUser(request);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const user = userSnap.data() || {};

    if (user.role !== "prestador") {
      return NextResponse.json(
        { error: "Solo las escorts pueden ver esta seccion" },
        { status: 403 }
      );
    }

    const [ledgerSnap, withdrawalsSnap, privateSalesSnap] = await Promise.all([
      adminDb
        .collection("ledger")
        .where("userId", "==", decoded.uid)
        .limit(120)
        .get(),
      adminDb
        .collection("withdrawals")
        .where("providerId", "==", decoded.uid)
        .limit(60)
        .get(),
      adminDb
        .collection("contentPurchases")
        .where("sellerId", "==", decoded.uid)
        .get(),
    ]);

    const ledger = ledgerSnap.docs
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          type: data.type || "",
          direction: data.direction || "",
          amount: Number(data.amount || 0),
          commissionAmount: Number(data.commissionAmount || 0),
          netAmount:
            typeof data.netAmount === "number" ? Number(data.netAmount) : null,
          status: data.status || "",
          sourceCollection: data.sourceCollection || "",
          sourceId: data.sourceId || "",
          createdAt: toDateString(data.createdAt),
        };
      })
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );

    const withdrawals = withdrawalsSnap.docs
      .map((doc) => {
        const data = doc.data();

        return {
          id: doc.id,
          amount: Number(data.amount || 0),
          commissionAmount: Number(data.commissionAmount || 0),
          releasedAmount: Number(data.releasedAmount || 0),
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
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );

    const summary = ledger.reduce(
      (acc, entry) => {
        if (entry.direction === "credit") acc.income += entry.amount;
        if (entry.direction === "debit") acc.spent += entry.amount;
        acc.commissions += entry.commissionAmount;
        return acc;
      },
      {
        income: 0,
        spent: 0,
        commissions: 0,
      }
    );

    const pendingWithdrawals = withdrawals
      .filter((withdrawal) => withdrawal.status === "pending_wompi")
      .reduce((total, withdrawal) => total + withdrawal.releasedAmount, 0);
    const privateContentIncome = privateSalesSnap.docs.reduce((total, doc) => {
      const data = doc.data();
      return total + Number(data.releasedAmount || 0);
    }, 0);

    return NextResponse.json({
      balance: Number(user.balance || 0),
      subscriptionStatus: user.subscriptionStatus || null,
      subscriptionAmount: user.subscriptionAmount || null,
      subscriptionNextChargeAt: toDateString(user.subscriptionNextChargeAt),
      summary: {
        ...summary,
        pendingWithdrawals,
        privateContentIncome,
      },
      ledger,
      withdrawals,
    });
  } catch (error) {
    const authError = authRouteError(error);

    if (authError.status !== 401 || authError.message !== "No autorizado") {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("PROVIDER FINANCES ERROR:", error);

    return NextResponse.json(
      { error: "No pudimos cargar tus movimientos" },
      { status: 500 }
    );
  }
}
