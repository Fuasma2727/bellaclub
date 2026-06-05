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
  "video/x-m4v",
  "video/3gpp",
  "video/3gpp2",
];

const contentTypeByExtension: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  qt: "video/quicktime",
  m4v: "video/x-m4v",
  "3gp": "video/3gpp",
  "3gpp": "video/3gpp",
  "3g2": "video/3gpp2",
};

const getHost = (value: string) => {
  return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
};

const normalizeContentType = (value: string) => {
  return value.split(";")[0]?.trim().toLowerCase() || "";
};

const inferContentType = (contentType: string, filename: string) => {
  const normalized = normalizeContentType(contentType);
  const extension = filename.split(".").pop()?.toLowerCase();
  const extensionType = extension ? contentTypeByExtension[extension] || "" : "";

  return allowedTypes.includes(normalized) ? normalized : extensionType || normalized;
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
  return contentType.startsWith("video") ? 80 : 12;
};

const uploadToBunny = async ({
  body,
  contentLength,
  contentType,
  filename,
  uid,
}: {
  body: BodyInit;
  contentLength?: number;
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

  if (contentLength) {
    headers["Content-Length"] = contentLength.toString();
  }

  const upload = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

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
      maxBodyBytes: 90 * 1024 * 1024,
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
      const contentType = inferContentType(
        request.headers.get("x-file-type") || requestContentType,
        filename
      );
      const declaredSize = Number(request.headers.get("x-file-size") || 0);
      const contentLength = Number(request.headers.get("content-length") || 0);
      const fileSize = declaredSize || contentLength;
      const maxSize = getMaxSizeMb(contentType);

      if (!allowedTypes.includes(contentType)) {
        return NextResponse.json(
          { error: "Formato no permitido. Usa imagen o video compatible." },
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

      return uploadToBunny({
        body: request.body,
        contentLength,
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

    const contentType = inferContentType(file.type, file.name);

    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        { error: "Formato no permitido. Usa imagen o video compatible." },
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
      body: file.stream(),
      contentLength: file.size,
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
