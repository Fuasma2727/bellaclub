import { NextResponse } from "next/server";
import { getMediaPreview, MediaPreviewNotFoundError } from "@/lib/mediaPreview";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("providerId") || "";
  const mediaId = searchParams.get("mediaId") || "";
  if (![providerId, mediaId].every((id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id))) {
    return new Response(null, { status: 400 });
  }

  const rateLimit = checkRateLimit(`media-preview:${getClientIp(request)}`, {
    limit: 180,
    windowMs: 60_000,
  });
  if (!rateLimit.allowed) {
    return new Response(null, { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } });
  }

  try {
    const preview = await getMediaPreview(providerId, mediaId);
    return new Response(new Uint8Array(preview), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof MediaPreviewNotFoundError) {
      return new Response(null, { status: 404 });
    }
    console.error("Media preview generation failed:", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Vista previa no disponible" }, {
      status: 503,
      headers: { "Cache-Control": "no-store", "Retry-After": "5" },
    });
  }
}
