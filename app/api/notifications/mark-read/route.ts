import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

export async function POST(req: Request) {
  try {
    guardMutationRequest(req, {
      rateLimitKey: "notifications-mark-read",
      limit: 60,
      windowMs: 10 * 60 * 1000,
    });

    const decoded = await requireAuthenticatedUser(req);
    const snapshot = await adminDb
      .collection("notifications")
      .where("userId", "==", decoded.uid)
      .where("read", "==", false)
      .get();

    const batch = adminDb.batch();

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { read: true });
    });

    await batch.commit();

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

    console.error("MARK READ ERROR:", error);

    return NextResponse.json(
      { error: "Error interno" },
      { status: 500 }
    );
  }
}
