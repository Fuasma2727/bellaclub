import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser, requireUserDocument } from "@/lib/serverAuth";
import { hasBunnyStorageCredentials } from "@/lib/bunnyStorage";
import { VideoUploadError, storeCompatibleVideo } from "@/lib/videoUpload";
import { setLedgerEntry } from "@/lib/ledger";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";
import {
  DAILY_VIDEO_DURATION_HOURS,
  DAILY_VIDEO_FORMAT_LABEL,
  DAILY_VIDEO_MAX_UPLOAD_BYTES,
  DAILY_VIDEO_MAX_UPLOAD_MB,
  DAILY_VIDEO_MAX_SECONDS,
  DAILY_VIDEO_REWARD_AMOUNT,
  canReceiveDailyVideoReward,
  getDailyVideoDemuxer,
  getDailyVideoRewardDateKey,
} from "@/lib/providerDailyVideo";
import { isProviderSubscriptionPubliclyActive } from "@/lib/providerSubscription";
import { invalidatePublicProviderCache } from "@/lib/publicProviders";

export const runtime = "nodejs";

const assertDailyVideoProfile = (user: FirebaseFirestore.DocumentData) => {
  if (user.role !== "prestador") throw new Error("NOT_PROVIDER");
  if (
    user.verificationStatus !== "approved" ||
    user.profileVisible !== true ||
    user.blocked === true ||
    !isProviderSubscriptionPubliclyActive(user)
  ) {
    throw new Error("PROFILE_NOT_AVAILABLE");
  }
};

export async function POST(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "provider-daily-video",
      limit: 20,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: DAILY_VIDEO_MAX_UPLOAD_BYTES,
    });

    const decoded = await requireAuthenticatedUser(request);
    const demuxer = getDailyVideoDemuxer(request.headers.get("x-video-format") || "");
    if (!demuxer || request.headers.get("content-type") !== "application/octet-stream") {
      return NextResponse.json(
        { error: `Selecciona un archivo de video en formato ${DAILY_VIDEO_FORMAT_LABEL}.` },
        { status: 415 }
      );
    }

    const { ref: userRef, data: userProfile } = await requireUserDocument(decoded.uid);
    assertDailyVideoProfile(userProfile);
    if (!hasBunnyStorageCredentials()) throw new Error("Bunny storage is not configured");

    const { url: videoUrl, duration } = await storeCompatibleVideo(request, decoded.uid, demuxer, {
      maxSeconds: DAILY_VIDEO_MAX_SECONDS,
      durationError: new VideoUploadError(`El video del día debe durar máximo ${DAILY_VIDEO_MAX_SECONDS} segundos.`, 400),
      conversionTimeoutMs: 40_000,
    });
    const expiresAt = new Date(
      Date.now() + DAILY_VIDEO_DURATION_HOURS * 60 * 60 * 1000
    );
    const rewardDate = getDailyVideoRewardDateKey();
    const rewardRef = adminDb
      .collection("dailyVideoRewards")
      .doc(`${decoded.uid}_${rewardDate}`);

    const result = await adminDb.runTransaction(async (tx) => {
      const [userSnap, rewardSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(rewardRef),
      ]);

      if (!userSnap.exists) throw new Error("USER_NOT_FOUND");

      const user = userSnap.data() || {};

      assertDailyVideoProfile(user);

      const rewardEligible = canReceiveDailyVideoReward(user);
      const rewardGranted = rewardEligible && !rewardSnap.exists;
      const userUpdate: Record<string, unknown> = {
        dailyVideo: {
          url: videoUrl,
          duration,
          playbackStatus: "ready",
          createdAt: adminFieldValue.serverTimestamp(),
          expiresAt,
        },
        dailyVideoUpdatedAt: adminFieldValue.serverTimestamp(),
      };

      if (rewardGranted) {
        userUpdate.balance = adminFieldValue.increment(
          DAILY_VIDEO_REWARD_AMOUNT
        );
        userUpdate.dailyVideoRewardDate = rewardDate;
        userUpdate.dailyVideoRewardedAt = adminFieldValue.serverTimestamp();

        tx.set(rewardRef, {
          providerId: decoded.uid,
          amount: DAILY_VIDEO_REWARD_AMOUNT,
          rewardDate,
          videoUrl,
          duration,
          status: "completed",
          createdAt: adminFieldValue.serverTimestamp(),
        });

        setLedgerEntry(tx, {
          userId: decoded.uid,
          type: "daily_video_reward",
          direction: "credit",
          amount: DAILY_VIDEO_REWARD_AMOUNT,
          status: "completed",
          sourceCollection: "dailyVideoRewards",
          sourceId: rewardRef.id,
          metadata: { rewardDate, duration },
        });

        tx.set(adminDb.collection("notifications").doc(), {
          userId: decoded.uid,
          type: "daily_video_reward",
          title: "Bono por video del dia",
          message: `Recibiste $${DAILY_VIDEO_REWARD_AMOUNT.toLocaleString(
            "es-CO"
          )} por publicar tu primer video del dia.`,
          amount: DAILY_VIDEO_REWARD_AMOUNT,
          read: false,
          createdAt: adminFieldValue.serverTimestamp(),
        });
      }

      tx.set(userRef, userUpdate, { merge: true });

      return { rewardEligible, rewardGranted };
    });

    invalidatePublicProviderCache();

    return NextResponse.json({
      success: true,
      dailyVideo: {
        url: videoUrl,
        duration,
        playbackStatus: "ready",
        expiresAt: expiresAt.toISOString(),
      },
      rewardAmount: DAILY_VIDEO_REWARD_AMOUNT,
      rewardDate,
      rewardEligible: result.rewardEligible,
      rewardGranted: result.rewardGranted,
    });
  } catch (error) {
    if (error instanceof VideoUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") {
      return NextResponse.json(
        { error: `El video supera el límite de ${DAILY_VIDEO_MAX_UPLOAD_MB} MB.` },
        { status: 413 }
      );
    }
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    if (error instanceof Error) {
      const messages: Record<string, { message: string; status: number }> = {
        USER_NOT_FOUND: { message: "Usuario no encontrado", status: 404 },
        NOT_PROVIDER: {
          message: "Solo las escorts pueden subir video del dia",
          status: 403,
        },
        PROFILE_NOT_AVAILABLE: {
          message:
            "Tu perfil debe estar aprobado, visible y al dia para publicar video del dia.",
          status: 403,
        },
      };

      if (messages[error.message]) {
        return NextResponse.json(
          { error: messages[error.message].message },
          { status: messages[error.message].status }
        );
      }
    }

    const authError = authRouteError(error);

    if (authError.status !== 401 || authError.message !== "No autorizado") {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("DAILY VIDEO ERROR:", error);
    return NextResponse.json(
      { error: "No pudimos guardar el video del dia" },
      { status: 500 }
    );
  }
}
