import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import {
  countProviderVideos,
  getProviderVideoLimit,
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

      const currentVideoCount = countProviderVideos(media);
      const videoLimit = getProviderVideoLimit(user.videoSlotsExtra);

      if (body.item.type === "video" && currentVideoCount >= videoLimit) {
        throw new Error("VIDEO_LIMIT_REACHED");
      }

      const updated = [
        ...media,
        {
          id: body.item.id,
          type: body.item.type,
          url: body.item.url,
          private: Boolean(body.item.private),
          price: body.item.private ? Number(body.item.price || 0) : null,
          description: body.item.private
            ? String(body.item.description || "").trim()
            : "",
        },
      ];

      tx.update(userRef, {
        media: updated,
        mediaUpdatedAt: adminFieldValue.serverTimestamp(),
      });

      return { media: updated, videoLimit };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, { message: string; status: number }> = {
        USER_NOT_FOUND: { message: "Usuario no encontrado", status: 404 },
        NOT_PROVIDER: { message: "Solo prestadores pueden subir contenido", status: 403 },
        MEDIA_REQUIRED: { message: "Contenido requerido", status: 400 },
        INVALID_MEDIA: { message: "Contenido invalido", status: 400 },
        VIDEO_LIMIT_REACHED: {
          message:
            "Llegaste al limite de videos incluidos. Compra un cupo extra para subir mas videos.",
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
