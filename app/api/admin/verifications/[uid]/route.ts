import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";
import {
  processProviderSubscription,
  PROVIDER_MONTHLY_FEE,
} from "@/lib/providerSubscription";
import { getAdminQualityRank } from "@/lib/providerPromotion";
import { releaseReferralReward } from "@/lib/referrals";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

type VerificationAction =
  | "approve"
  | "reject"
  | "rejectBadgeVerification"
  | "verifyVisit"
  | "downgradeBadge"
  | "removeVisit"
  | "block"
  | "unblock"
  | "deleteMedia"
  | "setProfilePhoto"
  | "setQualityRank"
  | "deleteProvider"
  | "disableSubscription"
  | "enableSubscription";

type VerificationBadge = "bronze" | "silver" | "gold" | "platinum";

type MediaItem = {
  id?: string;
  url?: string;
  type?: "photo" | "video";
  private?: boolean;
};

const BUNNY_STORAGE_ZONE =
  process.env.BUNNY_STORAGE_ZONE || "pp-profile-photos";
const BUNNY_STORAGE_HOST =
  process.env.BUNNY_STORAGE_HOST || "ny.storage.bunnycdn.com";
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;

const getHost = (value: string) =>
  value
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

const extractBunnyPath = (url: unknown, uid: string) => {
  if (typeof url !== "string" || !url.startsWith("https://")) return null;

  try {
    const parsed = new URL(url);
    let path = decodeURIComponent(parsed.pathname).replace(/^\/+/, "");

    if (path.startsWith(`${BUNNY_STORAGE_ZONE}/`)) {
      path = path.slice(BUNNY_STORAGE_ZONE.length + 1);
    }

    return path.startsWith(`users/${uid}/`) ? path : null;
  } catch {
    return null;
  }
};

const collectBunnyPaths = (
  uid: string,
  userData: FirebaseFirestore.DocumentData
) => {
  const paths = new Set<string>();
  const add = (url: unknown) => {
    const path = extractBunnyPath(url, uid);
    if (path) paths.add(path);
  };

  add(userData.photoUrl);
  add(userData.verificationPhotoUrl);
  add(userData.badgeVerificationVideoUrl);
  add(userData.dailyVideo?.url);

  if (Array.isArray(userData.media)) {
    userData.media.forEach((item: unknown) => {
      if (item && typeof item === "object") {
        add((item as Record<string, unknown>).url);
      }
    });
  }

  return [...paths];
};

const deleteBunnyPath = async (path: string) => {
  if (!BUNNY_API_KEY) {
    throw new Error("BUNNY_API_KEY_MISSING");
  }

  const storageHost = getHost(BUNNY_STORAGE_HOST);
  const res = await fetch(
    `https://${storageHost}/${BUNNY_STORAGE_ZONE}/${path}`,
    {
      method: "DELETE",
      headers: {
        AccessKey: BUNNY_API_KEY,
      },
    }
  );

  if (!res.ok && res.status !== 404) {
    const details = await res.text().catch(() => "");
    throw new Error(
      `BUNNY_DELETE_FAILED:${res.status}:${details || "sin detalle"}`
    );
  }
};

const deleteQueryDocs = async (query: FirebaseFirestore.Query) => {
  const snapshot = await query.get();
  let deleted = 0;
  let batch = adminDb.batch();
  let batchSize = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
    deleted += 1;
    batchSize += 1;

    if (batchSize >= 450) {
      await batch.commit();
      batch = adminDb.batch();
      batchSize = 0;
    }
  }

  if (batchSize > 0) {
    await batch.commit();
  }

  return deleted;
};

const deleteWhere = (
  collectionName: string,
  field: string,
  value: string
) => {
  return deleteQueryDocs(
    adminDb.collection(collectionName).where(field, "==", value)
  );
};

const removePurchasedContentReferences = async (uid: string) => {
  const snapshot = await adminDb.collection("users").get();
  let batch = adminDb.batch();
  let batchSize = 0;

  for (const doc of snapshot.docs) {
    if (doc.id === uid) continue;

    const data = doc.data();
    const purchasedContent = Array.isArray(data.purchasedContent)
      ? data.purchasedContent
      : [];
    const nextPurchasedContent = purchasedContent.filter(
      (item) => item?.sellerId !== uid
    );

    if (nextPurchasedContent.length === purchasedContent.length) continue;

    batch.update(doc.ref, { purchasedContent: nextPurchasedContent });
    batchSize += 1;

    if (batchSize >= 450) {
      await batch.commit();
      batch = adminDb.batch();
      batchSize = 0;
    }
  }

  if (batchSize > 0) {
    await batch.commit();
  }
};

const deleteProviderRecords = async (uid: string) => {
  const rechargeSnapshot = await adminDb
    .collection("recharges")
    .where("userId", "==", uid)
    .get();
  const rechargeReferences = rechargeSnapshot.docs.map((doc) => doc.id);

  await Promise.all(
    rechargeReferences.map((reference) =>
      deleteWhere("wompiEvents", "reference", reference)
    )
  );

  await deleteQueryDocs(
    adminDb.collection("recharges").where("userId", "==", uid)
  );

  await Promise.all([
    deleteWhere("notifications", "userId", uid),
    deleteWhere("notifications", "fromUserId", uid),
    deleteWhere("notifications", "sellerId", uid),
    deleteWhere("reports", "providerId", uid),
    deleteWhere("reports", "reporterId", uid),
    deleteWhere("withdrawals", "providerId", uid),
    deleteWhere("contentPurchases", "sellerId", uid),
    deleteWhere("contentPurchases", "buyerId", uid),
    deleteWhere("serviceDeposits", "sellerId", uid),
    deleteWhere("serviceDeposits", "buyerId", uid),
    deleteWhere("ledger", "userId", uid),
    deleteWhere("ledger", "counterpartyUserId", uid),
    deleteWhere("providerSubscriptions", "providerId", uid),
    deleteWhere("providerVideoTimePurchases", "providerId", uid),
    deleteWhere("providerPromotions", "providerId", uid),
  ]);

  await removePurchasedContentReferences(uid);
};

const badgeByLevel = (level: number): VerificationBadge | null => {
  if (level === 1) return "bronze";
  if (level === 2) return "silver";
  if (level === 3) return "gold";
  if (level === 4) return "platinum";
  return null;
};

const levelByBadge = (badge?: string | null) => {
  if (badge === "bronze") return 1;
  if (badge === "silver") return 2;
  if (badge === "gold") return 3;
  if (badge === "platinum") return 4;
  return 0;
};

const badgeLabelByLevel = (level: number) => {
  if (level === 1) return "Bronce";
  if (level === 2) return "Plata";
  if (level === 3) return "Oro";
  if (level === 4) return "Diamante";
  return "verificacion";
};

type Params = {
  params: Promise<{
    uid: string;
  }>;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "admin-verification-action",
      limit: 60,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: 8 * 1024,
    });

    const owner = await requireOwner(request);
    const { uid } = await params;
    const { action, mediaId, confirmText, qualityRank } =
      (await request.json()) as {
      action?: VerificationAction;
      mediaId?: string;
      confirmText?: string;
      qualityRank?: number | null;
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
      "rejectBadgeVerification",
      "verifyVisit",
      "downgradeBadge",
      "removeVisit",
      "block",
      "unblock",
      "deleteMedia",
      "setProfilePhoto",
      "setQualityRank",
      "deleteProvider",
      "disableSubscription",
      "enableSubscription",
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

    if (action === "deleteProvider") {
      if (confirmText !== "ELIMINAR") {
        return NextResponse.json(
          { error: "Confirmacion invalida" },
          { status: 400 }
        );
      }

      const bunnyPaths = collectBunnyPaths(uid, userData || {});

      if (bunnyPaths.length > 0 && !BUNNY_API_KEY) {
        return NextResponse.json(
          { error: "BUNNY_API_KEY no esta configurada" },
          { status: 500 }
        );
      }

      for (const path of bunnyPaths) {
        await deleteBunnyPath(path);
      }

      await deleteProviderRecords(uid);
      await userRef.delete();

      try {
        await adminAuth.deleteUser(uid);
      } catch (authDeleteError) {
        const code =
          authDeleteError &&
          typeof authDeleteError === "object" &&
          "code" in authDeleteError
            ? String((authDeleteError as { code?: unknown }).code)
            : "";

        if (code !== "auth/user-not-found") {
          throw authDeleteError;
        }
      }

      return NextResponse.json({
        success: true,
        deletedProviderId: uid,
        deletedFiles: bunnyPaths.length,
      });
    }

    if (action === "approve") {
      const hasProfilePhoto = Boolean(userData.photoUrl);

      await userRef.update({
        isVerified: true,
        profileVisible: hasProfilePhoto,
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
      const level = Number(userData.badgeVerificationLevel || 0);
      const badge = badgeByLevel(level);
      const hasProfilePhoto = Boolean(userData.photoUrl);

      if (!badge || userData.badgeVerificationStatus !== "pending") {
        return NextResponse.json(
          { error: "El prestador no tiene una solicitud de insignia valida" },
          { status: 400 }
        );
      }

      await userRef.update({
        isVerified: true,
        profileVisible: hasProfilePhoto,
        verificationStatus: "approved",
        blocked: false,
        blockedReason: adminFieldValue.delete(),
        visitVerified: level >= 3,
        visitVerificationStatus: level >= 3 ? "approved" : "none",
        verificationBadge: badge,
        badgeVerificationStatus: "approved",
        badgeVerifiedAt: adminFieldValue.serverTimestamp(),
        badgeVerifiedBy: owner.uid,
        subscriptionStatus:
          userData.subscriptionStatus || "pending_payment",
        subscriptionAmount: PROVIDER_MONTHLY_FEE,
        subscriptionManualOverride: false,
        subscriptionNextChargeAt:
          userData.subscriptionNextChargeAt ||
          adminFieldValue.serverTimestamp(),
        subscriptionUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      const subscriptionResult = await processProviderSubscription(uid);
      const badgeLabel = badgeLabelByLevel(level);

      await adminDb.collection("notifications").doc().set({
        userId: uid,
        type: "badge_verification_approved",
        title: "Nivel aprobado",
        message: `Tu nivel ${badgeLabel} fue aprobado. Ya aparece en tu perfil.`,
        badge,
        badgeLevel: level,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      let referralResult = null;

      try {
        referralResult = await releaseReferralReward(uid, "provider_bronze", {
          trigger: "badge_verification_approved",
          badge,
          badgeLevel: level,
          verifiedBy: owner.uid,
        });
      } catch (referralError) {
        console.error("REFERRAL REWARD ERROR:", referralError);
      }

      return NextResponse.json({
        success: true,
        verificationBadge: badge,
        subscriptionResult,
        referralResult,
      });
    }

    if (action === "downgradeBadge") {
      const currentLevel =
        Number(userData.badgeVerificationLevel || 0) ||
        levelByBadge(userData.verificationBadge);
      const currentBadge = badgeByLevel(currentLevel);

      if (!currentBadge || currentLevel <= 0) {
        return NextResponse.json(
          { error: "El prestador no tiene un nivel para bajar" },
          { status: 400 }
        );
      }

      const nextLevel = Math.max(currentLevel - 1, 0);
      const nextBadge = badgeByLevel(nextLevel);
      const nextStatus = nextBadge ? "approved" : "none";
      const previousLabel = badgeLabelByLevel(currentLevel);
      const nextLabel = nextBadge ? badgeLabelByLevel(nextLevel) : "sin nivel";

      await userRef.update({
        verificationBadge: nextBadge,
        badgeVerificationLevel: nextLevel || null,
        badgeVerificationStatus: nextStatus,
        badgeVerificationVideoUrl: adminFieldValue.delete(),
        badgeVerificationEvidenceType: adminFieldValue.delete(),
        badgeVerificationRequestedAt: adminFieldValue.delete(),
        visitVerified: nextLevel >= 3,
        visitVerificationStatus: nextLevel >= 3 ? "approved" : "none",
        badgeDowngradedAt: adminFieldValue.serverTimestamp(),
        badgeDowngradedBy: owner.uid,
        previousVerificationBadge: currentBadge,
        previousBadgeVerificationLevel: currentLevel,
      });

      await adminDb.collection("notifications").doc().set({
        userId: uid,
        type: "badge_verification_downgraded",
        title: "Nivel actualizado",
        message: nextBadge
          ? `Tu nivel de verificacion fue ajustado de ${previousLabel} a ${nextLabel} por revision del administrador.`
          : `Tu nivel ${previousLabel} fue retirado por revision del administrador. Puedes enviar una nueva solicitud desde tu perfil.`,
        previousBadge: currentBadge,
        previousBadgeLevel: currentLevel,
        badge: nextBadge,
        badgeLevel: nextLevel || null,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        verificationBadge: nextBadge,
        badgeVerificationLevel: nextLevel || null,
        badgeVerificationStatus: nextStatus,
        visitVerified: nextLevel >= 3,
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

    if (action === "rejectBadgeVerification") {
      const level = Number(userData.badgeVerificationLevel || 0);

      if (userData.badgeVerificationStatus !== "pending") {
        return NextResponse.json(
          { error: "El prestador no tiene una solicitud de insignia pendiente" },
          { status: 400 }
        );
      }

      await userRef.update({
        badgeVerificationStatus: "rejected",
        badgeVerificationVideoUrl: adminFieldValue.delete(),
        badgeVerificationEvidenceType: adminFieldValue.delete(),
        badgeVerificationRequestedAt: adminFieldValue.delete(),
        badgeVerificationRejectedAt: adminFieldValue.serverTimestamp(),
        badgeVerificationRejectedBy: owner.uid,
      });

      await adminDb.collection("notifications").doc().set({
        userId: uid,
        type: "badge_verification_rejected",
        title: "Verificacion no aprobada",
        message: `Tu evidencia para nivel ${badgeLabelByLevel(
          level
        )} no fue aprobada. Puedes enviar una nueva foto o video desde tu perfil.`,
        badgeLevel: level || null,
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        badgeVerificationStatus: "rejected",
      });
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

    if (action === "setQualityRank") {
      const rank =
        qualityRank === null || typeof qualityRank === "undefined"
          ? null
          : getAdminQualityRank(qualityRank);

      if (qualityRank !== null && typeof qualityRank !== "undefined" && !rank) {
        return NextResponse.json(
          { error: "La calidad debe estar entre 1 y 5" },
          { status: 400 }
        );
      }

      await userRef.update({
        adminQualityRank: rank || adminFieldValue.delete(),
        adminQualityRankUpdatedAt: adminFieldValue.serverTimestamp(),
        adminQualityRankUpdatedBy: owner.uid,
        profileUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        adminQualityRank: rank,
      });
    }

    if (action === "disableSubscription") {
      await userRef.update({
        blocked: false,
        blockedReason: adminFieldValue.delete(),
        profileVisible:
          userData.verificationStatus === "approved" &&
          Boolean(userData.photoUrl),
        subscriptionStatus: "admin_override",
        subscriptionManualOverride: true,
        subscriptionAmount: PROVIDER_MONTHLY_FEE,
        subscriptionUpdatedAt: adminFieldValue.serverTimestamp(),
        subscriptionOverrideAt: adminFieldValue.serverTimestamp(),
        subscriptionOverrideBy: owner.uid,
      });

      await adminDb.collection("notifications").doc().set({
        userId: uid,
        type: "provider_subscription_disabled",
        title: "Mensualidad pausada",
        message:
          "El administrador pauso el cobro de tu mensualidad. Tu perfil seguira activo.",
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        subscriptionStatus: "admin_override",
        subscriptionManualOverride: true,
        blocked: false,
      });
    }

    if (action === "enableSubscription") {
      await userRef.update({
        subscriptionStatus: "pending_payment",
        subscriptionManualOverride: false,
        subscriptionAmount: PROVIDER_MONTHLY_FEE,
        subscriptionNextChargeAt: adminFieldValue.serverTimestamp(),
        subscriptionUpdatedAt: adminFieldValue.serverTimestamp(),
        subscriptionOverrideRemovedAt: adminFieldValue.serverTimestamp(),
        subscriptionOverrideRemovedBy: owner.uid,
      });

      const subscriptionResult = await processProviderSubscription(uid);

      await adminDb.collection("notifications").doc().set({
        userId: uid,
        type: "provider_subscription_enabled",
        title: "Mensualidad activada",
        message:
          "El administrador activo nuevamente el cobro mensual de tu perfil.",
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        subscriptionManualOverride: false,
        subscriptionResult,
      });
    }

    if (action === "setProfilePhoto") {
      if (!mediaId) {
        return NextResponse.json(
          { error: "Foto requerida" },
          { status: 400 }
        );
      }

      const media = Array.isArray(userData.media)
        ? (userData.media as MediaItem[])
        : [];
      const selectedMedia = media.find(
        (item, index) => (item.id || `legacy-${index}`) === mediaId
      );

      if (!selectedMedia?.url) {
        return NextResponse.json(
          { error: "Foto no encontrada" },
          { status: 404 }
        );
      }

      if (selectedMedia.type === "video") {
        return NextResponse.json(
          { error: "Selecciona una foto, no un video" },
          { status: 400 }
        );
      }

      if (selectedMedia.private) {
        return NextResponse.json(
          { error: "No puedes usar contenido privado como foto principal" },
          { status: 400 }
        );
      }

      const profileVisible =
        userData.verificationStatus === "approved" &&
        !userData.blocked &&
        !userData.profilePaused;

      await userRef.update({
        photoUrl: selectedMedia.url,
        profileVisible,
        profilePhotoUpdatedAt: adminFieldValue.serverTimestamp(),
        profilePhotoUpdatedBy: owner.uid,
      });

      await adminDb.collection("notifications").doc().set({
        userId: uid,
        type: "provider_profile_photo_set",
        title: "Foto principal actualizada",
        message:
          "El administrador eligio una foto de tu galeria como foto principal.",
        read: false,
        createdAt: adminFieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        photoUrl: selectedMedia.url,
        profileVisible,
      });
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
        profileVisible:
          userData.verificationStatus === "approved" &&
          Boolean(userData.photoUrl),
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
      verificationPhotoUrl: adminFieldValue.delete(),
      blocked: false,
      visitVerified: false,
      visitVerificationStatus: "none",
      verificationBadge: null,
      badgeVerificationStatus: "none",
      rejectedAt: adminFieldValue.serverTimestamp(),
      rejectedBy: owner.uid,
    });

    await adminDb.collection("notifications").doc().set({
      userId: uid,
      type: "provider_verification_rejected",
      title: "Verificacion no aprobada",
      message:
        "Tu foto de verificacion no fue aprobada. Puedes enviar una nueva solicitud desde tu perfil con una foto o video mas claro.",
      read: false,
      createdAt: adminFieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, status: "rejected" });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    if (error instanceof Error) {
      if (error.message === "BUNNY_API_KEY_MISSING") {
        return NextResponse.json(
          { error: "BUNNY_API_KEY no esta configurada" },
          { status: 500 }
        );
      }

      if (error.message.startsWith("BUNNY_DELETE_FAILED")) {
        return NextResponse.json(
          { error: "No pudimos eliminar todos los archivos de Bunny" },
          { status: 502 }
        );
      }
    }

    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}
