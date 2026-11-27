import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import vm from "node:vm";
import ffmpeg from "ffmpeg-static";
import ffprobe from "@derhuerst/ffprobe-static";
import ts from "typescript";

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, "..");
const setup = ({ beforeTransaction = () => {} } = {}) => {
  const uploads = [];
  const writes = [];
  const discarded = [];
  let rewardExists = false;
  const profile = { role: "prestador", verificationStatus: "approved", profileVisible: true };
  const userRef = { id: "provider-1" };
  const mocks = {
    "@/lib/firebaseAdmin": {
      adminDb: {
        collection: (name) => ({ doc: (id) => ({ id, collection: name }) }),
        async runTransaction(callback) {
          beforeTransaction(profile);
          return callback({
            get: async (ref) => ref.id === userRef.id
              ? { exists: true, data: () => profile }
              : { exists: rewardExists },
            set(ref, data) {
              if (ref.collection === "dailyVideoRewards") rewardExists = true;
              writes.push({ ref, data });
            },
            update(ref, data) {
              Object.assign(profile, data);
              writes.push({ ref, data });
            },
          });
        },
      },
      adminFieldValue: { serverTimestamp: () => new Date(), increment: (amount) => amount },
    },
    "@/lib/serverAuth": {
      requireAuthenticatedUser: async () => ({ uid: userRef.id }),
      requireUserDocument: async () => ({ ref: userRef, data: profile }),
      authRouteError: () => ({ status: 401, message: "No autorizado" }),
    },
    "@/lib/ledger": { setLedgerEntry() {} },
    "@/lib/providerPromotion": { getVerificationRank: () => 1 },
    "@/lib/providerSubscription": { isProviderSubscriptionPubliclyActive: () => true },
    "@/lib/publicProviders": { invalidatePublicProviderCache() {} },
    "@/lib/rateLimit": { getClientIp: () => "test", checkRateLimit: () => ({ allowed: true }) },
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
  };
  const context = vm.createContext({
    URL, Response, ReadableStream, TransformStream, AbortController, AbortSignal, TextEncoder, setInterval, clearInterval,
    process: { env: { BUNNY_API_KEY: "test", BUNNY_CDN_HOST: "cdn.test" } },
    fetch: async (url, init) => {
      assert.match(url, /\/users\/provider-1\/[^/]+\.mp4$/);
      if (init.method === "DELETE") {
        discarded.push(url);
        return new Response(null, { status: 204 });
      }
      assert.equal(init.method, "PUT");
      assert.equal(init.headers["Content-Type"], "video/mp4");
      assert.equal(init.duplex, "half");
      const body = Buffer.from(await new Response(init.body).arrayBuffer());
      assert.equal(body.length, Number(init.headers["Content-Length"]));
      uploads.push(body);
      return new Response(null, { status: 201 });
    },
  });
  const modules = new Map();
  const load = (file) => {
    if (modules.has(file)) return modules.get(file).exports;
    const loadedModule = { exports: {} };
    modules.set(file, loadedModule);
    const { outputText } = ts.transpileModule(readFileSync(join(root, file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    });
    const localRequire = (id) => mocks[id] || (id.startsWith("@/") ? load(`${id.slice(2)}.ts`) : require(id));
    vm.runInContext(`(function(require, module, exports) { ${outputText}\n})`, context)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  };

  return {
    route: load("app/api/provider-daily-video/route.ts"),
    gallery: load("app/api/provider-gallery-video/route.ts"),
    mediaRoute: load("app/api/provider-media/route.ts"),
    uploads, writes, discarded, profile,
  };
};

const uploadRequest = (format, body, headers = {}) => new Request("https://belaclub.test/api/provider-daily-video", {
  method: "POST",
  headers: { "Content-Type": "application/octet-stream", "x-video-format": format, ...headers },
  body,
});

const galleryUploadRequest = (format, body, details, headers = {}) => new Request("https://belaclub.test/api/provider-gallery-video", {
  method: "POST",
  headers: {
    "Content-Type": "application/octet-stream",
    "x-video-format": format,
    "x-gallery-video": encodeURIComponent(JSON.stringify(details)),
    ...headers,
  },
  body,
});

const options = { timeout: 20_000, windowsHide: true };
const makeVideo = async (directory, filename, encoding, duration = "2", audio = false) => {
  const path = join(directory, filename);
  await run(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=160x96:rate=12",
    ...(audio ? ["-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000"] : []),
    "-t", duration, ...encoding, path,
  ], options);
  return readFile(path);
};

const testDirectory = async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "belaclub-daily-video-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
};

test("daily video uploads publish browser-ready MP4s and credit the bonus only once", async (t) => {
  const app = setup();
  const directory = await testDirectory(t);
  const fixtures = [
    ["mp4", ["-c:v", "libx264", "-preset", "ultrafast"]],
    ["mov", ["-c:v", "libx265", "-x265-params", "pools=1:frame-threads=1:log-level=error",
      "-pix_fmt", "yuv420p10le", "-color_primaries", "bt2020", "-colorspace", "bt2020nc", "-color_trc", "arib-std-b67"]],
    ["webm", ["-c:v", "libvpx-vp9", "-live", "1"]],
    ["mkv", ["-c:v", "libvpx-vp9"]],
    ["avi", ["-c:v", "mpeg4"]],
    ["m4v", ["-c:v", "libx264", "-f", "mp4"]],
    ["3gp", ["-c:v", "mpeg4"]],
  ];
  for (const [index, [format, encoding]] of fixtures.entries()) {
    const input = await makeVideo(directory, `input.${format}`, encoding);
    const response = await app.route.POST(uploadRequest(format, input));
    const data = await response.json();
    assert.equal(response.status, 200, `${format}: ${JSON.stringify(data)}`);
    assert.equal(data.dailyVideo.duration, 2);
    assert.match(data.dailyVideo.url, /^https:\/\/cdn\.test\/users\/provider-1\/.*\.mp4$/);
    assert.ok(Math.abs(Date.parse(data.dailyVideo.expiresAt) - Date.now() - 4 * 60 * 60 * 1000) < 5000);
    assert.equal(data.rewardGranted, index === 0);

    const stored = app.uploads.at(-1);
    assert.ok(stored.indexOf("moov") < stored.indexOf("mdat"));
    const output = join(directory, `output-${format}.mp4`);
    await writeFile(output, stored);
    const { stdout } = await run(ffprobe, [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,pix_fmt,color_transfer",
      "-of", "json", output,
    ], options);
    const [video] = JSON.parse(stdout).streams;
    assert.equal(video.codec_name, "h264");
    assert.equal(video.pix_fmt, "yuv420p");
    if (format === "mov") assert.equal(video.color_transfer, "bt709");
  }
  assert.equal(app.writes.filter(({ ref }) => ref.collection === "dailyVideoRewards").length, 1);
});

test("invalid, oversized and overlong clips leave the existing video and bonus untouched", async (t) => {
  const app = setup();
  const directory = await testDirectory(t);
  const overlong = await makeVideo(directory, "overlong.webm", ["-c:v", "libvpx-vp9", "-live", "1"], "32");

  const invalid = [
    [uploadRequest("m3u8", "unsupported"), 415],
    [uploadRequest("mp4", "invalid video"), 422],
    [uploadRequest("mp4", "", { "Content-Length": String(151 * 1024 * 1024) }), 413],
    [uploadRequest("webm", overlong), 400],
  ];
  for (const [request, status] of invalid) {
    const response = await app.route.POST(request);
    assert.equal(response.status, status, await response.text());
  }

  app.profile.profileVisible = false;
  assert.equal((await app.route.POST(uploadRequest("webm", overlong))).status, 403);
  assert.equal(app.uploads.length, 0);
  assert.equal(app.writes.length, 0);
});

test("a 30-second MP4 keeps its AAC audio and is published at the limit", async (t) => {
  const app = setup();
  const directory = await testDirectory(t);
  const input = await makeVideo(directory, "input.mp4", ["-c:v", "libx264", "-preset", "ultrafast", "-c:a", "aac"], "30", true);
  const response = await app.route.POST(uploadRequest("mp4", input));
  const data = await response.json();
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.dailyVideo.duration, 30);

  const output = join(directory, "output.mp4");
  await writeFile(output, app.uploads[0]);
  const { stdout } = await run(ffprobe, [
    "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name", "-of", "json", output,
  ], options);
  assert.equal(JSON.parse(stdout).streams[0].codec_name, "aac");
});

test("gallery videos use server-measured duration and publish compatible MP4s beyond 30 seconds", async (t) => {
  const app = setup();
  const directory = await testDirectory(t);
  const input = await makeVideo(directory, "gallery.webm", ["-c:v", "libvpx-vp9"], "35");
  const details = { id: "gallery-1", private: true, price: 15000, description: "Video privado 🎞", duration: 1 };
  const response = await app.gallery.POST(galleryUploadRequest("webm", input, details));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-accel-buffering"), "no");
  const reader = response.body.getReader();
  assert.equal(Buffer.from((await reader.read()).value).toString(), "\n");
  let result = "";
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
    result += Buffer.from(chunk.value).toString();
  }
  const { media } = JSON.parse(result);
  assert.deepEqual(media, [{
    id: details.id, private: true, price: details.price, description: details.description,
    type: "video", url: media[0].url, duration: 35, playbackStatus: "ready",
  }]);
  assert.match(media[0].url, /\.mp4$/);
  assert.equal(app.writes.length, 1);
  assert.equal(app.writes[0].ref.id, "provider-1");

  const output = join(directory, "published.mp4");
  await writeFile(output, app.uploads[0]);
  const { stdout } = await run(ffprobe, ["-v", "error", "-show_entries", "stream=codec_name,pix_fmt", "-of", "json", output], options);
  assert.deepEqual(JSON.parse(stdout).streams, [{ codec_name: "h264", pix_fmt: "yuv420p" }]);

  const retry = await app.gallery.POST(galleryUploadRequest("webm", input, details));
  assert.deepEqual(await retry.json(), { media });
  assert.equal(app.uploads.length, 1);
});

test("gallery replacement keeps the old video's identity, privacy and price", async (t) => {
  const app = setup();
  const directory = await testDirectory(t);
  const input = await makeVideo(directory, "replacement.avi", ["-c:v", "mpeg4"]);
  const original = {
    type: "video", url: "https://cdn.test/legacy.avi", private: true,
    price: 15000, description: "Contenido de la compra", duration: 10, playbackStatus: "failed",
  };
  const other = { type: "video", duration: 170 };
  app.profile.media = [original, other];
  const details = { id: "legacy-0", replacesUrl: original.url };
  const response = await app.gallery.POST(galleryUploadRequest("avi", input, details));
  const { media } = await response.json();
  assert.deepEqual(media, [{
    ...original, id: "legacy-0", url: media[0].url, duration: 2, playbackStatus: "ready",
  }, { ...other, id: "legacy-1" }]);
  assert.match(media[0].url, /\.mp4$/);
  assert.equal(app.discarded.length, 0);

  const stale = await app.gallery.POST(galleryUploadRequest("avi", input, details));
  assert.equal(stale.status, 409);
  assert.equal(app.writes.length, 1);
  assert.equal(app.uploads.length, 1);
});

test("gallery validates the remaining quota again before saving and discards unused uploads", async (t) => {
  const app = setup({ beforeTransaction(profile) {
    profile.media = [{ id: "concurrent", type: "video", duration: 179 }];
  } });
  const directory = await testDirectory(t);
  const input = await makeVideo(directory, "gallery.mp4", ["-c:v", "libx264", "-preset", "ultrafast"]);
  const details = { id: "gallery-race", private: false };
  const response = await app.gallery.POST(galleryUploadRequest("mp4", input, details));
  assert.equal((await response.json()).status, 402);
  assert.equal(app.uploads.length, 1);
  assert.equal(app.discarded.length, 1);
  assert.equal(app.writes.length, 0);

  const remainingQuota = await app.gallery.POST(galleryUploadRequest("mp4", input, details));
  assert.equal((await remainingQuota.json()).status, 402);
  assert.equal(app.uploads.length, 1);
  assert.equal(app.writes.length, 0);

  app.profile.videoSecondsExtra = 60;
  const extraQuota = await app.gallery.POST(galleryUploadRequest("mp4", input, details));
  assert.equal((await extraQuota.json()).media[1].duration, 2);
  assert.equal(app.writes.length, 1);
});

test("gallery rejects broken or unsupported uploads and the photo endpoint cannot publish raw videos", async () => {
  const app = setup();
  const details = { id: "invalid-video", private: false };
  const wrongFormat = await app.gallery.POST(galleryUploadRequest("m3u8", "invalid", details));
  assert.equal(wrongFormat.status, 415);
  const invalidFile = await app.gallery.POST(galleryUploadRequest("mp4", "invalid", details));
  assert.equal((await invalidFile.json()).status, 422);
  const oversized = await app.gallery.POST(galleryUploadRequest("mp4", "invalid", details, {
    "Content-Length": String(151 * 1024 * 1024),
  }));
  assert.equal(oversized.status, 413);

  const postMedia = (item) => app.mediaRoute.POST(new Request("https://belaclub.test/api/provider-media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "addMany", items: [item] }),
  }));
  const rawVideo = await postMedia({ id: "raw-video", type: "video", url: "https://cdn.test/raw.mp4", duration: 1 });
  assert.equal(rawVideo.status, 415);
  assert.equal(app.writes.length, 0);
  const photo = await postMedia({ id: "photo", type: "photo", url: "https://cdn.test/photo.jpg" });
  assert.equal(photo.status, 200);
  assert.equal((await photo.json()).media[0].type, "photo");
  assert.equal(app.uploads.length, 0);
});
