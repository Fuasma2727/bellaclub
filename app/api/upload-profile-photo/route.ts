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
  isSupportedVideoFilename,
  validateVideoFileCompatibility,
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

const getMaxSizeBytes = (contentType: string) =>
  getMaxSizeMb(contentType) * 1024 * 1024;

const isPayloadTooLargeError = (error: unknown) =>
  error instanceof Error && error.message === "PAYLOAD_TOO_LARGE";

const sizeLimitStream = (
  stream: ReadableStream<Uint8Array>,
  maxBytes: number
) => {
  let totalBytes = 0;

  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        totalBytes += chunk.byteLength;

        if (totalBytes > maxBytes) {
          throw new Error("PAYLOAD_TOO_LARGE");
        }

        controller.enqueue(chunk);
      },
    })
  );
};

const validateVideoBeforeUpload = (
  body: ArrayBuffer,
  contentType: string,
  filename: string
) => {
  if (!contentType.startsWith("video/")) return null;

  const compatibility = validateVideoFileCompatibility(
    body,
    contentType,
    filename
  );

  if (compatibility.supported) return null;

  return NextResponse.json(
    { error: compatibility.message || "Video no compatible" },
    { status: 400 }
  );
};

const validateVideoUploadMetadata = (contentType: string, filename: string) => {
  if (!contentType.startsWith("video/")) return null;

  if (isSupportedVideoFilename(filename)) return null;

  return NextResponse.json(
    {
      error:
        "Video no compatible. Sube un archivo MP4 compatible (H.264/AAC), no MOV ni HEVC.",
    },
    { status: 400 }
  );
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
  const uploadInit: RequestInit & { duplex?: "half" } = {
    method: "PUT",
    headers,
    body,
  };

  if (contentLength && contentLength > 0) {
    headers["Content-Length"] = String(contentLength);
  }

  if (body instanceof ReadableStream) {
    uploadInit.duplex = "half";
  }

  let upload: Response;

  try {
    upload = await fetch(uploadUrl, uploadInit);
  } catch (error) {
    if (isPayloadTooLargeError(error)) {
      return NextResponse.json(
        { error: `El archivo supera el limite de ${getMaxSizeMb(contentType)} MB` },
        { status: 413 }
      );
    }

    console.error("Bunny upload request error:", {
      filename,
      contentType,
      bytes: contentLength || null,
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
      const maxSizeBytes = getMaxSizeBytes(contentType);

      if (!isSupportedUploadContentType(contentType)) {
        return NextResponse.json(
          {
            error: `Formato no permitido. Usa ${SUPPORTED_UPLOAD_FORMAT_LABEL}.`,
          },
          { status: 400 }
        );
      }

      if (fileSize && fileSize > maxSizeBytes) {
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

      const videoError = validateVideoUploadMetadata(contentType, filename);

      if (videoError) return videoError;

      return uploadToBunny({
        body: sizeLimitStream(request.body, maxSizeBytes),
        contentLength: fileSize || undefined,
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
    const maxSizeBytes = getMaxSizeBytes(contentType);

    if (file.size > maxSizeBytes) {
      return NextResponse.json(
        { error: `El archivo supera el limite de ${maxSize} MB` },
        { status: 400 }
      );
    }

    const body = await file.arrayBuffer();
    const videoError = validateVideoBeforeUpload(body, contentType, file.name);

    if (videoError) return videoError;

    return uploadToBunny({
      body: Buffer.from(body),
      contentLength: body.byteLength,
      contentType,
      filename: file.name,
      uid: decoded.uid,
    });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    if (isPayloadTooLargeError(error)) {
      return NextResponse.json(
        { error: "La solicitud supera el tamano permitido" },
        { status: 413 }
      );
    }

    const authError = authRouteError(error);

    if (authError.status !== 401 || authError.message !== "No autorizado") {
      return NextResponse.json(
        { error: authError.message },
        { status: authError.status }
      );
    }

    console.error("Upload error:", error);

    return NextResponse.json(
      {
        error:
          "No pudimos procesar el archivo en el servidor. Intenta con un video MP4 mas liviano o conviertelo a H.264/AAC.",
      },
      { status: 500 }
    );
  }
}
