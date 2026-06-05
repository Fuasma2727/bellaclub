import { existsSync, readFileSync } from "node:fs";

const loadLocalEnv = () => {
  const path = ".env.local";

  if (!existsSync(path)) return;

  const lines = readFileSync(path, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
};

const getHost = (value) => {
  return value.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
};

loadLocalEnv();

const required = [
  "BUNNY_API_KEY",
  "BUNNY_STORAGE_ZONE",
  "BUNNY_STORAGE_HOST",
  "BUNNY_CDN_HOST",
];

const missing = required.filter((key) => !process.env[key]?.trim());

if (missing.length) {
  console.error("Bunny check fallido: faltan variables.");
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

const storageHost = getHost(process.env.BUNNY_STORAGE_HOST);
const cdnHost = getHost(process.env.BUNNY_CDN_HOST);
const storageZone = process.env.BUNNY_STORAGE_ZONE;
const apiKey = process.env.BUNNY_API_KEY;
const testPath = `health-check/${Date.now()}-${Math.random()
  .toString(36)
  .slice(2)}.txt`;
const storageUrl = `https://${storageHost}/${storageZone}/${testPath}`;
const cdnUrl = `https://${cdnHost}/${testPath}`;
const body = `BelaClub Bunny check ${new Date().toISOString()}\n`;

console.log("Probando Bunny Storage...");
console.log(`- Storage host: ${storageHost}`);
console.log(`- Storage zone: ${storageZone}`);
console.log(`- CDN host: ${cdnHost}`);

const upload = await fetch(storageUrl, {
  method: "PUT",
  headers: {
    AccessKey: apiKey,
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body).toString(),
  },
  body,
});

if (!upload.ok) {
  const text = await upload.text();
  console.error(`Bunny no acepto la subida. Estado: ${upload.status}`);
  console.error(text || "Sin detalle de Bunny.");
  process.exit(1);
}

console.log("Subida a Bunny correcta.");
console.log(`URL CDN esperada: ${cdnUrl}`);

const cdn = await fetch(cdnUrl, { cache: "no-store" });

if (!cdn.ok) {
  console.warn(
    `La subida funciono, pero el CDN aun no responde. Estado CDN: ${cdn.status}`
  );
  console.warn("Esto puede tardar unos segundos si Bunny todavia propaga.");
  process.exit(0);
}

console.log("CDN responde correctamente. Bunny esta funcionando.");
