import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

const MIN_REPORT_BALANCE = 500000;

export async function POST(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "reports",
      limit: 10,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: 8 * 1024,
    });

    const decoded = await requireAuthenticatedUser(request);
    const { providerId, reason } = (await request.json()) as {
      providerId?: string;
      reason?: string;
    };

    if (!providerId) {
      return NextResponse.json(
        { error: "Perfil requerido" },
        { status: 400 }
      );
    }

    const reporterSnap = await adminDb.collection("users").doc(decoded.uid).get();

    if (!reporterSnap.exists) {
      return NextResponse.json(
        { error: "Debes estar registrado en BelaClub para reportar" },
        { status: 403 }
      );
    }

    const reporterData = reporterSnap.data() || {};
    const reporterBalance = Number(reporterData.balance || 0);

    if (reporterBalance < MIN_REPORT_BALANCE) {
      return NextResponse.json(
        {
          error:
            "Para reportar un perfil debes tener al menos $500.000 de saldo en BelaClub",
        },
        { status: 403 }
      );
    }

    const cleanReason = reason?.trim().slice(0, 500) || "Reporte general";

    await adminDb.collection("reports").add({
      providerId,
      reporterId: decoded.uid,
      reporterEmail: decoded.email || null,
      reporterBalance,
      reason: cleanReason,
      status: "pending",
      createdAt: adminFieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    const authError = authRouteError(error);

    if (authError.status !== 401 || authError.message !== "No autorizado") {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("REPORT ERROR:", error);

    return NextResponse.json(
      { error: "No pudimos enviar el reporte" },
      { status: 500 }
    );
  }
}
