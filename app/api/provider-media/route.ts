import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";
import {
  getProviderVideoSecondsLimit,
  isAllowedPrivateContentPrice,
  ProviderMediaItem,
} from "@/lib/providerMediaLimits";
import { invalidatePublicProviderCache } from "@/lib/publicProviders";

export const runtime = "nodejs";

type AddMediaBody = {
  action?: "add";
  item?: ProviderMediaItem;
};

type AddManyMediaBody = {
  action?: "addMany";
  items?: ProviderMediaItem[];
};

type DeleteMediaBody = {
  action?: "delete";
  mediaId?: string;
};

const MAX_BATCH_MEDIA = 20;

const isValidMediaItem = (item: unknown): item is ProviderMediaItem => {
  if (!item || typeof item !== "object") return false;

  const media = item as Record<string, unknown>;

  return (
    typeof media.id === "string" &&
    (media.type === "photo" || media.type === "video") &&
    typeof media.url === "string" &&
    media.url.startsWith("https://")
  );
};

const preparePhoto = (item: ProviderMediaItem) => {
  if (item.type !== "photo") throw new Error("VIDEO_UPLOAD_REQUIRED");

  const price = Number(item.price || 0);
  if (item.private && !isAllowedPrivateContentPrice(price)) {
    throw new Error("INVALID_PRIVATE_PRICE");
  }

  return {
    id: item.id,
    type: item.type,
    url: item.url,
    private: Boolean(item.private),
    price: item.private ? price : null,
    duration: null,
    playbackStatus: null,
    description: item.private ? String(item.description || "").trim() : "",
  };
};

export async function POST(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "provider-media",
      limit: 80,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: 128 * 1024,
    });

    const decoded = await requireAuthenticatedUser(request);
    const body = (await request.json()) as
      | AddMediaBody
      | AddManyMediaBody
      | DeleteMediaBody;
    const userRef = adminDb.collection("users").doc(decoded.uid);

    const result = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);

      if (!snap.exists) {
        throw new Error("USER_NOT_FOUND");
      }

      const user = snap.data() || {};

      if (user.role !== "prestador") {
        throw new Error("NOT_PROVIDER");
      }

      const media = Array.isArray(user.media)
        ? (user.media as ProviderMediaItem[])
        : [];

      if (body.action === "delete") {
        if (!body.mediaId) throw new Error("MEDIA_REQUIRED");

        const updated = media.filter(
          (item, index) => (item.id || `legacy-${index}`) !== body.mediaId
        );

        tx.update(userRef, {
          media: updated,
          mediaUpdatedAt: adminFieldValue.serverTimestamp(),
          profileUpdatedAt: adminFieldValue.serverTimestamp(),
        });

        return { media: updated };
      }

      const videoSecondsLimit = getProviderVideoSecondsLimit(
        user.videoSecondsExtra
      );

      if (body.action === "addMany") {
        const items = Array.isArray(body.items) ? body.items : [];

        if (
          items.length === 0 ||
          items.length > MAX_BATCH_MEDIA ||
          !items.every(isValidMediaItem)
        ) {
          throw new Error("INVALID_MEDIA");
        }

        const updated = [...media, ...items.map(preparePhoto)];

        tx.update(userRef, {
          media: updated,
          mediaUpdatedAt: adminFieldValue.serverTimestamp(),
          profileUpdatedAt: adminFieldValue.serverTimestamp(),
        });

        return { media: updated, videoSecondsLimit };
      }

      if (body.action !== "add" || !isValidMediaItem(body.item)) {
        throw new Error("INVALID_MEDIA");
      }

      const updated = [...media, preparePhoto(body.item)];

      tx.update(userRef, {
        media: updated,
        mediaUpdatedAt: adminFieldValue.serverTimestamp(),
        profileUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      return { media: updated, videoSecondsLimit };
    });

    invalidatePublicProviderCache();

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    if (error instanceof Error) {
      const messages: Record<string, { message: string; status: number }> = {
        USER_NOT_FOUND: { message: "Usuario no encontrado", status: 404 },
        NOT_PROVIDER: { message: "Solo las escorts pueden subir contenido", status: 403 },
        MEDIA_REQUIRED: { message: "Contenido requerido", status: 400 },
        INVALID_MEDIA: { message: "Contenido invalido", status: 400 },
        INVALID_PRIVATE_PRICE: {
          message: "Precio privado invalido",
          status: 400,
        },
        VIDEO_UPLOAD_REQUIRED: {
          message: "Actualiza la página y vuelve a subir el video para que podamos prepararlo.",
          status: 415,
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

    console.error("PROVIDER MEDIA ERROR:", error);
    return NextResponse.json(
      { error: "No pudimos actualizar la galeria" },
      { status: 500 }
    );
  }
}
