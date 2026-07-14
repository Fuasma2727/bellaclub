import { NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

type GuardOptions = {
  rateLimitKey: string;
  limit: number;
  windowMs: number;
  maxBodyBytes?: number;
};

const getAllowedOrigins = (request: Request) => {
  const requestOrigin = new URL(request.url).origin;
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL;
  const vercelUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "";

  return new Set(
    [
      requestOrigin,
      configuredUrl,
      vercelUrl,
      process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "",
    ]
      .filter(Boolean)
      .map((origin) => origin!.replace(/\/$/, ""))
  );
};

export const assertSameOrigin = (request: Request) => {
  const origin = request.headers.get("origin");

  if (!origin) return;

  const cleanOrigin = origin.replace(/\/$/, "");
  const allowedOrigins = getAllowedOrigins(request);

  if (!allowedOrigins.has(cleanOrigin)) {
    throw new Error("INVALID_ORIGIN");
  }
};

export const assertBodySize = (request: Request, maxBodyBytes?: number) => {
  if (!maxBodyBytes) return;

  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength && contentLength > maxBodyBytes) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
};

export const guardMutationRequest = (
  request: Request,
  options: GuardOptions
) => {
  assertSameOrigin(request);
  assertBodySize(request, options.maxBodyBytes);

  const rateLimit = checkRateLimit(
    `${options.rateLimitKey}:${getClientIp(request)}`,
    {
      limit: options.limit,
      windowMs: options.windowMs,
    }
  );

  if (!rateLimit.allowed) {
    throw new Error("RATE_LIMITED");
  }
};

export const securityErrorResponse = (error: unknown) => {
  if (!(error instanceof Error)) return null;

  if (error.message === "INVALID_ORIGIN") {
    return NextResponse.json(
      { error: "Origen no permitido" },
      { status: 403 }
    );
  }

  if (error.message === "PAYLOAD_TOO_LARGE") {
    return NextResponse.json(
      { error: "La solicitud supera el tamaño permitido" },
      { status: 413 }
    );
  }

  if (error.message === "RATE_LIMITED") {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." },
      { status: 429 }
    );
  }

  return null;
};
