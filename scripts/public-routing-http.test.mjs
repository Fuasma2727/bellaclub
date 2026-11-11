import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { after, before, test } from "node:test";
import { promisify } from "node:util";

// Use the real Next.js production renderer and ISR cache, with isolated records.
// A mocked redirect() cannot detect a 308 that loses its Location on cache hits.
const root = path.resolve(import.meta.dirname, "..");
const run = promisify(execFile);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const nextCli = path.join(root, "node_modules/next/dist/bin/next");
const modulePath = value => value.replaceAll("\\", "/");
let directory, origin, server;
let output = "";
const records = {
  one: { name: "Nombre actual", profilePath: "/escorts/buga/actual--one", visible: true },
  two: { name: "Sin ciudad", profilePath: "/escorts/colombia/sin-ciudad--two", visible: true },
  hidden: { name: "Oculto", profilePath: "/escorts/buga/oculto--hidden", visible: false },
  recovered: { name: "Disponible", profilePath: "/escorts/buga/disponible--recovered", visible: false },
};

before(async () => {
  const cacheRoot = path.join(root, ".runtime-cache");
  await mkdir(cacheRoot, { recursive: true });
  directory = await mkdtemp(path.join(cacheRoot, "routing-http-"));
  const route = path.join(directory, "app/escorts/[citySlug]/[profileSlug]");
  await mkdir(route, { recursive: true });
  await writeFile(path.join(directory, "package.json"), JSON.stringify({ private: true }));
  await writeFile(path.join(directory, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      paths: { "@/lib/publicProviders": ["./providers.js"] },
    },
    include: ["app/**/*", "proxy.ts", ".next/types/**/*.ts"],
  }));
  await writeFile(path.join(directory, "records.json"), JSON.stringify(records));
  await writeFile(path.join(directory, "providers.js"), `
    import { readFile } from 'node:fs/promises';
    import path from 'node:path';
    export async function getPublicProviderProfileBySlug(slug) {
      const records = JSON.parse(await readFile(path.join(process.cwd(), 'records.json'), 'utf8'));
      const provider = records[slug.split('--')[1]];
      return provider?.visible ? provider : null;
    }
  `);
  await writeFile(path.join(directory, "next.config.mjs"), `
    export default {
      outputFileTracingRoot: ${JSON.stringify(modulePath(root))},
      experimental: { cpus: 1 },
      webpack(config) {
        config.resolve.alias['@/lib/publicProviders'] = ${JSON.stringify(modulePath(path.join(directory, "providers.js")))};
        return config;
      }
    };
  `);
  await writeFile(path.join(directory, "app/layout.js"), `
    export default function Layout({ children }) {
      return <html lang="es"><body>{children}</body></html>;
    }
  `);
  await writeFile(path.join(directory, "app/page.js"), "export default function Page() { return <h1>Prueba HTTP</h1>; }");
  await writeFile(path.join(route, "page.js"), `
    import { notFound } from 'next/navigation';
    import { resolvePublicProfileRoute } from ${JSON.stringify(modulePath(path.join(root, "lib/publicProfileRoute")))};
    export const revalidate = 1;
    export async function generateStaticParams() { return []; }
    export async function generateMetadata({ params }) {
      const { citySlug, profileSlug } = await params;
      const provider = await resolvePublicProfileRoute(profileSlug);
      return { title: provider?.name || 'No disponible' };
    }
    export default async function Page({ params }) {
      const { citySlug, profileSlug } = await params;
      const provider = await resolvePublicProfileRoute(profileSlug);
      if (!provider) notFound();
      return <h1>{provider.name}</h1>;
    }
  `);
  const proxy = await readFile(path.join(root, "proxy.ts"), "utf8");
  await writeFile(path.join(directory, "proxy.ts"), proxy
    .replace('"./lib/ipAccess"', JSON.stringify(modulePath(path.join(root, "lib/ipAccess"))))
    .replace('"./lib/publicProfileRoute"', JSON.stringify(modulePath(path.join(root, "lib/publicProfileRoute")))));
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1", SITE_ALLOWED_IPS: "", ADMIN_ALLOWED_IPS: "", OWNER_ALLOWED_IPS: "" };
  try {
    await run(process.execPath, [nextCli, "build", directory, "--webpack"], { cwd: directory, env, windowsHide: true, timeout: 180_000, maxBuffer: 4 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`HTTP fixture build failed:\n${error.stdout || ''}\n${error.stderr || error.message}`);
  }
  const port = await new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.on("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const { port } = listener.address();
      listener.close(() => resolve(port));
    });
  });
  origin = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, [nextCli, "start", directory, "--hostname", "127.0.0.1", "--port", String(port)], { cwd: directory, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", chunk => { output += chunk; });
  server.stderr.on("data", chunk => { output += chunk; });
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(origin)).ok) return; } catch {}
    if (server.exitCode !== null) break;
    await delay(100);
  }
  throw new Error(`HTTP fixture did not start:\n${output}`);
}, { timeout: 200_000 });

after(() => { server?.kill(); });

const request = (pathname, init = {}) => fetch(origin + pathname, { redirect: "manual", ...init });
const assertRedirect = async (pathname, target, init) => {
  const response = await request(pathname, init);
  assert.equal(response.status, 308, pathname);
  const location = response.headers.get("location");
  assert.ok(location, `Missing Location for ${pathname}`);
  assert.equal(new URL(location, origin).pathname, target);
  assert.equal(new URL(location, origin).search, new URL(pathname, origin).search);
  await response.arrayBuffer();
};

test("www and HTTP redirects remove the internal port and preserve path and query", async () => {
  for (const [host, protocol] of [["www.belaclub.co", "https"], ["www.belaclub.co", "http"], ["belaclub.co", "http"]]) {
    for (const method of ["GET", "HEAD"]) {
      const response = await request("/escorts/buga?from=test", { method, headers: { "x-forwarded-host": host, "x-forwarded-proto": protocol } });
      assert.equal(response.status, 308);
      assert.equal(response.headers.get("location"), "https://belaclub.co/escorts/buga?from=test");
      await response.arrayBuffer();
    }
  }
  assert.equal((await request("/", { headers: { "x-forwarded-host": "belaclub.co", "x-forwarded-proto": "https" } })).status, 200);
});

test("old name and city return 308 with Location on first render and cache hits", async () => {
  for (const pathname of ["/escorts/buga/anterior--one", "/escorts/rionegro/actual--one"]) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await assertRedirect(pathname, records.one.profilePath);
    }
    await assertRedirect(pathname, records.one.profilePath, { method: "HEAD" });
    await assertRedirect(pathname, records.one.profilePath, { headers: { "user-agent": "Googlebot" } });
  }
  await assertRedirect("/escorts/rionegro/actual--one?from=test", records.one.profilePath);
  const publicHost = await request("/escorts/rionegro/actual--one", { headers: { "x-forwarded-host": "belaclub.co", "x-forwarded-proto": "https" } });
  assert.equal(publicHost.headers.get("location"), "https://belaclub.co" + records.one.profilePath);
  await publicHost.arrayBuffer();
});

test("canonical and no-city destinations return 200 while hidden and missing IDs stay 404", async () => {
  for (const provider of [records.one, records.two]) {
    const response = await request(provider.profilePath);
    assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(provider.name));
  }
  for (const pathname of ["/escorts/rionegro/anterior--hidden", "/escorts/colombia/perfil--missing", "/escorts/rionegro/anterior--recovered"]) {
    const response = await request(pathname);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("location"), null);
    await response.arrayBuffer();
  }
});

test("profile moves redirect before a previously cached 200 or 404 can be served", async () => {
  const previousPath = records.one.profilePath;
  records.one.profilePath = "/escorts/medellin/actualizado--one";
  records.one.name = "Nombre actualizado";
  records.recovered.visible = true;
  await writeFile(path.join(directory, "records.json"), JSON.stringify(records));
  await assertRedirect("/escorts/rionegro/anterior--recovered", records.recovered.profilePath);
  await delay(1300);
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await request(previousPath);
    await response.arrayBuffer();
    if (response.status === 308) {
      assert.equal(response.headers.get("location"), records.one.profilePath);
      await assertRedirect(previousPath, records.one.profilePath);
      assert.equal((await request(records.one.profilePath)).status, 200);
      return;
    }
    assert.equal(response.status, 200);
    await delay(200);
  }
  assert.fail(`ISR did not publish the changed route:\n${output}`);
});
