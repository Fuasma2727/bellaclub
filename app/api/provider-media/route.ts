import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import {
  getProviderVideoSecondsLimit,
  getProviderVideoSecondsUsed,
  ProviderMediaItem,
} from "@/lib/providerMediaLimits";

export const runtime = "nodejs";

type AddMediaBody = {
  action?: "add";
  item?: ProviderMediaItem;
};

type DeleteMediaBody = {
  action?: "delete";
  mediaId?: string;
};

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

export async function POST(request: Request) {
  try {
    const decoded = await requireAuthenticatedUser(request);
    const body = (await request.json()) as AddMediaBody | DeleteMediaBody;
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
        });

        return { media: updated };
      }

      if (body.action !== "add" || !isValidMediaItem(body.item)) {
        throw new Error("INVALID_MEDIA");
      }

      const videoSecondsUsed = getProviderVideoSecondsUsed(media);
      const videoSecondsLimit = getProviderVideoSecondsLimit(
        user.videoSecondsExtra
      );
      const incomingDuration = Math.ceil(Number(body.item.duration || 0));

      if (body.item.type === "video") {
        if (!incomingDuration || incomingDuration <= 0) {
          throw new Error("INVALID_VIDEO_DURATION");
        }

        if (videoSecondsUsed + incomingDuration > videoSecondsLimit) {
          throw new Error("VIDEO_TIME_LIMIT_REACHED");
        }
      }

      const updated = [
        ...media,
        {
          id: body.item.id,
          type: body.item.type,
          url: body.item.url,
          private: Boolean(body.item.private),
          price: body.item.private ? Number(body.item.price || 0) : null,
          duration: body.item.type === "video" ? incomingDuration : null,
          description: body.item.private
            ? String(body.item.description || "").trim()
            : "",
        },
      ];

      tx.update(userRef, {
        media: updated,
        mediaUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      return { media: updated, videoSecondsLimit };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, { message: string; status: number }> = {
        USER_NOT_FOUND: { message: "Usuario no encontrado", status: 404 },
        NOT_PROVIDER: { message: "Solo prestadores pueden subir contenido", status: 403 },
        MEDIA_REQUIRED: { message: "Contenido requerido", status: 400 },
        INVALID_MEDIA: { message: "Contenido invalido", status: 400 },
        INVALID_VIDEO_DURATION: {
          message: "No pudimos leer la duracion del video",
          status: 400,
        },
        VIDEO_TIME_LIMIT_REACHED: {
          message:
            "Este video supera el tiempo incluido. Compra tiempo extra para subirlo.",
          status: 402,
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
