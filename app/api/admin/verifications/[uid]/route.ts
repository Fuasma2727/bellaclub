import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";
import {
  processProviderSubscription,
  PROVIDER_MONTHLY_FEE,
} from "@/lib/providerSubscription";

type VerificationAction =
  | "approve"
  | "reject"
  | "verifyVisit"
  | "removeVisit"
  | "block"
  | "unblock"
  | "deleteMedia";

type MediaItem = {
  id?: string;
  url?: string;
  type?: "photo" | "video";
};

type Params = {
  params: Promise<{
    uid: string;
  }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    const owner = await requireOwner(request);
    const { uid } = await params;
    const { action, mediaId } = (await request.json()) as {
      action?: VerificationAction;
      mediaId?: string;
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
      "deleteMedia",
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
        blockedReason: adminFieldValue.delete(),
        visitVerified: Boolean(userData.visitVerified),
        subscriptionStatus: "pending_payment",
        subscriptionAmount: PROVIDER_MONTHLY_FEE,
        subscriptionManualOverride: false,
        subscriptionNextChargeAt: adminFieldValue.serverTimestamp(),
        subscriptionUpdatedAt: adminFieldValue.serverTimestamp(),
        verifiedAt: adminFieldValue.serverTimestamp(),
        verifiedBy: owner.uid,
      });

      const subscriptionResult = await processProviderSubscription(uid);

      return NextResponse.json({
        success: true,
        status: "approved",
        subscriptionResult,
      });
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
        blockedReason: "admin_block",
        subscriptionManualOverride: false,
        profileVisible: false,
        blockedAt: adminFieldValue.serverTimestamp(),
        blockedBy: owner.uid,
      });

      return NextResponse.json({ success: true, blocked: true });
    }

    if (action === "deleteMedia") {
      if (!userData.blocked) {
        return NextResponse.json(
          { error: "Primero debes bloquear el perfil para eliminar fotos" },
          { status: 400 }
        );
      }

      if (!mediaId) {
        return NextResponse.json(
          { error: "Foto requerida" },
          { status: 400 }
        );
      }

      if (mediaId === "profile-photo") {
        await userRef.update({
          photoUrl: "",
          mediaModeratedAt: adminFieldValue.serverTimestamp(),
          mediaModeratedBy: owner.uid,
        });

        return NextResponse.json({ success: true, deletedMediaId: mediaId });
      }

      const media = Array.isArray(userData.media)
        ? (userData.media as MediaItem[])
        : [];
      const nextMedia = media.filter(
        (item, index) => (item.id || `legacy-${index}`) !== mediaId
      );

      if (nextMedia.length === media.length) {
        return NextResponse.json(
          { error: "Foto no encontrada" },
          { status: 404 }
        );
      }

      await userRef.update({
        media: nextMedia,
        mediaModeratedAt: adminFieldValue.serverTimestamp(),
        mediaModeratedBy: owner.uid,
      });

      await adminDb.collection("notifications").doc().set({
        userId: uid,
        type: "provider_media_removed",
        title: "Contenido retirado",
        message:
          "El administrador retiro una foto de tu perfil por revision de seguridad.",
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      return NextResponse.json({ success: true, deletedMediaId: mediaId });
    }

    if (action === "unblock") {
      await userRef.update({
        blocked: false,
        blockedReason: adminFieldValue.delete(),
        profileVisible: userData.verificationStatus === "approved",
        subscriptionStatus:
          userData.blockedReason === "subscription_unpaid"
            ? "admin_override"
            : userData.subscriptionStatus || "active",
        subscriptionManualOverride:
          userData.blockedReason === "subscription_unpaid"
            ? true
            : Boolean(userData.subscriptionManualOverride),
        subscriptionUpdatedAt: adminFieldValue.serverTimestamp(),
        unblockedAt: adminFieldValue.serverTimestamp(),
        unblockedBy: owner.uid,
      });

      await adminDb.collection("notifications").doc().set({
        userId: uid,
        type: "provider_unblocked",
        title: "Perfil activado",
        message:
          userData.blockedReason === "subscription_unpaid"
            ? "Tu perfil fue activado manualmente por el administrador aunque la mensualidad sigue pendiente."
            : "Tu perfil fue activado nuevamente por el administrador.",
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
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
