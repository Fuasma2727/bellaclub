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
const setup = () => {
  const uploads = [];
  const writes = [];
  let rewardExists = false;
  const profile = { role: "prestador", verificationStatus: "approved", profileVisible: true };
  const userRef = { id: "provider-1" };
  const mocks = {
    "@/lib/firebaseAdmin": {
      adminDb: {
        collection: (name) => ({ doc: (id) => ({ id, collection: name }) }),
        runTransaction: async (callback) => callback({
          get: async (ref) => ref === userRef
            ? { exists: true, data: () => profile }
            : { exists: rewardExists },
          set(ref, data) {
            if (ref.collection === "dailyVideoRewards") rewardExists = true;
            writes.push({ ref, data });
          },
        }),
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
    URL, ReadableStream, TransformStream, AbortSignal,
    process: { env: { BUNNY_API_KEY: "test", BUNNY_CDN_HOST: "cdn.test" } },
    fetch: async (url, init) => {
      assert.match(url, /\/users\/provider-1\/[^/]+\.mp4$/);
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

  return { route: load("app/api/provider-daily-video/route.ts"), uploads, writes, profile };
};

const uploadRequest = (format, body, headers = {}) => new Request("https://belaclub.test/api/provider-daily-video", {
  method: "POST",
  headers: { "Content-Type": "application/octet-stream", "x-video-format": format, ...headers },
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
