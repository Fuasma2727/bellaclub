import { NextResponse } from "next/server";
import { adminDb, adminFieldValue } from "@/lib/firebaseAdmin";
import {
  guardMutationRequest,
  securityErrorResponse,
} from "@/lib/requestSecurity";
import {
  isSupportedVideoUrl,
  validateVideoFileCompatibility,
} from "@/lib/mediaCompatibility";

export const runtime = "nodejs";

type PlaybackFailureBody = {
  providerId?: string;
  mediaId?: string;
  kind?: "dailyVideo" | "media";
};

type MediaItem = {
  id?: string;
  type?: "photo" | "video";
  url?: string;
  private?: boolean;
  playbackStatus?: "ready" | "failed" | null;
};

const VIDEO_PROBE_BYTES = 4 * 1024 * 1024 - 1;

const getFilenameFromUrl = (url: string) => {
  try {
    return new URL(url).pathname.split("/").pop() || "video.mp4";
  } catch {
    return "video.mp4";
  }
};

const isConfirmedUnsupportedVideo = async (url: string) => {
  if (!isSupportedVideoUrl(url)) return true;

  const response = await fetch(url, {
    headers: {
      Range: `bytes=0-${VIDEO_PROBE_BYTES}`,
    },
    cache: "no-store",
  });

  if (!response.ok && response.status !== 206) return false;

  const responseContentType = response.headers.get("content-type") || "";
  const contentType = responseContentType.startsWith("video/")
    ? responseContentType
    : "video/mp4";
  const bytes = await response.arrayBuffer();
  const compatibility = validateVideoFileCompatibility(
    bytes,
    contentType,
    getFilenameFromUrl(url)
  );

  return (
    !compatibility.supported &&
    (compatibility.videoCodecs.length > 0 ||
      compatibility.message?.includes("no parece ser un MP4"))
  );
};

export async function POST(request: Request) {
  try {
    guardMutationRequest(request, {
      rateLimitKey: "media-playback-failure",
      limit: 20,
      windowMs: 60 * 1000,
      maxBodyBytes: 4 * 1024,
    });

    const body = (await request.json()) as PlaybackFailureBody;
    const providerId = String(body.providerId || "").trim();
    const mediaId = String(body.mediaId || "").trim();
    const kind = body.kind;

    if (!providerId || (kind !== "dailyVideo" && kind !== "media")) {
      return NextResponse.json({ hidden: false }, { status: 400 });
    }

    const providerRef = adminDb.collection("users").doc(providerId);
    const providerSnap = await providerRef.get();

    if (!providerSnap.exists) {
      return NextResponse.json({ hidden: false }, { status: 404 });
    }

    const data = providerSnap.data() || {};

    if (kind === "dailyVideo") {
      const dailyVideo = data.dailyVideo as
        | { url?: string; playbackStatus?: string | null }
        | undefined;

      if (!dailyVideo?.url) {
        return NextResponse.json({ hidden: false }, { status: 404 });
      }

      if (dailyVideo.playbackStatus === "failed") {
        return NextResponse.json({ hidden: true });
      }

      if (!(await isConfirmedUnsupportedVideo(dailyVideo.url))) {
        return NextResponse.json({ hidden: false });
      }

      await providerRef.update({
        "dailyVideo.playbackStatus": "failed",
        dailyVideoPlaybackFailedAt: adminFieldValue.serverTimestamp(),
      });

      return NextResponse.json({ hidden: true });
    }

    const media = Array.isArray(data.media) ? (data.media as MediaItem[]) : [];
    const mediaIndex = media.findIndex(
      (item, index) => (item.id || `legacy-${index}`) === mediaId
    );
    const target = mediaIndex >= 0 ? media[mediaIndex] : null;

    if (!target?.url || target.type !== "video") {
      return NextResponse.json({ hidden: false }, { status: 404 });
    }

    if (target.playbackStatus === "failed") {
      return NextResponse.json({ hidden: true });
    }

    if (!(await isConfirmedUnsupportedVideo(target.url))) {
      return NextResponse.json({ hidden: false });
    }

    const updated = media.map((item, index) =>
      index === mediaIndex ? { ...item, playbackStatus: "failed" } : item
    );

    await providerRef.update({
      media: updated,
      mediaUpdatedAt: adminFieldValue.serverTimestamp(),
      mediaPlaybackFailedAt: adminFieldValue.serverTimestamp(),
    });

    return NextResponse.json({ hidden: true });
  } catch (error) {
    const securityError = securityErrorResponse(error);
    if (securityError) return securityError;

    console.error("MEDIA PLAYBACK FAILURE ERROR:", error);
    return NextResponse.json({ hidden: false }, { status: 500 });
  }
}
