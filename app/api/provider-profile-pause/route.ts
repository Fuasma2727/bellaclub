import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { processProviderSubscription } from "@/lib/providerSubscription";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

const MAX_MONTHLY_PAUSES = 6;

const getMonthKey = () => {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}`;
};

export async function POST(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "provider-profile-pause",
      limit: 20,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: 4 * 1024,
    });

    const decoded = await requireAuthenticatedUser(request);
    const { paused } = (await request.json()) as { paused?: boolean };

    if (typeof paused !== "boolean") {
      return NextResponse.json(
        { error: "Estado de pausa invalido" },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 404 }
      );
    }

    const user = userSnap.data() || {};

    if (user.role !== "prestador") {
      return NextResponse.json(
        { error: "Solo las escorts pueden pausar su perfil" },
        { status: 403 }
      );
    }

    if (paused) {
      let monthlyPauseCount = 0;
      const monthKey = getMonthKey();

      await adminDb.runTransaction(async (tx) => {
        const freshSnap = await tx.get(userRef);
        const freshUser = freshSnap.data() || {};
        const currentMonthKey = String(freshUser.pauseMonthKey || "");
        const currentCount =
          currentMonthKey === monthKey
            ? Number(freshUser.pauseCountThisMonth || 0)
            : 0;

        if (freshUser.profilePaused === true) {
          monthlyPauseCount = currentCount;
          return;
        }

        if (currentCount >= MAX_MONTHLY_PAUSES) {
          throw new Error("MONTHLY_PAUSE_LIMIT");
        }

        monthlyPauseCount = currentCount + 1;

        tx.update(userRef, {
          profilePaused: true,
          profileVisible: false,
          subscriptionManualOverride: true,
          subscriptionStatus: "paused",
          pauseMonthKey: monthKey,
          pauseCountThisMonth: monthlyPauseCount,
          pausedAt: adminFieldValue.serverTimestamp(),
          pauseUpdatedAt: adminFieldValue.serverTimestamp(),
        });

        tx.set(adminDb.collection("notifications").doc(), {
          userId: decoded.uid,
          type: "provider_profile_paused",
          title: "Perfil pausado",
          message:
            "Tu perfil fue pausado. No aparecera publicamente y la mensualidad queda detenida hasta que lo reactives.",
          read: false,
          createdAt: adminFieldValue.serverTimestamp(),
        });
      });

      return NextResponse.json({
        success: true,
        paused: true,
        pauseCountThisMonth: monthlyPauseCount,
        maxMonthlyPauses: MAX_MONTHLY_PAUSES,
      });
    }

    await userRef.update({
      profilePaused: false,
      profileVisible:
        user.verificationStatus === "approved" && Boolean(user.photoUrl),
      subscriptionManualOverride: false,
      subscriptionStatus: "pending_payment",
      subscriptionNextChargeAt: adminFieldValue.serverTimestamp(),
      pauseUpdatedAt: adminFieldValue.serverTimestamp(),
      resumedAt: adminFieldValue.serverTimestamp(),
    });

    const subscriptionResult = await processProviderSubscription(decoded.uid);

    await adminDb.collection("notifications").doc().set({
      userId: decoded.uid,
      type: "provider_profile_resumed",
      title: "Perfil reactivado",
      message:
        subscriptionResult === "blocked"
          ? "Tu perfil fue reactivado, pero quedo bloqueado por mensualidad pendiente. Recarga saldo para publicarlo."
          : "Tu perfil fue reactivado y la mensualidad vuelve a estar activa.",
      subscriptionResult,
      read: false,
      createdAt: adminFieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      paused: false,
      subscriptionResult,
    });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    if (error instanceof Error && error.message === "MONTHLY_PAUSE_LIMIT") {
      return NextResponse.json(
        {
          error:
            "Ya usaste las 6 pausas disponibles este mes. Podras volver a pausar el proximo mes.",
        },
        { status: 400 }
      );
    }

    const authError = authRouteError(error);

    if (authError.status !== 401 || authError.message !== "No autorizado") {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("PROVIDER PROFILE PAUSE ERROR:", error);

    return NextResponse.json(
      { error: "No pudimos actualizar la pausa del perfil" },
      { status: 500 }
    );
  }
}
