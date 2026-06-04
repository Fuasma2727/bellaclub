import { NextResponse } from "next/server";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";

export const runtime = "nodejs";

const BUNNY_STORAGE_ZONE =
  process.env.BUNNY_STORAGE_ZONE || "pp-profile-photos";
const BUNNY_STORAGE_HOST =
  process.env.BUNNY_STORAGE_HOST || "ny.storage.bunnycdn.com";
const BUNNY_CDN_HOST =
  process.env.BUNNY_CDN_HOST || "pp-profile-photos-cdn.b-cdn.net";
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;

const allowedTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

const getHost = (value: string) => {
  return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
};

const getSafeFilename = (file: File) => {
  const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${Date.now()}-${random}.${extension}`;
};

export async function POST(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "upload-profile-photo",
      limit: 30,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: 90 * 1024 * 1024,
    });

    const decoded = await requireAuthenticatedUser(request);

    if (!BUNNY_API_KEY) {
      return NextResponse.json(
        { error: "BUNNY_API_KEY no está configurada" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se recibió ningún archivo" },
        { status: 400 }
      );
    }

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa imagen o video compatible." },
        { status: 400 }
      );
    }

    const maxSize = file.type.startsWith("video") ? 80 : 12;

    if (file.size > maxSize * 1024 * 1024) {
      return NextResponse.json(
        { error: `El archivo supera el límite de ${maxSize} MB` },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = getSafeFilename(file);
    const storageHost = getHost(BUNNY_STORAGE_HOST);
    const cdnHost = getHost(BUNNY_CDN_HOST);
    const safeUid = decoded.uid.replace(/[^a-zA-Z0-9_-]/g, "");
    const uploadPath = `users/${safeUid}/${filename}`;
    const uploadUrl = `https://${storageHost}/${BUNNY_STORAGE_ZONE}/${uploadPath}`;

    const upload = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        AccessKey: BUNNY_API_KEY,
        "Content-Type": file.type || "application/octet-stream",
        "Content-Length": buffer.length.toString(),
      },
      body: buffer,
    });

    if (!upload.ok) {
      const errorText = await upload.text();
      console.error("Bunny upload error:", upload.status, errorText);

      return NextResponse.json(
        {
          error: "No pudimos subir el archivo",
          details: errorText || `Bunny respondió con estado ${upload.status}`,
        },
        { status: 500 }
      );
    }

    const publicUrl = `https://${cdnHost}/${uploadPath}`;

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    const authError = authRouteError(error);

    if (authError.status !== 401 || authError.message !== "No autorizado") {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("Upload error:", error);

    return NextResponse.json(
      { error: "Error inesperado al subir el archivo" },
      { status: 500 }
    );
  }
}
