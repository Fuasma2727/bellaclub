import { execFile } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, rmdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { finished, pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "@derhuerst/ffprobe-static";
import { withTimeout } from "@/lib/asyncTimeout";
import { putUserFileInBunny } from "@/lib/bunnyStorage";
import {
  DAILY_VIDEO_MAX_SECONDS,
  DAILY_VIDEO_MAX_UPLOAD_BYTES,
  DAILY_VIDEO_MAX_UPLOAD_MB,
} from "@/lib/providerDailyVideo";

const runFile = promisify(execFile);
const activePreparations = new Set<Promise<number>>();
const maxPixels = 8192 * 4320;
const inputOptions = ["-max_alloc", String(256 * 1024 * 1024), "-protocol_whitelist", "file"];
const invalidVideo = "No pudimos leer este video. Selecciona otro archivo o vuelve a exportarlo.";

type VideoStream = {
  index: number;
  codec_type?: string;
  codec_name?: string;
  profile?: string;
  pix_fmt?: string;
  color_transfer?: string;
  avg_frame_rate?: string;
  level?: number;
  width?: number;
  height?: number;
  channels?: number;
  disposition?: { attached_pic?: number };
};

export class DailyVideoUploadError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function runMediaTool(executable: string, args: string[], signal: AbortSignal, timeout: number) {
  try {
    return await runFile(executable, args, { signal, timeout, windowsHide: true, maxBuffer: 1024 * 1024 });
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { killed?: boolean };
    if (signal.aborted || failure.code === "ENOENT" || failure.code === "EACCES") throw error;
    if (failure.killed) {
      throw new DailyVideoUploadError("Preparar el video tardó demasiado. Intenta con una versión más liviana.", 422);
    }
    throw new DailyVideoUploadError(invalidVideo, 422);
  }
}

async function probeVideo(file: string, demuxer: string, signal: AbortSignal) {
  if (!ffprobePath) throw new Error("Daily video probe unavailable");
  const { stdout } = await runMediaTool(ffprobePath, [
    "-v", "error", ...inputOptions, "-f", demuxer,
    "-show_entries", "format=duration:stream=index,codec_type,codec_name,profile,pix_fmt,color_transfer,avg_frame_rate,level,width,height,channels:stream_disposition=attached_pic",
    "-of", "json", file,
  ], signal, 6_000);
  const data = JSON.parse(stdout) as { streams?: VideoStream[]; format?: { duration?: string } };
  const video = data.streams?.find((stream) => stream.codec_type === "video" && !stream.disposition?.attached_pic);
  if (!video?.width || !video.height) throw new DailyVideoUploadError(invalidVideo, 422);

  return {
    video: { ...video, width: video.width, height: video.height },
    audio: data.streams?.find((stream) => stream.codec_type === "audio"),
    duration: Number(data.format?.duration),
  };
}

function checkDuration(duration: number) {
  if (duration > DAILY_VIDEO_MAX_SECONDS) {
    throw new DailyVideoUploadError(`El video del día debe durar máximo ${DAILY_VIDEO_MAX_SECONDS} segundos.`, 400);
  }
}

async function preparePlaybackFile(source: string, output: string, demuxer: string, signal: AbortSignal) {
  if (!ffmpegPath) throw new Error("Daily video processor unavailable");
  const { video, audio, duration } = await probeVideo(source, demuxer, signal);
  checkDuration(duration);
  if (video.width * video.height > maxPixels) {
    throw new DailyVideoUploadError("La resolución del video es demasiado alta. Intenta con una versión en 1080p.", 422);
  }

  const [frames, seconds] = (video.avg_frame_rate || "").split("/").map(Number);
  const frameRate = frames / seconds;
  const hdr = video.color_transfer === "arib-std-b67" || video.color_transfer === "smpte2084";
  const canCopyVideo = video.codec_name === "h264" && video.pix_fmt === "yuv420p" && !hdr &&
    Math.max(video.width, video.height) <= 1920 && frameRate <= 60 &&
    (video.level ?? 0) <= 42;
  const canCopyAudio = audio?.codec_name === "aac" && audio.profile === "LC" && (audio.channels ?? 0) <= 2;
  const filters = ["scale=w='min(1280,iw)':h='min(1280,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2"];
  if (hdr) {
    filters.push("zscale=transfer=linear:npl=100", "format=gbrpf32le", "zscale=primaries=bt709",
      "tonemap=tonemap=hable", "zscale=transfer=bt709:matrix=bt709:range=limited");
  }

  await runMediaTool(ffmpegPath, [
    "-hide_banner", "-loglevel", "error", "-nostdin", "-xerror",
    ...inputOptions, "-max_pixels", String(maxPixels), "-threads", "2", "-filter_threads", "2",
    "-f", demuxer, "-i", source,
    "-map", `0:${video.index}`, ...(audio ? ["-map", `0:${audio.index}`] : []),
    "-map_metadata", "-1", "-map_metadata:s", "-1", "-map_chapters", "-1",
    // Leave enough output to detect overlong clips when the source has no duration metadata.
    "-t", String(DAILY_VIDEO_MAX_SECONDS + 1),
    ...(canCopyVideo ? ["-c:v", "copy"] : [
      "-c:v", "libx264", "-threads:v", "2", "-preset", "veryfast", "-crf", "23",
      "-maxrate", "5M", "-bufsize", "10M", "-pix_fmt", "yuv420p", "-fpsmax", "30", "-vf", filters.join(","),
    ]),
    ...(audio ? (canCopyAudio ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "128k", "-ac", "2"]) : []),
    "-movflags", "+faststart", "-f", "mp4", output,
  ], signal, 40_000);

  const playable = await probeVideo(output, "mov", signal);
  checkDuration(playable.duration);
  if (!Number.isFinite(playable.duration) || playable.duration <= 0) {
    throw new DailyVideoUploadError(invalidVideo, 422);
  }

  return Math.ceil(playable.duration);
}

export async function storeDailyVideo(request: Request, uid: string, demuxer: string) {
  if (!request.body) throw new DailyVideoUploadError("No se recibió ningún video.", 400);
  const directory = await mkdtemp(join(tmpdir(), "belaclub-daily-video-"));
  const source = join(directory, "input");
  const output = join(directory, "output.mp4");
  let bytes = 0;

  try {
    const boundedBody = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > DAILY_VIDEO_MAX_UPLOAD_BYTES) {
          throw new DailyVideoUploadError(`El video supera el límite de ${DAILY_VIDEO_MAX_UPLOAD_MB} MB.`, 413);
        }
        controller.enqueue(chunk);
      },
    }));
    await pipeline(Readable.fromWeb(boundedBody as NodeReadableStream<Uint8Array>),
      createWriteStream(source), { signal: request.signal });
    if (!bytes) throw new DailyVideoUploadError("No se recibió ningún video.", 400);

    if (activePreparations.size >= 2) {
      await withTimeout(Promise.race(activePreparations), 5_000, "Daily video processor")
        .catch(() => undefined);
    }
    request.signal.throwIfAborted();
    if (activePreparations.size >= 2) {
      throw new DailyVideoUploadError("El servidor está preparando otros videos. Intenta subir el tuyo en unos segundos.", 503);
    }
    const preparation = preparePlaybackFile(source, output, demuxer, request.signal);
    activePreparations.add(preparation);
    const duration = await preparation.finally(() => { activePreparations.delete(preparation); });
    const { size } = await stat(output);
    const stream = createReadStream(output);
    const closed = finished(stream, { cleanup: true }).catch(() => undefined);
    try {
      const { response, url } = await putUserFileInBunny({
        body: Readable.toWeb(stream) as ReadableStream<Uint8Array>,
        contentLength: size,
        contentType: "video/mp4",
        extension: "mp4",
        uid,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
      });
      await response.body?.cancel();
      if (!response.ok) throw new Error(`Bunny upload failed with status ${response.status}`);
      return { url, duration };
    } catch (error) {
      console.error("Daily video storage error:", error);
      throw new DailyVideoUploadError("No pudimos guardar el video. Intenta subirlo de nuevo en unos minutos.", 502);
    } finally {
      stream.destroy();
      await closed;
    }
  } finally {
    await Promise.all([rm(source, { force: true }), rm(output, { force: true })]);
    await rmdir(directory);
  }
}
