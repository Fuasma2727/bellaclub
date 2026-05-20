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

export async function GET(request: Request) {
  try {
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

    const upstream = await fetch(target.url, { cache: "no-store" });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: "No pudimos cargar el contenido" },
        { status: 502 }
      );
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type":
          upstream.headers.get("content-type") || "application/octet-stream",
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("PRIVATE MEDIA ERROR:", error);
    return NextResponse.json(
      { error: "No pudimos cargar el contenido" },
      { status: 500 }
    );
  }
}
