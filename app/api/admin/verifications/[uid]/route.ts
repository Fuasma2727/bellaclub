import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";

type VerificationAction =
  | "approve"
  | "reject"
  | "verifyVisit"
  | "removeVisit"
  | "block"
  | "unblock";

type Params = {
  params: Promise<{
    uid: string;
  }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const owner = await requireOwner(request);
    const { uid } = await params;
    const { action } = (await request.json()) as {
      action?: VerificationAction;
    };

    if (!uid) {
      return NextResponse.json(
        { error: "Usuario requerido" },
        { status: 400 }
      );
    }

    const validActions: VerificationAction[] = [
      "approve",
      "reject",
      "verifyVisit",
      "removeVisit",
      "block",
      "unblock",
    ];

    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: "Accion invalida" },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const userData = userSnap.data();

    if (userData?.role !== "prestador") {
      return NextResponse.json(
        { error: "El usuario no es prestador" },
        { status: 400 }
      );
    }

    if (action === "approve") {
      await userRef.update({
        isVerified: true,
        profileVisible: true,
        verificationStatus: "approved",
        blocked: false,
        visitVerified: Boolean(userData.visitVerified),
        verifiedAt: adminFieldValue.serverTimestamp(),
        verifiedBy: owner.uid,
      });

      return NextResponse.json({ success: true, status: "approved" });
    }

    if (action === "verifyVisit") {
      if (userData.verificationStatus !== "approved") {
        return NextResponse.json(
          { error: "Primero debes aprobar el perfil inicial" },
          { status: 400 }
        );
      }

      const level = Number(userData.badgeVerificationLevel || 0);

      if (level !== 1 && level !== 2) {
        return NextResponse.json(
          { error: "El prestador no tiene una solicitud de insignia valida" },
          { status: 400 }
        );
      }

      await userRef.update({
        visitVerified: level === 2,
        visitVerificationStatus: level === 2 ? "approved" : "none",
        verificationBadge: level === 2 ? "diamond" : "gold",
        badgeVerificationStatus: "approved",
        badgeVerifiedAt: adminFieldValue.serverTimestamp(),
        badgeVerifiedBy: owner.uid,
      });

      return NextResponse.json({
        success: true,
        verificationBadge: level === 2 ? "diamond" : "gold",
      });
    }

    if (action === "removeVisit") {
      await userRef.update({
        visitVerified: false,
        visitVerificationStatus: "rejected",
        verificationBadge: null,
        badgeVerificationStatus: "rejected",
        visitVerificationRemovedAt: adminFieldValue.serverTimestamp(),
        visitVerificationRemovedBy: owner.uid,
      });

      return NextResponse.json({ success: true, visitVerified: false });
    }

    if (action === "block") {
      await userRef.update({
        blocked: true,
        profileVisible: false,
        blockedAt: adminFieldValue.serverTimestamp(),
        blockedBy: owner.uid,
      });

      return NextResponse.json({ success: true, blocked: true });
    }

    if (action === "unblock") {
      await userRef.update({
        blocked: false,
        profileVisible: userData.verificationStatus === "approved",
        unblockedAt: adminFieldValue.serverTimestamp(),
        unblockedBy: owner.uid,
      });

      return NextResponse.json({ success: true, blocked: false });
    }

    await userRef.update({
      isVerified: false,
      profileVisible: false,
      verificationStatus: "rejected",
      blocked: false,
      visitVerified: false,
      visitVerificationStatus: "none",
      verificationBadge: null,
      badgeVerificationStatus: "none",
      rejectedAt: adminFieldValue.serverTimestamp(),
      rejectedBy: owner.uid,
    });

    return NextResponse.json({ success: true, status: "rejected" });
  } catch (error) {
    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}
