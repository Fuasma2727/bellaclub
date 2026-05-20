import crypto from "crypto";
import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminFieldValue } from "@/lib/firebaseAdmin";

export const runtime = "nodejs";

const PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY;
const INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET;
const WOMPI_URL = "https://checkout.wompi.co/p/";
const allowedAmounts = [100000, 200000, 500000];

const getBaseUrl = (request: Request) => {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    new URL(request.url).origin
  );
};

export async function POST(request: Request) {
  try {
    if (!PUBLIC_KEY || !INTEGRITY_SECRET) {
      return NextResponse.json(
        { error: "Wompi no esta configurado" },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json(
        { error: "Debes iniciar sesion" },
        { status: 401 }
      );
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const { amountInCents } = (await request.json()) as {
      amountInCents?: number;
    };
    const amount = Number(amountInCents || 0) / 100;

    if (!amountInCents || !allowedAmounts.includes(amount)) {
      return NextResponse.json(
        { error: "Monto de recarga invalido" },
        { status: 400 }
      );
    }

    const currency = "COP";
    const reference = `recarga_${decoded.uid}_${Date.now()}`;
    const signature = crypto
      .createHash("sha256")
      .update(`${reference}${amountInCents}${currency}${INTEGRITY_SECRET}`)
      .digest("hex");

    await adminDb.collection("recharges").doc(reference).set({
      userId: decoded.uid,
      email: decoded.email || null,
      amount,
      amountInCents,
      currency,
      status: "PENDING",
      provider: "wompi",
      createdAt: adminFieldValue.serverTimestamp(),
      updatedAt: adminFieldValue.serverTimestamp(),
    });

    const params = new URLSearchParams({
      "public-key": PUBLIC_KEY,
      currency,
      "amount-in-cents": String(amountInCents),
      reference,
      "signature:integrity": signature,
      "redirect-url": `${getBaseUrl(request)}/wompi/resultado`,
    });

    return NextResponse.json({ url: `${WOMPI_URL}?${params.toString()}` });
  } catch (error) {
    console.error("Error generando checkout Wompi:", error);
    return NextResponse.json(
      { error: "Error generando el pago" },
      { status: 500 }
    );
  }
}
