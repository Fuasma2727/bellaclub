import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const load = (file, mocks = {}) => {
  const compiled = ts.transpileModule(readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const loaded = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (id) => id in mocks ? mocks[id] : require(id), loaded, loaded.exports
  );
  return loaded.exports;
};

const { toProviderListingCard } = load("lib/providerListing.ts");
const config = load("next.config.ts", {
  "./lib/explicitContentSeo": { explicitContentHeader: {} },
}).default;
const { imageConfigDefault } = require("next/dist/shared/lib/image-config");
const { ImageOptimizerCache } = require("next/dist/server/image-optimizer");
const { getImgProps } = require("next/dist/shared/lib/get-img-props");
const defaultLoader = require("next/dist/shared/lib/image-loader").default;
const images = { ...imageConfigDefault, ...config.images };
const source = "https://pp-profile-photos-cdn.b-cdn.net/users/example/photo.jpg";
const validate = (url) => ImageOptimizerCache.validateParams(
  { headers: { accept: "image/webp" } },
  { url, w: "384", q: "72" },
  { ...config, images },
  false
);

test("listings retain card indicators without transferring galleries or descriptions", () => {
  const original = {
    id: "example", name: "Example", photoUrl: source, city: "Example city",
    profilePath: "/example", verificationBadge: "gold", rating: 5,
    dailyVideo: { url: "https://example.com/daily.mp4" },
    description: "Profile detail",
    media: [
      { id: "public", type: "photo", url: "https://example.com/public.jpg" },
      { id: "private", type: "video", private: true, previewUrl: "/api/media-preview?id=example" },
      { id: "private-photo", type: "photo", private: true },
    ],
  };
  const card = toProviderListingCard(original);
  assert.equal(card.privateMediaCount, 2);
  assert.equal(card.hasProfileVideo, true);
  for (const key of ["id", "name", "photoUrl", "city", "profilePath", "verificationBadge", "rating", "dailyVideo"]) {
    assert.deepEqual(card[key], original[key]);
  }
  assert.equal("media" in card, false);
  assert.equal("description" in card, false);
  assert.equal(original.media.length, 3);
  assert.deepEqual(toProviderListingCard(card), card);
  assert.equal(toProviderListingCard({ id: "empty" }).privateMediaCount, 0);
  assert.equal(toProviderListingCard({ id: "empty" }).hasProfileVideo, false);
});

test("public images get responsive widths and negotiate WebP", () => {
  const result = validate(source);
  assert.equal(result.errorMessage, undefined);
  assert.equal(result.mimeType, "image/webp");
  const { props } = getImgProps(
    { src: source, alt: "Example", fill: true, sizes: "50vw", quality: 72 },
    { imgConf: images, defaultLoader }
  );
  assert.match(props.src, /^\/_next\/image\?/);
  assert.match(props.srcSet, /w=384&q=72 384w/);
  assert.equal(props.loading, "lazy");
  assert.equal(validate("/default-avatar.png").errorMessage, undefined);
});

test("the optimizer rejects private APIs, signed sources and foreign origins", () => {
  for (const url of [
    "/api/private-media?signature=example",
    "/api/media-preview?providerId=example",
    "/api/providers",
    "/admin/verificaciones",
    `${source}?token=example`,
    "https://example.com/photo.jpg",
    "http://127.0.0.1/photo.jpg",
  ]) {
    assert.equal(validate(url).errorMessage, '"url" parameter is not allowed');
  }
});

test("unoptimized protected previews retain their original URL", () => {
  const src = "/api/media-preview?providerId=example";
  const { props } = getImgProps(
    { src, alt: "Preview", fill: true, unoptimized: true },
    { imgConf: images, defaultLoader }
  );
  assert.equal(props.src, src);
  assert.equal(props.srcSet, undefined);
});
