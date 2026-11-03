import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import vm from "node:vm";
import ffmpeg from "ffmpeg-static";
import sharp from "sharp";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const compiled = new Map();
const photo = await sharp({ create: {
  width: 640, height: 480, channels: 3, background: "#a53c75",
} }).jpeg().toBuffer();

const setup = async (t, { video = false, source = photo, providerChanges = {}, itemChanges = {} } = {}) => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "belaclub-preview-test-"));
  t.after(async () => {
    assert.equal(path.dirname(temporaryRoot), path.resolve(os.tmpdir()));
    await rm(temporaryRoot, { recursive: true, force: true });
  });
  let downloads = 0;
  let reads = 0;
  const item = {
    id: "private-1", type: video ? "video" : "photo", private: true,
    url: `https://cdn.test/users/provider-1/source.${video ? "mp4" : "jpg"}`,
    ...itemChanges,
  };
  const provider = {
    role: "prestador", profileVisible: true, photoUrl: "public.jpg",
    verificationStatus: "approved", subscriptionStatus: "active", media: [item],
    ...providerChanges,
  };
  const mocks = {
    "@/lib/firebaseAdmin": { adminDb: {
      collection: () => ({ doc: () => ({ get: async () => {
        reads += 1;
        return { data: () => provider };
      } }) }),
    } },
    "@/lib/providerSubscription": { isProviderSubscriptionPubliclyActive: data => data.subscriptionStatus === "active" },
    "@/lib/rateLimit": { getClientIp: () => "test", checkRateLimit: () => ({ allowed: true }) },
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
  };
  const context = vm.createContext({
    console: { error() {} }, Buffer, URL, Response, Uint8Array, AbortSignal,
    setTimeout, clearTimeout,
    process: { cwd: () => temporaryRoot, pid: process.pid, env: { BUNNY_CDN_HOST: "cdn.test" } },
    fetch: async url => {
      assert.equal(url, item.url);
      downloads += 1;
      return new Response(source);
    },
  });
  const modules = new Map();
  const load = file => {
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiled.has(file)) {
      compiled.set(file, ts.transpileModule(readFileSync(path.join(root, file), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      }).outputText);
    }
    const loadedModule = { exports: {} };
    modules.set(file, loadedModule);
    const localRequire = id => id in mocks ? mocks[id]
      : id.startsWith("@/") ? load(`${id.slice(2)}.ts`) : require(id);
    const run = vm.runInContext(`(function(require, module, exports) { ${compiled.get(file)}\n})`, context);
    run(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  };
  return {
    api: load("app/api/media-preview/route.ts"),
    preview: load("lib/mediaPreview.ts"),
    urls: load("lib/mediaPreviewUrl.ts"),
    get downloads() { return downloads; },
    get reads() { return reads; },
  };
};

const request = (query = "providerId=provider-1&mediaId=private-1") =>
  new Request(`https://belaclub.test/api/media-preview?${query}`);

test("photo previews are reduced JPEG files, including when requested with unblur parameters", async t => {
  const app = await setup(t);
  const response = await app.api.GET(request("providerId=provider-1&mediaId=private-1&blur=0&width=640"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  const bytes = Buffer.from(await response.arrayBuffer());
  const dimensions = await sharp(bytes).metadata();
  assert.equal(dimensions.width, 96);
  assert.equal(dimensions.height, 72);
  assert(bytes.length < photo.length);
  const again = await app.api.GET(request());
  assert.equal(again.status, 200);
  assert.equal(app.downloads, 1);
  assert.equal(app.reads, 1);
});

test("video previews contain a blurred still image rather than the video", async t => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "belaclub-video-test-"));
  t.after(async () => {
    assert.equal(path.dirname(temporaryRoot), path.resolve(os.tmpdir()));
    await rm(temporaryRoot, { recursive: true, force: true });
  });
  const videoPath = path.join(temporaryRoot, "fixture.mp4");
  await promisify(execFile)(ffmpeg, [
    "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=1",
    "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", videoPath,
  ], { timeout: 15_000, windowsHide: true });
  const app = await setup(t, { video: true, source: await readFile(videoPath) });
  const response = await app.api.GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  const dimensions = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.equal(dimensions.width, 96);
  assert.equal(dimensions.height, 72);
});

test("hidden, blocked and unpaid profiles cannot expose previews", async t => {
  for (const providerChanges of [
    { profileVisible: false }, { blocked: true },
    { verificationStatus: "pending" }, { subscriptionStatus: "past_due" },
  ]) {
    const app = await setup(t, { providerChanges });
    assert.equal((await app.api.GET(request())).status, 404);
    assert.equal(app.downloads, 0);
  }
});

test("public items and arbitrary source URLs are rejected before downloading", async t => {
  for (const itemChanges of [
    { private: false }, { url: "https://example.org/internal" },
    { url: "https://cdn.test/users/another-provider/secret.jpg" },
    { playbackStatus: "failed" },
  ]) {
    const app = await setup(t, { itemChanges });
    assert.equal((await app.api.GET(request())).status, 404);
    assert.equal(app.downloads, 0);
  }
});

test("legacy items get preview URLs and remain available without resaving uploads", async t => {
  const app = await setup(t, { itemChanges: { id: undefined } });
  const url = app.urls.withPrivateMediaPreviews("provider-1", [{ type: "video", private: true }])[0].previewUrl;
  assert(url.includes("mediaId=legacy-0"));
  assert.equal((await app.api.GET(new Request(`https://belaclub.test${url}`))).status, 200);
  const invalid = await app.api.GET(request("providerId=../private&mediaId=private-1"));
  assert.equal(invalid.status, 400);
});

test("the JPEG itself is blurred even without frontend CSS", async t => {
  const app = await setup(t);
  const pixels = Buffer.alloc(96 * 96 * 3);
  for (let y = 0; y < 96; y += 1) {
    for (let x = 0; x < 96; x += 1) {
      pixels.fill(x % 2 ? 255 : 0, (y * 96 + x) * 3, (y * 96 + x + 1) * 3);
    }
  }
  const stripes = await sharp(pixels, { raw: { width: 96, height: 96, channels: 3 } }).png().toBuffer();
  const blurred = await app.preview.blurMediaPreview(stripes);
  const { channels } = await sharp(blurred).metadata();
  const output = await sharp(blurred).raw().toBuffer();
  const middle = 48 * 96 * channels;
  assert(Math.abs(output[middle + 40 * channels] - output[middle + 41 * channels]) < 10);
});
