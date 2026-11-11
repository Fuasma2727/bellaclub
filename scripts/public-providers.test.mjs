import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const compiled = new Map();

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

const snapshot = (ids = ["provider-1"]) => ({
  docs: ids.map((id) => ({
    id,
    data: () => ({
      role: "prestador",
      name: "Perfil de prueba",
      city: "Medellin",
      profileVisible: true,
      verificationStatus: "approved",
      photoUrl: "https://example.com/photo.jpg",
    }),
  })),
});

// Execute the actual cache and API code with isolated Firestore and disk I/O.
const setup = ({ query, diskCache, documents = {} } = {}) => {
  let clock = Date.now();
  let queries = 0;
  const writes = [];
  const context = vm.createContext({
    console: { warn() {}, error() {} },
    setTimeout,
    clearTimeout,
    Date: class extends Date {
      static now() { return clock; }
    },
    process: {
      cwd: () => root,
      env: { PUBLIC_PROVIDER_FIRESTORE_TIMEOUT_MS: "15" },
    },
  });
  const firestore = {
    collection() { return this; },
    doc(id) {
      return {
        get: async () => ({
          id,
          exists: Boolean(documents[id]),
          data: () => documents[id],
        }),
      };
    },
    where() { return this; },
    get() {
      queries += 1;
      return query ? query(queries) : Promise.resolve(snapshot());
    },
  };
  const mocks = {
    "fs/promises": {
      mkdir: async () => {},
      readFile: async () => {
        if (!diskCache) throw new Error("ENOENT");
        return JSON.stringify(diskCache);
      },
      stat: async () => ({ mtimeMs: clock }),
      writeFile: async (_file, contents) => { writes.push(JSON.parse(contents)); },
    },
    "@/lib/firebaseAdmin": { adminDb: firestore },
    "@/lib/providerPhoneSeo": { getPhoneSeoValues: () => ({ canonicalDigits: "" }) },
    "@/lib/providerPromotion": {
      getAdminQualityRank: () => 0,
      getPublicVerificationBadge: () => null,
      getVerificationLevelFromBadge: () => null,
      getVerificationRank: () => 0,
    },
    "@/lib/providerSubscription": { isProviderSubscriptionPubliclyActive: () => true },
    "@/lib/mediaCompatibility": {
      isSupportedMediaUrl: () => true,
      isSupportedVideoUrl: () => true,
    },
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
  };
  const modules = new Map();
  const load = (file) => {
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiled.has(file)) {
      compiled.set(file, ts.transpileModule(readFileSync(path.join(root, file), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
      }).outputText);
    }
    const loadedModule = { exports: {} };
    modules.set(file, loadedModule);
    const localRequire = (id) => {
      if (id in mocks) return mocks[id];
      if (id.startsWith("@/")) return load(`${id.slice(2)}.ts`);
      return require(id);
    };
    const run = vm.runInContext(`(function(require, module, exports) { ${compiled.get(file)}\n})`, context);
    run(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  };
  return {
    providers: load("lib/publicProviders.ts"),
    api: load("app/api/providers/route.ts"),
    sitemap: load("app/sitemap.ts").default,
    writes,
    get queries() { return queries; },
    advance: (ms) => { clock += ms; },
  };
};

test("a cold timeout returns 503, shares the pending query, and recovers its late result", async () => {
  const pending = deferred();
  const app = setup({ query: () => pending.promise });
  assert.equal((await app.providers.getPublicProviderCards()).length, 0);
  assert.equal(app.writes.length, 0);

  const unavailable = await app.api.GET();
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("Retry-After"), "5");
  assert.equal(unavailable.headers.get("Cache-Control"), "no-store");
  assert.equal(app.queries, 1);

  pending.resolve(snapshot());
  await new Promise(setImmediate);
  const recovered = await app.api.GET();
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).providers[0].id, "provider-1");
  assert.equal(app.queries, 1);
  assert.equal(app.writes.length, 1);
});

test("a successful empty query remains a valid empty result", async () => {
  const app = setup({ query: async () => snapshot([]) });
  for (let request = 0; request < 2; request += 1) {
    const response = await app.api.GET();
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).providers, []);
  }
  assert.equal(app.queries, 1);
});

test("quota errors are temporary failures and recover after the retry cooldown", async () => {
  const app = setup({ query: async (count) => {
    if (count === 1) throw Object.assign(new Error("Quota exceeded"), { code: 8 });
    return snapshot();
  } });
  assert.equal((await app.api.GET()).status, 503);
  assert.equal((await app.api.GET()).status, 503);
  assert.equal(app.queries, 1);
  assert.equal(app.writes.length, 0);
  app.advance(61_000);
  const response = await app.api.GET();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).providers.length, 1);
  assert.equal(app.queries, 2);
});

test("stale disk profiles stay visible while a slow refresh runs and fails", async () => {
  const pending = deferred();
  const app = setup({
    query: () => pending.promise,
    diskCache: {
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      providers: [{ id: "cached-provider" }],
    },
  });
  const response = await app.api.GET();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).providers[0].id, "cached-provider");
  app.providers.invalidatePublicProviderCache();
  assert.equal((await app.api.GET()).status, 200);
  pending.reject(Object.assign(new Error("Quota exceeded"), { code: 8 }));
  await new Promise(setImmediate);
  assert.equal((await app.providers.getPublicProviderCards())[0].id, "cached-provider");
});

test("expired profiles do not turn a timed out query into a successful empty response", async () => {
  const pending = deferred();
  const app = setup({
    query: () => pending.promise,
    diskCache: {
      updatedAt: new Date().toISOString(),
      providers: [{ id: "expired-provider" }],
    },
  });
  assert.equal((await app.api.GET()).status, 200);
  app.advance(73 * 60 * 60 * 1000);
  assert.equal((await app.api.GET()).status, 503);
  pending.resolve(snapshot());
  await new Promise(setImmediate);
  assert.equal((await app.api.GET()).status, 200);
});

test("unexpected query failures are not cached as empty profiles", async () => {
  const app = setup({ query: async (count) => {
    if (count === 1) throw new Error("Connection reset");
    return snapshot();
  } });
  assert.equal((await app.api.GET()).status, 500);
  assert.equal((await app.api.GET()).status, 200);
  assert.equal(app.queries, 2);
});

test("profile IDs still resolve after name or city changes and without a city", async () => {
  const publicData = snapshot().docs[0].data();
  const app = setup({ documents: {
    moved: { ...publicData, name: "Nombre actual", city: "Buga" },
    missingCity: { ...publicData, city: "" },
    blankCity: { ...publicData, city: "   " },
  } });

  const moved = await app.providers.getPublicProviderProfileBySlug("nombre-anterior--moved");
  assert.equal(moved.profilePath, "/escorts/buga/nombre-actual--moved");
  for (const id of ["missingCity", "blankCity"]) {
    const provider = await app.providers.getPublicProviderProfileBySlug(`perfil--${id}`);
    assert.equal(provider.profilePath, `/escorts/colombia/perfil-de-prueba--${id}`);
  }
});

test("old slugs never resolve missing, hidden, blocked or unapproved profiles", async () => {
  const publicData = snapshot().docs[0].data();
  const app = setup({ documents: {
    hidden: { ...publicData, profileVisible: false },
    blocked: { ...publicData, blocked: true },
    unapproved: { ...publicData, verificationStatus: "pending" },
    noPhoto: { ...publicData, photoUrl: "" },
  } });

  for (const id of ["missing", "hidden", "blocked", "unapproved", "noPhoto"]) {
    assert.equal(await app.providers.getPublicProviderProfileBySlug(`anterior--${id}`), null);
  }
  assert.equal(await app.providers.getPublicProviderProfileBySlug("sin-identificador"), null);
});

test("sitemap rebuilds profile paths from records instead of trusting obsolete cached URLs", async () => {
  const app = setup({ diskCache: {
    updatedAt: new Date().toISOString(),
    providers: [{
      id: "no-city",
      name: "Perfil",
      city: "   ",
      profilePath: "/escorts//perfil--no-city",
      media: [],
    }],
  } });
  const entries = await app.sitemap();
  const profileUrls = entries.filter(entry => entry.url.includes("--"));
  assert.equal(profileUrls.length, 1);
  assert.equal(profileUrls[0].url, "https://belaclub.co/escorts/colombia/perfil--no-city");
});
