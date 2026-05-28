import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";

export const runtime = "nodejs";

const DAILY_VIDEO_DURATION_HOURS = 4;
const DAILY_VIDEO_MAX_SECONDS = 30;

type DailyVideoBody = {
  url?: string;
  duration?: number;
};

const isValidVideoUrl = (url: unknown) => {
  return typeof url === "string" && url.startsWith("https://");
};

export async function POST(request: Request) {
  try {
    const decoded = await requireAuthenticatedUser(request);
    const body = (await request.json()) as DailyVideoBody;

    if (!isValidVideoUrl(body.url)) {
      return NextResponse.json(
        { error: "Video invalido. Vuelve a subir el archivo." },
        { status: 400 }
      );
    }

    const duration = Math.ceil(Number(body.duration || 0));

    if (!duration || duration <= 0) {
      return NextResponse.json(
        { error: "No pudimos leer la duracion del video." },
        { status: 400 }
      );
    }

    if (duration > DAILY_VIDEO_MAX_SECONDS) {
      return NextResponse.json(
        {
          error: `El video del dia debe durar maximo ${DAILY_VIDEO_MAX_SECONDS} segundos.`,
        },
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
        { error: "Solo las escorts pueden subir video del dia" },
        { status: 403 }
      );
    }

    if (
      user.verificationStatus !== "approved" ||
      user.profileVisible !== true ||
      user.blocked === true
    ) {
      return NextResponse.json(
        {
          error:
            "Tu perfil debe estar aprobado y visible para publicar video del dia.",
        },
        { status: 403 }
      );
    }

    const expiresAt = new Date(
      Date.now() + DAILY_VIDEO_DURATION_HOURS * 60 * 60 * 1000
    );

    await userRef.set(
      {
        dailyVideo: {
          url: body.url,
          duration,
          createdAt: adminFieldValue.serverTimestamp(),
          expiresAt,
        },
        dailyVideoUpdatedAt: adminFieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      dailyVideo: {
        url: body.url,
        duration,
        expiresAt: expiresAt.toISOString(),
      },
    });
  } catch (error) {
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
