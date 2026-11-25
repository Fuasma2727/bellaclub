import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const compiled = new Map();
const advisor = (fields = {}) => ({ id: "ana", name: "Ana", phone: "3001234567", active: true, ...fields });

// Run the real handlers, authorization, data loading and server markup against
// an isolated database. No test contacts are written to Firebase.
const setup = () => {
  let document;
  let writes = 0;
  let databaseFailure = false;
  const cached = new Map();
  const invalidations = [];
  const context = vm.createContext({
    console: { error() {}, warn() {} },
    setTimeout, clearTimeout, URL, Response, Request,
    process: { env: { OWNER_UID: "owner-uid", NODE_ENV: "test", NEXT_PUBLIC_APP_URL: "https://belaclub.co" } },
  });
  const snapshot = () => {
    if (databaseFailure) throw new Error("Database unavailable");
    return { data: () => structuredClone(document) };
  };
  const ref = { get: async () => snapshot() };
  const mocks = {
    "server-only": {},
    "next/cache": {
      unstable_cache: (fn, keys) => async () => {
        const key = keys.join(":");
        if (cached.has(key)) return cached.get(key);
        const result = await fn();
        cached.set(key, result);
        return result;
      },
      revalidateTag: (tag, profile) => { invalidations.push({ tag, profile }); cached.clear(); },
    },
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "@/lib/firebaseAdmin": {
      adminDb: {
        collection: (collection) => {
          assert.equal(collection, "siteSettings");
          return { doc: (id) => { assert.equal(id, "supportAdvisors"); return ref; } };
        },
        runTransaction: async (action) => action({
          get: async () => snapshot(),
          set: (_ref, data) => { document = structuredClone(data); writes += 1; },
        }),
      },
      adminAuth: {
        verifyIdToken: async (token, checkRevoked) => {
          assert.equal(checkRevoked, true);
          if (!["owner", "member"].includes(token)) throw new Error("Expired token");
          return { uid: token === "owner" ? "owner-uid" : "member-uid" };
        },
      },
      adminFieldValue: { serverTimestamp: () => "test-timestamp" },
    },
    "@/lib/providerCitySeo": { targetSeoCities: [] },
    "@/lib/publicProviders": { getPublicProviderCards: async () => [] },
    "@/lib/providerListing": { toProviderListingCard: (item) => item },
    "@/lib/providerSearchRoutes": { providerSearchRoutes: [] },
    "./prestadores/PrestadoresClientPage": ({ supportContent }) => React.createElement("footer", null, supportContent),
  };
  const modules = new Map();
  const load = (file) => {
    if (modules.has(file)) return modules.get(file).exports;
    if (!compiled.has(file)) {
      compiled.set(file, ts.transpileModule(readFileSync(path.join(root, file), "utf8"), {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
      }).outputText);
    }
    const module = { exports: {} };
    modules.set(file, module);
    const localRequire = (id) => {
      if (id in mocks) return mocks[id];
      if (id.startsWith("@/")) {
        const stem = id.slice(2);
        return load(existsSync(path.join(root, `${stem}.ts`)) ? `${stem}.ts` : `${stem}.tsx`);
      }
      return require(id);
    };
    vm.runInContext(`(function(require, module, exports) { ${compiled.get(file)}\n})`, context, { filename: file })(localRequire, module, module.exports);
    return module.exports;
  };
  const api = load("app/api/admin/support-advisors/route.ts");
  const request = (method, body, token = "owner", extraHeaders = {}) => new Request("https://belaclub.co/api/admin/support-advisors", {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json", ...extraHeaders },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return {
    api,
    request,
    save: (advisors, revision = 0, token = "owner") => api.PUT(request("PUT", { advisors, revision }, token)),
    public: load("lib/supportAdvisors.server.ts").getPublicSupportAdvisors,
    values: load("lib/supportAdvisors.ts"),
    home: async () => renderToStaticMarkup(await load("app/page.tsx").default()),
    fallback: () => renderToStaticMarkup(React.createElement(load("components/SupportAdvisors.tsx").default, { advisors: [] })),
    invalidations,
    get writes() { return writes; },
    failDatabase: () => { databaseFailure = true; },
  };
};

test("owner saves normalized contacts in order; public reads exclude hidden advisors", async () => {
  const app = setup();
  const response = await app.save([advisor({ name: " Ana " }), advisor({ id: "luis", name: "Luis", phone: "+1 (202) 555-0123", active: false })]);
  assert.equal(response.status, 200);
  const saved = await response.json();
  assert.equal(saved.advisors[0].name, "Ana");
  assert.equal(saved.advisors[0].phone, "+573001234567");
  assert.equal(saved.advisors[1].phone, "+12025550123");
  assert.equal(saved.revision, 1);
  const publicRows = await app.public();
  assert.equal(publicRows.length, 1);
  assert.equal(publicRows[0].id, "ana");
  const admin = await app.api.GET(app.request("GET"));
  assert.equal((await admin.json()).advisors.length, 2);
  assert.equal(admin.headers.get("Cache-Control"), "private, no-store");
});

test("non-owners and expired sessions cannot read or mutate contacts", async () => {
  const app = setup();
  for (const token of ["", "member", "expired"]) {
    for (const response of [await app.api.GET(app.request("GET", undefined, token)), await app.save([advisor()], 0, token)]) {
      assert.equal(response.status, token === "member" ? 403 : 401);
      assert.equal((await response.json()).advisors, undefined);
    }
  }
  assert.equal(app.writes, 0);
});

test("invalid numbers, duplicate contacts, invalid rows and oversized lists never save", async () => {
  const app = setup();
  for (const rows of [
    [advisor({ phone: "javascript:alert(1)" })],
    [advisor({ phone: "300123456" })],
    [advisor({ phone: "1234567890" })],
    [advisor({ name: " " })],
    [advisor({ active: "true" })],
    [advisor(), advisor({ id: "duplicate", phone: "+57 300 123 4567" })],
    [advisor(), advisor({ phone: "3011234567" })],
    [null],
    Array.from({ length: app.values.MAX_SUPPORT_ADVISORS + 1 }, (_, index) => advisor({ id: String(index) })),
  ]) {
    assert.equal((await app.save(rows)).status, 400);
  }
  const crossOrigin = await app.api.PUT(app.request("PUT", { advisors: [], revision: 0 }, "owner", { Origin: "https://example.com" }));
  assert.equal(crossOrigin.status, 403);
  const tooLarge = await app.api.PUT(app.request("PUT", {}, "owner", { "Content-Length": String(app.values.MAX_SUPPORT_ADVISORS_BODY_BYTES + 1) }));
  assert.equal(tooLarge.status, 413);
  assert.equal(app.writes, 0);
});

test("a 523-contact list fits the API and preserves different names sharing a number", async () => {
  const app = setup();
  const contacts = Array.from({ length: 523 }, (_, index) => advisor({
    id: `import-${index}`,
    name: `Asesor ${index + 1}`,
    phone: String(3000000000 + index),
  }));
  contacts[54] = { ...contacts[54], name: "Nathaly" };
  contacts[73] = { ...contacts[73], name: "Aida", phone: contacts[54].phone };
  const body = { advisors: contacts, revision: 0 };
  const response = await app.api.PUT(app.request("PUT", body, "owner", {
    "Content-Length": String(Buffer.byteLength(JSON.stringify(body))),
  }));
  assert.equal(response.status, 200);
  const visible = await app.public();
  assert.equal(visible.length, 523);
  assert.equal(visible[54].name, "Nathaly");
  assert.equal(visible[73].name, "Aida");
  assert.equal(visible[54].phone, visible[73].phone);
  const html = await app.home();
  assert.match(html, /Asesor 523/);
  assert.equal((html.match(/href="tel:/g) || []).length, 523);
  assert.match(html, /max-h-\[60vh\] overflow-y-auto/);
});

test("homepage HTML contains contact links and homepage organization data before any interaction", async () => {
  const app = setup();
  await app.save([advisor({ name: "Ana </script><script>alert(1)</script>" }), advisor({ id: "hidden", name: "Oculto", phone: "3011234567", active: false })]);
  const html = await app.home();
  assert.match(html, /<details id="soporte"/);
  assert.doesNotMatch(html, /<details[^>]*\bopen(?:[\s=>])/);
  assert.match(html, /href="tel:\+573001234567"/);
  assert.match(html, /href="https:\/\/wa.me\/573001234567\?text=/);
  assert.match(html, /\+57 3001234567/);
  assert.doesNotMatch(html, /Oculto|3011234567/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  const schemas = [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
  const organization = schemas.find((schema) => schema["@type"] === "Organization");
  assert.equal(organization.url, "https://belaclub.co/");
  assert.equal(organization.contactPoint.length, 1);
  assert.equal(organization.contactPoint[0].telephone, "+573001234567");
  assert.equal(organization.contactPoint[0].url, "https://belaclub.co/");
});

test("editing, hiding, reordering and removing contacts invalidate public contacts and schema", async () => {
  const app = setup();
  await app.save([advisor(), advisor({ id: "luis", name: "Luis", phone: "3011234567" })]);
  assert.equal((await app.public())[0].id, "ana");
  await app.save([advisor({ id: "luis", name: "Luis", phone: "3021234567" }), advisor({ active: false })], 1);
  assert.equal((await app.public()).length, 1);
  assert.equal((await app.public())[0].phone, "+573021234567");
  assert.doesNotMatch(await app.home(), /3001234567|3011234567/);
  await app.save([], 2);
  assert.equal((await app.public()).length, 0);
  assert.doesNotMatch(await app.home(), /ContactPoint|3021234567/);
  assert.equal(app.invalidations.length, 3);
  assert.deepEqual(app.invalidations.map(({ tag, profile }) => ({ tag, expire: profile.expire })), Array(3).fill({ tag: "support-advisors", expire: 0 }));
});

test("an outdated administrator tab cannot overwrite newer changes", async () => {
  const app = setup();
  await app.save([advisor()]);
  assert.equal((await app.save([], 0)).status, 409);
  assert.equal(app.writes, 1);
  assert.equal((await app.public())[0].id, "ana");
});

test("missing configuration or unavailable storage keeps general support usable", async () => {
  const app = setup();
  assert.equal((await app.public()).length, 0);
  assert.match(app.fallback(), /href="\/soporte"/);
  const unavailable = setup();
  unavailable.failDatabase();
  assert.equal((await unavailable.public()).length, 0);
  assert.match(await unavailable.home(), /Ver todos los canales de ayuda/);
});
