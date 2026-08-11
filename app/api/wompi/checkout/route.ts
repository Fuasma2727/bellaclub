import crypto from "crypto";
import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  getProviderSubscriptionPlan,
  isProviderSubscriptionPlanId,
  PROVIDER_RECHARGE_AMOUNTS,
} from "@/lib/providerSubscriptionPlans";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

export const runtime = "nodejs";

const PUBLIC_KEY = process.env.WOMPI_PUBLIC_KEY?.trim();
const INTEGRITY_SECRET = process.env.WOMPI_INTEGRITY_SECRET?.trim();
const WOMPI_URL = "https://checkout.wompi.co/p/";

const getWompiEnvironment = (value: string) => {
  if (value.includes("_prod_")) return "prod";
  if (value.includes("_test_")) return "test";
  return "unknown";
};

const getBaseUrl = (request: Request) => {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    new URL(request.url).origin
  );
};

export async function POST(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "wompi-checkout",
      limit: 20,
      windowMs: 60 * 1000,
      maxBodyBytes: 4 * 1024,
    });

    if (!PUBLIC_KEY || !INTEGRITY_SECRET) {
      return NextResponse.json(
        { error: "Wompi no esta configurado" },
        { status: 500 }
      );
    }

    if (!PUBLIC_KEY.startsWith("pub_")) {
      return NextResponse.json(
        { error: "La llave publica de Wompi debe empezar por pub_" },
        { status: 500 }
      );
    }

    if (!INTEGRITY_SECRET.includes("_integrity_")) {
      return NextResponse.json(
        { error: "La llave de integridad de Wompi no es valida" },
        { status: 500 }
      );
    }

    const publicKeyEnvironment = getWompiEnvironment(PUBLIC_KEY);
    const integrityEnvironment = getWompiEnvironment(INTEGRITY_SECRET);

    if (
      publicKeyEnvironment !== "unknown" &&
      integrityEnvironment !== "unknown" &&
      publicKeyEnvironment !== integrityEnvironment
    ) {
      return NextResponse.json(
        {
          error:
            "Las llaves de Wompi pertenecen a ambientes diferentes. Usa ambas test o ambas produccion.",
        },
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

    const decoded = await adminAuth.verifyIdToken(token, true);
    const { amountInCents, providerSubscriptionPlanId } =
      (await request.json()) as {
      amountInCents?: number;
      providerSubscriptionPlanId?: string;
    };
    const amount = Number(amountInCents || 0) / 100;
    const selectedSubscriptionPlan = providerSubscriptionPlanId
      ? getProviderSubscriptionPlan(providerSubscriptionPlanId)
      : null;

    if (
      providerSubscriptionPlanId &&
      (!isProviderSubscriptionPlanId(providerSubscriptionPlanId) ||
        selectedSubscriptionPlan?.amount !== amount)
    ) {
      return NextResponse.json(
        { error: "Plan de publicacion invalido" },
        { status: 400 }
      );
    }

    if (
      !amountInCents ||
      (!selectedSubscriptionPlan &&
        !(PROVIDER_RECHARGE_AMOUNTS as readonly number[]).includes(amount))
    ) {
      return NextResponse.json(
        { error: "Monto de recarga invalido" },
        { status: 400 }
      );
    }

    if (selectedSubscriptionPlan) {
      const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
      const userData = userSnap.data() || {};

      if (userData.role !== "prestador") {
        return NextResponse.json(
          { error: "Solo las escorts pueden pagar planes de publicacion" },
          { status: 403 }
        );
      }
    }

    const currency = "COP";
    const reference = `BC-${Date.now()}-${decoded.uid.slice(0, 10)}`;
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
      purpose: selectedSubscriptionPlan
        ? "provider_subscription"
        : "balance_recharge",
      providerSubscriptionPlanId: selectedSubscriptionPlan?.id || null,
      providerSubscriptionPlanAmount: selectedSubscriptionPlan?.amount || null,
      providerSubscriptionPlanDays:
        selectedSubscriptionPlan?.durationDays || null,
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

    if (decoded.email) {
      params.set("customer-data:email", decoded.email);
    }

    if (decoded.name) {
      params.set("customer-data:full-name", decoded.name);
    }

    return NextResponse.json({ url: `${WOMPI_URL}?${params.toString()}` });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    console.error("Error generando checkout Wompi:", error);
    return NextResponse.json(
      { error: "Error generando el pago" },
      { status: 500 }
    );
  }
}
