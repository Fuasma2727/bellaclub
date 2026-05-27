import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import { calculateCommission } from "@/lib/commission";
import { setLedgerEntry } from "@/lib/ledger";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

const MIN_WITHDRAWAL_AMOUNT = 50000;
const MAX_WITHDRAWAL_AMOUNT = 5000000;
const allowedPayoutMethods = ["nequi", "bancolombia"] as const;
const allowedAccountTypes = ["ahorros", "corriente"] as const;

const cleanText = (value: unknown, maxLength = 120) => {
  return String(value || "")
    .trim()
    .replace(/[<>]/g, "")
    .slice(0, maxLength);
};

const isValidPayoutText = (value: string) =>
  /^[\p{L}\s.'-]{3,120}$/u.test(value);

const isAllowedValue = <T extends readonly string[]>(
  value: string,
  allowed: T
): value is T[number] => {
  return allowed.includes(value);
};

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit(`withdrawals:${getClientIp(request)}`, {
      limit: 10,
      windowMs: 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Demasiados intentos. Intenta de nuevo en un momento." },
        { status: 429 }
      );
    }

    const decoded = await requireAuthenticatedUser(request);
    const body = (await request.json()) as {
      amount?: number;
      accountHolder?: string;
      payoutMethod?: string;
      payoutAccount?: string;
      payoutAccountType?: string;
    };

    const amount = Math.floor(Number(body.amount || 0));
    const accountHolder = cleanText(body.accountHolder);
    const payoutMethod = cleanText(body.payoutMethod).toLowerCase();
    const payoutAccount = String(body.payoutAccount || "").replace(/\D/g, "");
    const payoutAccountType = cleanText(body.payoutAccountType).toLowerCase();

    if (!amount || amount < MIN_WITHDRAWAL_AMOUNT) {
      return NextResponse.json(
        {
          error: `El retiro minimo es $${MIN_WITHDRAWAL_AMOUNT.toLocaleString(
            "es-CO"
          )}`,
        },
        { status: 400 }
      );
    }

    if (amount > MAX_WITHDRAWAL_AMOUNT) {
      return NextResponse.json(
        {
          error: `El retiro maximo por solicitud es $${MAX_WITHDRAWAL_AMOUNT.toLocaleString(
            "es-CO"
          )}`,
        },
        { status: 400 }
      );
    }

    if (!accountHolder || !payoutMethod || !payoutAccount || !payoutAccountType) {
      return NextResponse.json(
        { error: "Completa los datos de retiro" },
        { status: 400 }
      );
    }

    if (!isAllowedValue(payoutMethod, allowedPayoutMethods)) {
      return NextResponse.json(
        { error: "Selecciona Nequi o Bancolombia" },
        { status: 400 }
      );
    }

    if (!isAllowedValue(payoutAccountType, allowedAccountTypes)) {
      return NextResponse.json(
        { error: "Selecciona cuenta de ahorros o corriente" },
        { status: 400 }
      );
    }

    if (!isValidPayoutText(accountHolder)) {
      return NextResponse.json(
        { error: "Los datos de retiro tienen caracteres no validos" },
        { status: 400 }
      );
    }

    if (!/^\d{10,16}$/.test(payoutAccount)) {
      return NextResponse.json(
        { error: "El numero debe tener entre 10 y 16 digitos" },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection("users").doc(decoded.uid);
    const withdrawalRef = adminDb.collection("withdrawals").doc();
    const notificationRef = adminDb.collection("notifications").doc();
    const {
      commissionAmount,
      commissionRate,
      releasedAmount,
      totalAmount,
    } = calculateCommission(amount);

    await adminDb.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);

      if (!userSnap.exists) {
        throw new Error("USER_NOT_FOUND");
      }

      const user = userSnap.data() || {};

      if (user.role !== "prestador") {
        throw new Error("ONLY_PROVIDERS");
      }

      const balance = Number(user.balance || 0);

      if (balance < totalAmount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      tx.update(userRef, {
        balance: adminFieldValue.increment(-totalAmount),
        updatedAt: adminFieldValue.serverTimestamp(),
      });

      tx.set(withdrawalRef, {
        providerId: decoded.uid,
        providerEmail: decoded.email || user.email || null,
        providerName: user.name || null,
        amount: totalAmount,
        commissionAmount,
        commissionRate,
        releasedAmount,
        payoutProvider: "wompi",
        payoutMethod,
        payoutAccount,
        payoutAccountType,
        accountHolder,
        status: "pending_wompi",
        createdAt: adminFieldValue.serverTimestamp(),
        updatedAt: adminFieldValue.serverTimestamp(),
      });

      tx.set(notificationRef, {
        userId: decoded.uid,
        type: "withdrawal_requested",
        title: "Retiro solicitado",
        message: `Solicitaste retirar $${totalAmount.toLocaleString(
          "es-CO"
        )}. Comision BelaClub: $${commissionAmount.toLocaleString(
          "es-CO"
        )}. Recibiras $${releasedAmount.toLocaleString("es-CO")}.`,
        amount: totalAmount,
        commissionAmount,
        releasedAmount,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      setLedgerEntry(tx, {
        userId: decoded.uid,
        type: "withdrawal_request",
        direction: "debit",
        amount: totalAmount,
        commissionAmount,
        netAmount: releasedAmount,
        status: "pending",
        sourceCollection: "withdrawals",
        sourceId: withdrawalRef.id,
        metadata: {
          payoutProvider: "wompi",
          payoutMethod,
          payoutAccountType,
        },
      });

      setLedgerEntry(tx, {
        userId: null,
        counterpartyUserId: decoded.uid,
        type: "withdrawal_commission",
        direction: "commission",
        amount: commissionAmount,
        commissionAmount,
        status: "pending",
        sourceCollection: "withdrawals",
        sourceId: withdrawalRef.id,
      });
    });

    return NextResponse.json({
      success: true,
      amount: totalAmount,
      commissionAmount,
      releasedAmount,
      status: "pending_wompi",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "ONLY_PROVIDERS") {
      return NextResponse.json(
        { error: "Solo los prestadores pueden retirar saldo" },
        { status: 403 }
      );
    }

    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return NextResponse.json(
        { error: "Saldo insuficiente para este retiro" },
        { status: 400 }
      );
    }

    const authError = authRouteError(error);

    if (authError.status !== 401 || authError.message !== "No autorizado") {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("WITHDRAWAL ERROR:", error);

    return NextResponse.json(
      { error: "No pudimos crear el retiro" },
      { status: 500 }
    );
  }
}
