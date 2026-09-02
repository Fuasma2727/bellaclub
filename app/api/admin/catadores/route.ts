import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { ownerAuthError, requireOwner } from "@/lib/ownerAuth";
import { getProviderProfilePath } from "@/lib/publicProviders";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

const PREMIUM_BALANCE_REQUIREMENT = 500000;

type PurchaseCandidate = {
  sellerId: string;
  mediaId: string;
  purchasedAtMs: number;
  order: number;
  totalAmount: number;
};

type PurchaseStats = {
  count: number;
  totalAmount: number;
  latest?: PurchaseCandidate;
};

type DepositStats = {
  count: number;
  totalAmount: number;
  latestAtMs: number;
};

const toIsoString = (value: unknown) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();

  const maybeTimestamp = value as { toDate?: () => Date };

  return maybeTimestamp.toDate?.().toISOString() || null;
};

const toMillis = (value: unknown) => {
  const iso = toIsoString(value);
  const millis = iso ? new Date(iso).getTime() : 0;

  return Number.isFinite(millis) ? millis : 0;
};

const getName = (data: FirebaseFirestore.DocumentData) =>
  String(
    data.name ||
      data.displayName ||
      data.fullName ||
      data.username ||
      data.email ||
      "Usuario sin nombre"
  );

const cleanMessage = (value: unknown) => {
  if (typeof value !== "string") return "";

  return value.trim().slice(0, 700);
};

const hasUnlockedPrivateContent = async (
  uid: string,
  data: FirebaseFirestore.DocumentData
) => {
  const purchasedContent = Array.isArray(data.purchasedContent)
    ? data.purchasedContent
    : [];

  if (
    purchasedContent.some(
      (item) => item && typeof item === "object" && item.sellerId && item.mediaId
    )
  ) {
    return true;
  }

  const purchaseSnap = await adminDb
    .collection("contentPurchases")
    .where("buyerId", "==", uid)
    .limit(1)
    .get();

  return !purchaseSnap.empty;
};

const getLevel = ({
  hasUnlockedContent,
  hasServiceDeposit,
  balance,
}: {
  hasUnlockedContent: boolean;
  hasServiceDeposit: boolean;
  balance: number;
}) => {
  let level = 1;

  if (hasUnlockedContent) level = 2;
  if (level >= 2 && hasServiceDeposit) level = 3;
  if (level >= 3 && balance >= PREMIUM_BALANCE_REQUIREMENT) level = 4;

  return level;
};

const addPurchaseCandidate = (
  stats: Map<string, PurchaseStats>,
  buyerId: string,
  purchase: PurchaseCandidate
) => {
  const current = stats.get(buyerId) || {
    count: 0,
    totalAmount: 0,
  };
  const latest = !current.latest
    ? purchase
    : purchase.purchasedAtMs > current.latest.purchasedAtMs ||
        (purchase.purchasedAtMs === current.latest.purchasedAtMs &&
          purchase.order > current.latest.order)
      ? purchase
      : current.latest;

  stats.set(buyerId, {
    count: current.count + 1,
    totalAmount: current.totalAmount + purchase.totalAmount,
    latest,
  });
};

export async function GET(request: Request) {
  try {
    await requireOwner(request);

    const query = new URL(request.url).searchParams
      .get("q")
      ?.trim()
      .toLowerCase();
    const [usersSnap, purchasesSnap, depositsSnap] = await Promise.all([
      adminDb
        .collection("users")
        .select(
          "name",
          "displayName",
          "fullName",
          "username",
          "email",
          "role",
          "photoUrl",
          "balance",
          "createdAt",
          "purchasedContent",
          "city",
          "whatsapp"
        )
        .get(),
      adminDb.collection("contentPurchases").get(),
      adminDb.collection("serviceDeposits").get(),
    ]);
    const usersById = new Map(
      usersSnap.docs.map((doc) => [doc.id, doc.data()])
    );
    const purchaseStats = new Map<string, PurchaseStats>();
    const depositStats = new Map<string, DepositStats>();

    purchasesSnap.docs.forEach((doc, index) => {
      const data = doc.data();
      const status = String(data.status || "completed");
      const buyerId = String(data.buyerId || "");
      const sellerId = String(data.sellerId || "");
      const mediaId = String(data.mediaId || "");

      if (status !== "completed" || !buyerId || !sellerId || !mediaId) return;

      addPurchaseCandidate(purchaseStats, buyerId, {
        sellerId,
        mediaId,
        purchasedAtMs: toMillis(data.createdAt),
        order: index,
        totalAmount: Number(data.totalAmount || 0),
      });
    });

    depositsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const buyerId = String(data.buyerId || "");

      if (!buyerId) return;

      const current = depositStats.get(buyerId) || {
        count: 0,
        totalAmount: 0,
        latestAtMs: 0,
      };
      const latestAtMs = toMillis(data.createdAt);

      depositStats.set(buyerId, {
        count: current.count + 1,
        totalAmount: current.totalAmount + Number(data.totalAmount || 0),
        latestAtMs: Math.max(current.latestAtMs, latestAtMs),
      });
    });

    usersSnap.docs.forEach((doc) => {
      const data = doc.data();

      if (data.role !== "cliente") return;

      const purchasedContent = Array.isArray(data.purchasedContent)
        ? data.purchasedContent
        : [];

      purchasedContent.forEach((item: unknown, index: number) => {
        if (!item || typeof item !== "object") return;

        const purchase = item as Record<string, unknown>;
        const sellerId = String(purchase.sellerId || "");
        const mediaId = String(purchase.mediaId || "");

        if (!sellerId || !mediaId) return;

        addPurchaseCandidate(purchaseStats, doc.id, {
          sellerId,
          mediaId,
          purchasedAtMs: toMillis(purchase.purchasedAt),
          order: purchasesSnap.size + index,
          totalAmount: Number(purchase.totalAmount || 0),
        });
      });
    });

    const catadores = usersSnap.docs
      .flatMap((doc) => {
        const data = doc.data();

        if (data.role !== "cliente") return [];

        const purchases = purchaseStats.get(doc.id);

        if (!purchases?.count) return [];

        const deposits = depositStats.get(doc.id);
        const balance = Number(data.balance || 0);
        const level = getLevel({
          hasUnlockedContent: true,
          hasServiceDeposit: Boolean(deposits?.count),
          balance,
        });
        const latestProviderData = purchases.latest?.sellerId
          ? usersById.get(purchases.latest.sellerId)
          : null;
        const latestUnlockedProvider =
          purchases.latest?.sellerId && latestProviderData
            ? {
                id: purchases.latest.sellerId,
                name: getName(latestProviderData),
                profilePath:
                  latestProviderData.role === "prestador"
                    ? getProviderProfilePath({
                        id: purchases.latest.sellerId,
                        name: latestProviderData.name || "",
                        city: latestProviderData.city || "",
                        whatsapp: latestProviderData.whatsapp || "",
                      })
                    : "",
                mediaId: purchases.latest.mediaId,
              }
            : null;

        return [
          {
            id: doc.id,
            name: getName(data),
            email: String(data.email || ""),
            photoUrl: String(data.photoUrl || ""),
            whatsapp: String(data.whatsapp || ""),
            level,
            maxLevel: 4,
            balance,
            unlockedContentCount: purchases.count,
            unlockedContentTotal: purchases.totalAmount,
            serviceDepositCount: deposits?.count || 0,
            serviceDepositTotal: deposits?.totalAmount || 0,
            isCatadorPremium: level >= 4,
            latestUnlockedAt: purchases.latest?.purchasedAtMs
              ? new Date(purchases.latest.purchasedAtMs).toISOString()
              : null,
            latestServiceDepositAt: deposits?.latestAtMs
              ? new Date(deposits.latestAtMs).toISOString()
              : null,
            latestUnlockedProvider,
            createdAt: toIsoString(data.createdAt),
          },
        ];
      })
      .filter((catador) => {
        if (!query) return true;

        const haystack = [
          catador.name,
          catador.email,
          catador.whatsapp,
          catador.id,
          catador.latestUnlockedProvider?.name,
          catador.latestUnlockedProvider?.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) => {
        if (b.level !== a.level) return b.level - a.level;

        return String(b.latestUnlockedAt || "").localeCompare(
          String(a.latestUnlockedAt || "")
        );
      });

    return NextResponse.json({ catadores });
  } catch (error) {
    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}

export async function POST(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "admin-catador-message",
      limit: 40,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: 8 * 1024,
    });

    const owner = await requireOwner(request);
    const { targetUserId, message } = (await request.json()) as {
      targetUserId?: string;
      message?: string;
    };
    const uid = typeof targetUserId === "string" ? targetUserId.trim() : "";
    const cleanText = cleanMessage(message);

    if (!uid || !cleanText) {
      return NextResponse.json(
        { error: "Selecciona un catador y escribe un mensaje" },
        { status: 400 }
      );
    }

    if (cleanText.length < 12) {
      return NextResponse.json(
        { error: "El mensaje es demasiado corto" },
        { status: 400 }
      );
    }

    const userSnap = await adminDb.collection("users").doc(uid).get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Catador no encontrado" },
        { status: 404 }
      );
    }

    const userData = userSnap.data() || {};

    if (userData.role !== "cliente") {
      return NextResponse.json(
        { error: "Solo puedes escribir a usuarios catadores" },
        { status: 400 }
      );
    }

    if (!(await hasUnlockedPrivateContent(uid, userData))) {
      return NextResponse.json(
        { error: "Este usuario todavia no llego a catador" },
        { status: 400 }
      );
    }

    const notificationRef = adminDb.collection("notifications").doc();
    const contactMessageRef = adminDb.collection("adminContactMessages").doc();
    const createdAt = adminFieldValue.serverTimestamp();
    const payload = {
      userId: uid,
      type: "admin_catador_invitation",
      title: "Fuiste seleccionado",
      message: cleanText,
      actionLabel: "Completar mi WhatsApp",
      actionUrl: "/usuario/perfil",
      fromUserId: owner.uid,
      read: false,
      createdAt,
    };
    const batch = adminDb.batch();

    batch.set(notificationRef, payload);
    batch.set(contactMessageRef, {
      ...payload,
      targetUserId: uid,
      notificationId: notificationRef.id,
      sentBy: owner.uid,
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      notificationId: notificationRef.id,
    });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    const authError = ownerAuthError(error);

    return NextResponse.json(
      { error: authError.message },
      { status: authError.status }
    );
  }
}
