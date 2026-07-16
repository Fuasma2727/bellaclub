import { NextResponse } from "next/server";
import { authRouteError, requireAuthenticatedUser } from "@/lib/serverAuth";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";
import {
  SUPPORTED_UPLOAD_FORMAT_LABEL,
  inferUploadContentType,
  isSupportedUploadContentType,
} from "@/lib/mediaCompatibility";

export const runtime = "nodejs";

const BUNNY_STORAGE_ZONE =
  process.env.BUNNY_STORAGE_ZONE || "pp-profile-photos";
const BUNNY_STORAGE_HOST =
  process.env.BUNNY_STORAGE_HOST || "ny.storage.bunnycdn.com";
const BUNNY_CDN_HOST =
  process.env.BUNNY_CDN_HOST || "pp-profile-photos-cdn.b-cdn.net";
const BUNNY_API_KEY = process.env.BUNNY_API_KEY;

const getHost = (value: string) => {
  return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
};

const getSafeFilename = (filename: string) => {
  const extension = filename.split(".").pop()?.toLowerCase() || "bin";
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return `${Date.now()}-${random}.${extension}`;
};

const getMaxSizeMb = (contentType: string) => {
  return contentType.startsWith("video") ? 150 : 12;
};

const uploadToBunny = async ({
  body,
  contentType,
  filename,
  uid,
}: {
  body: ArrayBuffer;
  contentType: string;
  filename: string;
  uid: string;
}) => {
  const storageHost = getHost(BUNNY_STORAGE_HOST);
  const cdnHost = getHost(BUNNY_CDN_HOST);
  const safeUid = uid.replace(/[^a-zA-Z0-9_-]/g, "");
  const uploadPath = `users/${safeUid}/${getSafeFilename(filename)}`;
  const uploadUrl = `https://${storageHost}/${BUNNY_STORAGE_ZONE}/${uploadPath}`;
  const headers: Record<string, string> = {
    AccessKey: BUNNY_API_KEY || "",
    "Content-Type": contentType || "application/octet-stream",
  };
  const uploadBody = Buffer.from(body);

  let upload: Response;

  try {
    upload = await fetch(uploadUrl, {
      method: "PUT",
      headers,
      body: uploadBody,
    });
  } catch (error) {
    console.error("Bunny upload request error:", {
      filename,
      contentType,
      bytes: uploadBody.byteLength,
      error,
    });

    return NextResponse.json(
      {
        error: "No pudimos subir el archivo",
        details:
          "La conexion con el almacenamiento fallo. Intenta de nuevo en unos minutos.",
      },
      { status: 502 }
    );
  }

  if (!upload.ok) {
    const errorText = await upload.text();
    console.error("Bunny upload error:", upload.status, errorText);

    return NextResponse.json(
      {
        error: "No pudimos subir el archivo",
        details: errorText || `Bunny respondio con estado ${upload.status}`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: `https://${cdnHost}/${uploadPath}` });
};

export async function POST(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "upload-profile-photo",
      limit: 30,
      windowMs: 10 * 60 * 1000,
      maxBodyBytes: 170 * 1024 * 1024,
    });

    const decoded = await requireAuthenticatedUser(request);

    if (!BUNNY_API_KEY) {
      return NextResponse.json(
        { error: "BUNNY_API_KEY no esta configurada" },
        { status: 500 }
      );
    }

    const requestContentType = request.headers.get("content-type") || "";

    if (!requestContentType.startsWith("multipart/form-data")) {
      const filename =
        decodeURIComponent(request.headers.get("x-file-name") || "") ||
        "upload.bin";
      const contentType = inferUploadContentType(
        request.headers.get("x-file-type") || requestContentType,
        filename
      );
      const declaredSize = Number(request.headers.get("x-file-size") || 0);
      const contentLength = Number(request.headers.get("content-length") || 0);
      const fileSize = declaredSize || contentLength;
      const maxSize = getMaxSizeMb(contentType);

      if (!isSupportedUploadContentType(contentType)) {
        return NextResponse.json(
          {
            error: `Formato no permitido. Usa ${SUPPORTED_UPLOAD_FORMAT_LABEL}.`,
          },
          { status: 400 }
        );
      }

      if (fileSize && fileSize > maxSize * 1024 * 1024) {
        return NextResponse.json(
          { error: `El archivo supera el limite de ${maxSize} MB` },
          { status: 400 }
        );
      }

      if (!request.body) {
        return NextResponse.json(
          { error: "No se recibio ningun archivo" },
          { status: 400 }
        );
      }

      const body = await request.arrayBuffer();

      if (!body.byteLength) {
        return NextResponse.json(
          { error: "No se recibio ningun archivo" },
          { status: 400 }
        );
      }

      if (body.byteLength > maxSize * 1024 * 1024) {
        return NextResponse.json(
          { error: `El archivo supera el limite de ${maxSize} MB` },
          { status: 400 }
        );
      }

      return uploadToBunny({
        body,
        contentType,
        filename,
        uid: decoded.uid,
      });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No se recibio ningun archivo" },
        { status: 400 }
      );
    }

    const contentType = inferUploadContentType(file.type, file.name);

    if (!isSupportedUploadContentType(contentType)) {
      return NextResponse.json(
        {
          error: `Formato no permitido. Usa ${SUPPORTED_UPLOAD_FORMAT_LABEL}.`,
        },
        { status: 400 }
      );
    }

    const maxSize = getMaxSizeMb(contentType);

    if (file.size > maxSize * 1024 * 1024) {
      return NextResponse.json(
        { error: `El archivo supera el limite de ${maxSize} MB` },
        { status: 400 }
      );
    }

    return uploadToBunny({
      body: await file.arrayBuffer(),
      contentType,
      filename: file.name,
      uid: decoded.uid,
    });
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
