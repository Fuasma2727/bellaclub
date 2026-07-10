import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { verifyPrivateMediaToken } from "@/lib/privateMediaAccess";

export const runtime = "nodejs";

type MediaItem = {
  id?: string;
  url?: string;
  private?: boolean;
};

type PurchasedItem = {
  sellerId?: string;
  mediaId?: string;
};

const privateMediaResponseHeaders = [
  "accept-ranges",
  "content-length",
  "content-range",
  "content-type",
  "etag",
  "last-modified",
];

const buildPrivateMediaHeaders = (upstream: Response) => {
  const headers = new Headers({
    "Cache-Control": "private, no-store, max-age=0",
    "Content-Type":
      upstream.headers.get("content-type") || "application/octet-stream",
  });

  privateMediaResponseHeaders.forEach((name) => {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  });

  if (!headers.has("Accept-Ranges")) {
    headers.set("Accept-Ranges", "bytes");
  }

  return headers;
};

const getPrivateMediaTargetUrl = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const buyerId = searchParams.get("buyerId") || "";
  const sellerId = searchParams.get("sellerId") || "";
  const mediaId = searchParams.get("mediaId") || "";
  const expiresAt = Number(searchParams.get("expiresAt") || 0);
  const signature = searchParams.get("signature") || "";

  if (!buyerId || !sellerId || !mediaId || !expiresAt || !signature) {
    return NextResponse.json({ error: "Link invalido" }, { status: 400 });
  }

  const validToken = verifyPrivateMediaToken({
    buyerId,
    sellerId,
    mediaId,
    expiresAt,
    signature,
  });

  if (!validToken) {
    return NextResponse.json(
      { error: "Link expirado o invalido" },
      { status: 401 }
    );
  }

  const [buyerSnap, sellerSnap] = await Promise.all([
    adminDb.collection("users").doc(buyerId).get(),
    adminDb.collection("users").doc(sellerId).get(),
  ]);

  if (!buyerSnap.exists || !sellerSnap.exists) {
    return NextResponse.json(
      { error: "Contenido no disponible" },
      { status: 404 }
    );
  }

  const buyerData = buyerSnap.data() || {};
  const sellerData = sellerSnap.data() || {};
  const purchasedContent = Array.isArray(buyerData.purchasedContent)
    ? (buyerData.purchasedContent as PurchasedItem[])
    : [];
  const hasPurchased = purchasedContent.some(
    (item) => item.sellerId === sellerId && item.mediaId === mediaId
  );

  if (!hasPurchased) {
    return NextResponse.json(
      { error: "Contenido no desbloqueado" },
      { status: 403 }
    );
  }

  const media = Array.isArray(sellerData.media)
    ? (sellerData.media as MediaItem[])
    : [];
  const target = media.find(
    (item, index) => (item.id || `legacy-${index}`) === mediaId
  );

  if (!target?.private || !target.url) {
    return NextResponse.json(
      { error: "Contenido no disponible" },
      { status: 404 }
    );
  }

  return target.url;
};

const proxyPrivateMedia = async (request: Request, method: "GET" | "HEAD") => {
  const targetUrl = await getPrivateMediaTargetUrl(request);

  if (typeof targetUrl !== "string") return targetUrl;

  const upstreamHeaders = new Headers();
  const range = request.headers.get("range");
  const ifRange = request.headers.get("if-range");

  if (range) upstreamHeaders.set("Range", range);
  if (ifRange) upstreamHeaders.set("If-Range", ifRange);

  const upstream = await fetch(targetUrl, {
    method,
    headers: upstreamHeaders,
    cache: "no-store",
  });

  if (!upstream.ok) {
    if (upstream.status === 416) {
      return new Response(null, {
        status: 416,
        headers: buildPrivateMediaHeaders(upstream),
      });
    }

    return NextResponse.json(
      { error: "No pudimos cargar el contenido" },
      { status: 502 }
    );
  }

  if (method === "GET" && !upstream.body) {
    return NextResponse.json(
      { error: "No pudimos cargar el contenido" },
      { status: 502 }
    );
  }

  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers: buildPrivateMediaHeaders(upstream),
  });
};

export async function GET(request: Request) {
  try {
    return await proxyPrivateMedia(request, "GET");
  } catch (error) {
    console.error("PRIVATE MEDIA ERROR:", error);
    return NextResponse.json(
      { error: "No pudimos cargar el contenido" },
      { status: 500 }
    );
  }
}

export async function HEAD(request: Request) {
  try {
    return await proxyPrivateMedia(request, "HEAD");
  } catch (error) {
    console.error("PRIVATE MEDIA HEAD ERROR:", error);
    return new Response(null, {
      status: 500,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  }
}
