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

loadLocalEnv();

const required = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_OWNER_EMAIL",
  "OWNER_EMAIL",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "BUNNY_API_KEY",
  "BUNNY_STORAGE_ZONE",
  "BUNNY_STORAGE_HOST",
  "BUNNY_CDN_HOST",
  "PRIVATE_MEDIA_SECRET",
  "WOMPI_PUBLIC_KEY",
  "WOMPI_INTEGRITY_SECRET",
  "WOMPI_EVENTS_SECRET",
];

const warnings = [];
const errors = [];

for (const key of required) {
  if (!process.env[key]?.trim()) {
    errors.push(`Falta ${key}`);
  }
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
if (appUrl.includes("localhost")) {
  errors.push("NEXT_PUBLIC_APP_URL no debe apuntar a localhost en produccion");
}

if (appUrl && !appUrl.startsWith("https://")) {
  errors.push("NEXT_PUBLIC_APP_URL debe usar https:// en produccion");
}

const privateMediaSecret = process.env.PRIVATE_MEDIA_SECRET || "";
if (privateMediaSecret && privateMediaSecret.length < 32) {
  errors.push("PRIVATE_MEDIA_SECRET debe tener minimo 32 caracteres");
}

const firebasePrivateKey = process.env.FIREBASE_PRIVATE_KEY || "";
if (firebasePrivateKey && !firebasePrivateKey.includes("BEGIN PRIVATE KEY")) {
  warnings.push(
    "FIREBASE_PRIVATE_KEY no parece tener el formato esperado de una llave privada"
  );
}

if (process.env.WOMPI_PUBLIC_KEY?.startsWith("pub_test")) {
  warnings.push("WOMPI_PUBLIC_KEY parece ser de pruebas, no de produccion");
}

if (
  process.env.NEXT_PUBLIC_OWNER_EMAIL &&
  process.env.OWNER_EMAIL &&
  process.env.NEXT_PUBLIC_OWNER_EMAIL.toLowerCase() !==
    process.env.OWNER_EMAIL.toLowerCase()
) {
  warnings.push("NEXT_PUBLIC_OWNER_EMAIL y OWNER_EMAIL no coinciden");
}

if (errors.length) {
  console.error("\nPreflight fallido:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }

  if (warnings.length) {
    console.warn("\nAdvertencias:\n");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  process.exit(1);
}

console.log("Preflight correcto: variables criticas configuradas.");

if (warnings.length) {
  console.warn("\nAdvertencias:\n");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}
