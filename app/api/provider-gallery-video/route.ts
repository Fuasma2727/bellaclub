import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { hasBunnyStorageCredentials } from "@/lib/bunnyStorage";
import {
  getProviderVideoSecondsLimit,
  getProviderVideoSecondsUsed,
  isAllowedPrivateContentPrice,
  type ProviderMediaItem,
} from "@/lib/providerMediaLimits";
import { invalidatePublicProviderCache } from "@/lib/publicProviders";
import { guardMutationRequest, securityErrorResponse } from "@/lib/requestSecurity";
import { authRouteError, requireAuthenticatedUser, requireUserDocument } from "@/lib/serverAuth";
import { VideoUploadError, storeCompatibleVideo } from "@/lib/videoUpload";
import {
  VIDEO_INPUT_FORMAT_LABEL,
  VIDEO_UPLOAD_MAX_BYTES,
  getVideoInputDemuxer,
} from "@/lib/videoUploadFormats";

export const runtime = "nodejs";

const quotaError = new VideoUploadError(
  "Este video supera el tiempo disponible en tu galería. Compra tiempo extra o selecciona un video más corto.",
  402
);

function getUploadDetails(request: Request) {
  const invalid = new VideoUploadError("Los datos de la subida no son válidos.", 400);
  let details: unknown;
  try {
    details = JSON.parse(decodeURIComponent(request.headers.get("x-gallery-video") || ""));
  } catch {
    throw invalid;
  }
  if (!details || typeof details !== "object") throw invalid;

  const { id, replacesUrl, private: isPrivate, price, description } = details as Record<string, unknown>;
  if (typeof id !== "string" || !/^[\w-]{1,120}$/.test(id)) throw invalid;
  if (typeof replacesUrl === "string" && replacesUrl) {
    return { id, replacesUrl, private: false, price: null, description: "" };
  }
  if (replacesUrl !== undefined || typeof isPrivate !== "boolean") throw invalid;
  if (isPrivate && (typeof price !== "number" || !isAllowedPrivateContentPrice(price))) {
    throw new VideoUploadError("Ingresa un precio válido para el contenido privado.", 400);
  }
  const cleanDescription = isPrivate && typeof description === "string" ? description.trim() : "";
  if (isPrivate && (!cleanDescription || cleanDescription.length > 80)) {
    throw new VideoUploadError("Agrega una descripción de hasta 80 caracteres al video privado.", 400);
  }
  return {
    id,
    replacesUrl: undefined,
    private: isPrivate,
    price: isPrivate ? Number(price) : null,
    description: cleanDescription,
  };
}

function getGalleryState(profile: FirebaseFirestore.DocumentData, details: ReturnType<typeof getUploadDetails>) {
  if (profile.role !== "prestador") {
    throw new VideoUploadError("Solo los prestadores pueden publicar videos en su galería.", 403);
  }

  const media: ProviderMediaItem[] = Array.isArray(profile.media) ? profile.media : [];
  const index = media.findIndex((item, position) => (item.id || `legacy-${position}`) === details.id);
  const existing = media[index];
  if (details.replacesUrl && (existing?.type !== "video" || existing.url !== details.replacesUrl)) {
    throw new VideoUploadError("El video cambió o ya no existe. Actualiza tu galería e inténtalo de nuevo.", 409);
  }
  if (!details.replacesUrl && existing && (existing.type !== "video" || !existing.id)) {
    throw new VideoUploadError("El identificador ya está en uso. Selecciona el video de nuevo.", 409);
  }

  const others = details.replacesUrl ? media.filter((_, position) => position !== index) : media;
  const seconds = Math.floor(getProviderVideoSecondsLimit(profile.videoSecondsExtra) - getProviderVideoSecondsUsed(others));
  return { media, index, existing, availableSeconds: Number.isFinite(seconds) ? Math.max(0, seconds) : 0 };
}

function getErrorResult(error: unknown) {
  if (error instanceof VideoUploadError) return { status: error.status, error: error.message };
  const auth = authRouteError(error);
  if (auth.status !== 401 || auth.message !== "No autorizado") {
    return { status: auth.status, error: auth.message };
  }
  console.error("Gallery video upload error:", error);
  return { status: 500, error: "No pudimos preparar el video de la galería. Intenta de nuevo." };
}

function streamUploadResult(request: Request, upload: (signal: AbortSignal) => Promise<unknown>) {
  const connection = new AbortController();
  const signal = AbortSignal.any([connection.signal, request.signal]);
  const encoder = new TextEncoder();
  const heartbeat = encoder.encode("\n");
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Keep the proxy connection open while FFmpeg prepares longer gallery videos.
      controller.enqueue(heartbeat);
      const keepAlive = setInterval(() => {
        if (!signal.aborted) controller.enqueue(heartbeat);
      }, 10_000);
      void upload(signal).catch(getErrorResult).then((result) => {
        if (connection.signal.aborted) return;
        if (!signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(result)));
        controller.close();
      }).finally(() => clearInterval(keepAlive));
    },
    cancel() {
      connection.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "provider-gallery-video",
      limit: 30,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: VIDEO_UPLOAD_MAX_BYTES,
    });

    const decoded = await requireAuthenticatedUser(request);
    const demuxer = getVideoInputDemuxer(request.headers.get("x-video-format") || "");
    if (!demuxer || request.headers.get("content-type") !== "application/octet-stream") {
      throw new VideoUploadError(`Selecciona un video en formato ${VIDEO_INPUT_FORMAT_LABEL}.`, 415);
    }
    const details = getUploadDetails(request);
    const { ref, data } = await requireUserDocument(decoded.uid);
    const initial = getGalleryState(data, details);
    if (!details.replacesUrl && initial.existing) return Response.json({ media: initial.media });
    if (!initial.availableSeconds) throw quotaError;
    if (!hasBunnyStorageCredentials()) throw new Error("Bunny storage is not configured");

    return streamUploadResult(request, async (signal) => {
      const stored = await storeCompatibleVideo({ body: request.body, signal }, decoded.uid, demuxer, {
        maxSeconds: initial.availableSeconds,
        durationError: quotaError,
        conversionTimeoutMs: 150_000,
      });
      const discard = () => stored.discard().catch((error) => {
        console.error("Could not remove unpublished gallery video:", error);
      });

      try {
        signal.throwIfAborted();
        const result = await adminDb.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (!snap.exists) throw new VideoUploadError("Usuario no encontrado.", 404);

          const { media, index, existing, availableSeconds } = getGalleryState(snap.data() || {}, details);
          if (!details.replacesUrl && existing) return { media, saved: false };
          if (stored.duration > availableSeconds) throw quotaError;

          const item = {
            ...(details.replacesUrl ? existing : {
              private: details.private,
              price: details.price,
              description: details.description,
            }),
            id: details.id,
            type: "video" as const,
            url: stored.url,
            duration: stored.duration,
            playbackStatus: "ready" as const,
          };
          const updated = details.replacesUrl
            ? media.map((entry, position) => {
                if (position === index) return item;
                // Preserve IDs used in older purchases when gallery positions change.
                return entry.id ? entry : { ...entry, id: `legacy-${position}` };
              })
            : [...media, item];

          tx.update(ref, {
            media: updated,
            mediaUpdatedAt: adminFieldValue.serverTimestamp(),
            profileUpdatedAt: adminFieldValue.serverTimestamp(),
          });
          return { media: updated, saved: true };
        });

        if (result.saved) invalidatePublicProviderCache();
        else await discard();
        return { media: result.media };
      } catch (error) {
        // Delete staged files only when the transaction is known not to have published them.
        if (error instanceof VideoUploadError || error === signal.reason) await discard();
        throw error;
      }
    });
  } catch (error) {
    const security = securityErrorResponse(error);
    if (security) return security;
    const { status, error: message } = getErrorResult(error);
    return Response.json({ error: message }, { status });
  }
}
