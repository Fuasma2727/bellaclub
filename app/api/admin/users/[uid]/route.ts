import { NextResponse } from "next/server";
import { adminAuth, adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { setLedgerEntry } from "@/lib/ledger";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";
import { invalidatePublicProviderCache } from "@/lib/publicProviders";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

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
  let batch = adminDb.batch();
  let batchSize = 0;

  for (const doc of snapshot.docs) {
    batch.delete(doc.ref);
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
      (item) => item?.sellerId !== uid && item?.buyerId !== uid
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

const deleteUserRecords = async (uid: string) => {
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
    deleteWhere("referralRewards", "referrerId", uid),
    deleteWhere("referralRewards", "referredUserId", uid),
    deleteWhere("adminBalanceCredits", "userId", uid),
  ]);

  await removePurchasedContentReferences(uid);
};

type Params = {
  params: Promise<{
    uid: string;
  }>;
};

const isStrongTemporaryPassword = (value: string) => {
  return (
    value.length >= 6 &&
    value.length <= 128 &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value)
  );
};

const cleanTextField = (value: unknown, maxLength: number) => {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, maxLength);
};

const parseMoneyAmount = (value: unknown) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.floor(value) : 0;
  }

  if (typeof value !== "string") return 0;

  const text = value.trim().toLowerCase();
  const digits = text.replace(/\D/g, "");
  const digitValue = digits ? Number(digits) : 0;

  if (!Number.isFinite(digitValue) || digitValue <= 0) {
    return 0;
  }

  return Math.floor(
    digitValue * (text.includes("mil") && digitValue < 1000 ? 1000 : 1)
  );
};

const invalidateAdminUsersCache = () => {
  const globalForAdminUsersCache = globalThis as typeof globalThis & {
    __belaclubAdminUsersCache?: {
      users?: unknown[];
      expiresAt: number;
      inFlight?: Promise<unknown[]>;
    };
  };

  const cache = globalForAdminUsersCache.__belaclubAdminUsersCache;

  if (!cache) return;

  cache.users = undefined;
  cache.expiresAt = 0;
  cache.inFlight = undefined;
};

export async function PATCH(request: Request, { params }: Params) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "admin-users-action",
      limit: 60,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: 8 * 1024,
    });

    const owner = await requireOwner(request);
    const { uid } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      action?: "setPassword" | "updateProfile" | "creditBalance";
      password?: string;
      name?: string;
      whatsapp?: string;
      amount?: number | string;
      reason?: string;
    };

    if (!uid) {
      return NextResponse.json(
        { error: "Usuario requerido" },
        { status: 400 }
      );
    }

    if (
      !body.action ||
      !["setPassword", "updateProfile", "creditBalance"].includes(body.action)
    ) {
      return NextResponse.json(
        { error: "Accion invalida" },
        { status: 400 }
      );
    }

    if (uid === owner.uid) {
      return NextResponse.json(
        { error: "No puedes modificar la cuenta administradora" },
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

    const userData = userSnap.data() || {};
    const email = typeof userData.email === "string" ? userData.email : "";

    if (owner.email && email.toLowerCase() === owner.email.toLowerCase()) {
      return NextResponse.json(
        { error: "No puedes modificar la cuenta administradora" },
        { status: 400 }
      );
    }

    if (body.action === "updateProfile") {
      const name = cleanTextField(body.name, 90);
      const whatsapp = cleanTextField(body.whatsapp, 40);

      if (!name) {
        return NextResponse.json(
          { error: "El nombre es requerido" },
          { status: 400 }
        );
      }

      await userRef.update({
        name,
        whatsapp,
        profileUpdatedAt: adminFieldValue.serverTimestamp(),
        adminProfileUpdatedAt: adminFieldValue.serverTimestamp(),
        adminProfileUpdatedBy: owner.uid,
      });

      invalidateAdminUsersCache();

      if (userData.role === "prestador") {
        invalidatePublicProviderCache();
      }

      return NextResponse.json({
        success: true,
        name,
        whatsapp,
      });
    }

    if (body.action === "creditBalance") {
      const amount = parseMoneyAmount(body.amount);
      const reason =
        cleanTextField(body.reason, 140) || "Bono por usuario referido";

      if (!amount || amount < 1000) {
        return NextResponse.json(
          { error: "El monto minimo para recargar es $1.000" },
          { status: 400 }
        );
      }

      const creditRef = adminDb.collection("adminBalanceCredits").doc();
      const notificationRef = adminDb.collection("notifications").doc();

      await adminDb.runTransaction(async (tx) => {
        const currentUserSnap = await tx.get(userRef);

        if (!currentUserSnap.exists) {
          throw new Error("USER_NOT_FOUND");
        }

        tx.update(userRef, {
          balance: adminFieldValue.increment(amount),
          adminBalanceCreditedAt: adminFieldValue.serverTimestamp(),
          adminBalanceCreditedBy: owner.uid,
          updatedAt: adminFieldValue.serverTimestamp(),
        });

        tx.set(creditRef, {
          userId: uid,
          amount,
          reason,
          status: "completed",
          createdBy: owner.uid,
          createdAt: adminFieldValue.serverTimestamp(),
        });

        setLedgerEntry(tx, {
          userId: uid,
          type: "admin_balance_credit",
          direction: "credit",
          amount,
          status: "completed",
          sourceCollection: "adminBalanceCredits",
          sourceId: creditRef.id,
          createdBy: owner.uid,
          metadata: {
            reason,
            source: "admin_panel",
          },
        });

        tx.set(notificationRef, {
          userId: uid,
          type: "admin_balance_credit",
          title: "Saldo recargado",
          message: `Recibiste $${amount.toLocaleString(
            "es-CO"
          )} de saldo en BelaClub. Motivo: ${reason}.`,
          amount,
          reason,
          read: false,
          createdAt: adminFieldValue.serverTimestamp(),
        });
      });

      invalidateAdminUsersCache();

      return NextResponse.json({
        success: true,
        amount,
        balance: Number(userData.balance || 0) + amount,
      });
    }

    const password = String(body.password || "");

    if (!isStrongTemporaryPassword(password)) {
      return NextResponse.json(
        {
          error:
            "La contraseña debe tener entre 6 y 128 caracteres, con letras y numeros.",
        },
        { status: 400 }
      );
    }

    await adminAuth.updateUser(uid, { password });
    await adminAuth.revokeRefreshTokens(uid);
    await userRef.update({
      passwordUpdatedAt: adminFieldValue.serverTimestamp(),
      passwordUpdatedBy: owner.uid,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    const code =
      error &&
      typeof error === "object" &&
      "code" in error
        ? String((error as { code?: unknown }).code)
        : "";

    if (code === "auth/user-not-found") {
      return NextResponse.json(
        { error: "Usuario no encontrado en Firebase Auth" },
        { status: 404 }
      );
    }

    if (error instanceof Error && error.message === "USER_NOT_FOUND") {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "admin-users-delete",
      limit: 20,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: 8 * 1024,
    });

    const owner = await requireOwner(request);
    const { uid } = await params;
    const body = (await request.json().catch(() => ({}))) as {
      confirmText?: string;
    };

    if (!uid) {
      return NextResponse.json(
        { error: "Usuario requerido" },
        { status: 400 }
      );
    }

    if (uid === owner.uid) {
      return NextResponse.json(
        { error: "No puedes eliminar la cuenta administradora" },
        { status: 400 }
      );
    }

    if (body.confirmText !== "ELIMINAR") {
      return NextResponse.json(
        { error: "Confirmacion invalida" },
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

    const userData = userSnap.data() || {};
    const email = typeof userData.email === "string" ? userData.email : "";

    if (owner.email && email.toLowerCase() === owner.email.toLowerCase()) {
      return NextResponse.json(
        { error: "No puedes eliminar la cuenta administradora" },
        { status: 400 }
      );
    }

    const bunnyPaths = collectBunnyPaths(uid, userData);

    if (bunnyPaths.length > 0 && !BUNNY_API_KEY) {
      return NextResponse.json(
        { error: "BUNNY_API_KEY no esta configurada" },
        { status: 500 }
      );
    }

    for (const path of bunnyPaths) {
      await deleteBunnyPath(path);
    }

    await deleteUserRecords(uid);
    await userRef.delete();
    invalidateAdminUsersCache();

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
      deletedUserId: uid,
      deletedFiles: bunnyPaths.length,
    });
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
          { error: "No pudimos eliminar archivos del usuario en Bunny" },
          { status: 500 }
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
