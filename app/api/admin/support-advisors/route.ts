import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";
import { guardMutationRequest, securityErrorResponse } from "@/lib/requestSecurity";
import { MAX_SUPPORT_ADVISORS_BODY_BYTES, parseSupportAdvisors, SupportAdvisorsValidationError } from "@/lib/supportAdvisors";
import {
  readSupportAdvisorsSettings,
  supportAdvisorsRef,
  SUPPORT_ADVISORS_CACHE_TAG,
} from "@/lib/supportAdvisors.server";

const errorResponse = (error: unknown) => {
  const securityError = securityErrorResponse(error);
  if (securityError) return securityError;
  if (error instanceof SupportAdvisorsValidationError || error instanceof SyntaxError) {
    return NextResponse.json(
      { error: error instanceof SyntaxError ? "La solicitud no es válida." : error.message },
      { status: 400 }
    );
  }
  if (error instanceof Error && error.message === "ADVISORS_CONFLICT") {
    return NextResponse.json(
      { error: "Los asesores cambiaron en otra sesión. Recarga la lista antes de guardar de nuevo." },
      { status: 409 }
    );
  }
  const authError = ownerAuthError(error);
  return NextResponse.json({ error: authError.message }, { status: authError.status });
};

export async function GET(request: Request) {
  try {
    await requireOwner(request);
    return NextResponse.json(await readSupportAdvisorsSettings(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "admin-support-advisors",
      limit: 30,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: MAX_SUPPORT_ADVISORS_BODY_BYTES,
    });
    const owner = await requireOwner(request);
    const body: unknown = await request.json();
    const input = body as { advisors?: unknown; revision?: unknown } | null;
    const advisors = parseSupportAdvisors(input?.advisors);
    const revision = input?.revision;
    if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) {
      return NextResponse.json({ error: "Recarga la lista antes de guardar." }, { status: 400 });
    }

    await adminDb.runTransaction(async (transaction) => {
      const ref = supportAdvisorsRef();
      const current = await transaction.get(ref);
      if ((current.data()?.revision ?? 0) !== revision) {
        throw new Error("ADVISORS_CONFLICT");
      }
      transaction.set(ref, {
        advisors,
        revision: revision + 1,
        updatedAt: adminFieldValue.serverTimestamp(),
        updatedBy: owner.uid,
      });
    });

    // Expire immediately so hidden/deleted contacts disappear on the next visit.
    revalidateTag(SUPPORT_ADVISORS_CACHE_TAG, { expire: 0 });
    return NextResponse.json({ advisors, revision: revision + 1 });
  } catch (error) {
    return errorResponse(error);
  }
}
