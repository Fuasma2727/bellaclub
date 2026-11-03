import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, open, readFile, rename, rm, rmdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { withTimeout } from "@/lib/asyncTimeout";
import { adminDb } from "@/lib/firebaseAdmin";
import { isProviderSubscriptionPubliclyActive } from "@/lib/providerSubscription";

const runFile = promisify(execFile);
const cacheDirectory = path.join(process.cwd(), ".runtime-cache", "media-previews-v1");
const providerCache = new Map<string, {
  expiresAt: number;
  pending: Promise<FirebaseFirestore.DocumentData | undefined>;
}>();
const pendingPreviews = new Map<string, Promise<Buffer>>();
const generationQueue: (() => void)[] = [];
let activeGenerations = 0;

export class MediaPreviewNotFoundError extends Error {}

const readProvider = (providerId: string) => {
  const cached = providerCache.get(providerId);
  if (cached && cached.expiresAt > Date.now()) return cached.pending;

  if (providerCache.size >= 128) {
    providerCache.delete(providerCache.keys().next().value!);
  }

  const pending = withTimeout(
    adminDb.collection("users").doc(providerId).get(),
    4500,
    "Media preview provider query"
  ).then((snapshot) => snapshot.data()).catch((error) => {
    providerCache.delete(providerId);
    throw error;
  });
  providerCache.set(providerId, { expiresAt: Date.now() + 60_000, pending });
  return pending;
};

export const isAllowedPreviewSource = (source: string, providerId: string) => {
  try {
    const url = new URL(source);
    const configuredHost = new URL(
      `https://${(process.env.BUNNY_CDN_HOST || "pp-profile-photos-cdn.b-cdn.net").replace(/^https?:\/\//, "")}`
    ).hostname;
    return url.protocol === "https:" &&
      url.hostname === configuredHost && !url.port && !url.username && !url.password &&
      url.pathname.startsWith(`/users/${providerId}/`);
  } catch {
    return false;
  }
};

// The delivered file is already small and blurred; removing CSS cannot reveal it.
export const blurMediaPreview = (source: Buffer | string) =>
  sharp(source, { limitInputPixels: 40_000_000, animated: false })
    .rotate()
    .resize({ width: 96, height: 96, fit: "inside", withoutEnlargement: true })
    .blur(4)
    .jpeg({ quality: 50 })
    .toBuffer();

const downloadSource = async (url: string, destination: string, maxBytes: number) => {
  const upstream = await fetch(url, {
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!upstream.ok || !upstream.body) throw new Error("Preview source unavailable");
  if (Number(upstream.headers.get("content-length") || 0) > maxBytes) {
    await upstream.body.cancel();
    throw new Error("Preview source too large");
  }

  const file = await open(destination, "w");
  const reader = upstream.body.getReader();
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error("Preview source too large");
      await file.writeFile(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
    await file.close();
  }
};

const generatePreview = async (sourceUrl: string, video: boolean) => {
  if (activeGenerations >= 2) {
    await new Promise<void>((resolve) => generationQueue.push(resolve));
  } else {
    activeGenerations += 1;
  }

  let temporaryDirectory: string | undefined;
  try {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "belaclub-preview-"));
    const sourceFile = path.join(temporaryDirectory, "source");
    await downloadSource(sourceUrl, sourceFile, (video ? 150 : 12) * 1024 * 1024);
    if (!video) return await blurMediaPreview(await readFile(sourceFile));
    if (!ffmpegPath) throw new Error("Video preview processor unavailable");

    const { stdout } = await runFile(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-threads", "1",
      "-protocol_whitelist", "file,pipe", "-f", "mov", "-i", sourceFile,
      "-frames:v", "1", "-an", "-vf", "scale=320:320:force_original_aspect_ratio=decrease",
      "-f", "image2pipe", "-vcodec", "mjpeg", "pipe:1",
    ], { encoding: "buffer", timeout: 15_000, maxBuffer: 2 * 1024 * 1024, windowsHide: true });
    return await blurMediaPreview(stdout);
  } finally {
    try {
      if (temporaryDirectory) {
        await rm(path.join(temporaryDirectory, "source"), { force: true });
        await rmdir(temporaryDirectory);
      }
    } finally {
      const next = generationQueue.shift();
      if (next) next();
      else activeGenerations -= 1;
    }
  }
};

export async function getMediaPreview(providerId: string, mediaId: string) {
  const provider = await readProvider(providerId);
  if (!provider || provider.role !== "prestador" || provider.profileVisible !== true ||
    provider.verificationStatus !== "approved" || !provider.photoUrl ||
    provider.blocked === true || !isProviderSubscriptionPubliclyActive(provider)) {
    throw new MediaPreviewNotFoundError();
  }

  const media = Array.isArray(provider.media) ? provider.media : [];
  const item = media.find((candidate, index) => (candidate.id || `legacy-${index}`) === mediaId);
  if (!item?.private || !item.url || item.playbackStatus === "failed" ||
    !isAllowedPreviewSource(item.url, providerId)) {
    throw new MediaPreviewNotFoundError();
  }

  const key = createHash("sha256").update(`${providerId}:${mediaId}:${item.url}`).digest("hex");
  const cacheFile = path.join(cacheDirectory, `${key}.jpg`);
  const inFlight = pendingPreviews.get(key);
  if (inFlight) return inFlight;
  try {
    return await readFile(cacheFile);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const existing = pendingPreviews.get(key);
  if (existing) return existing;

  const pending = generatePreview(item.url, item.type === "video")
    .then(async (preview) => {
      await mkdir(cacheDirectory, { recursive: true });
      const temporaryFile = `${cacheFile}.${process.pid}.tmp`;
      await writeFile(temporaryFile, preview);
      await rename(temporaryFile, cacheFile);
      return preview;
    })
    .finally(() => { pendingPreviews.delete(key); });
  pendingPreviews.set(key, pending);
  return pending;
}
