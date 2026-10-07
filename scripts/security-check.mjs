import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const runGit = (args) => {
  const result = spawnSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }

  return result.stdout;
};

const trackedEnvFiles = runGit([
  "ls-files",
  "-z",
  "--",
  ".env",
  ".env.*",
])
  .split("\0")
  .filter(Boolean);

const problems = [];

for (const file of trackedEnvFiles) {
  problems.push({
    file,
    line: 1,
    type: "Archivo de entorno versionado",
  });
}

const trackedFiles = runGit(["ls-files", "-z"])
  .split("\0")
  .filter(Boolean)
  .filter((file) => !file.startsWith(".next/") && !file.startsWith("out/"));

const tokenPatterns = [
  {
    type: "Firebase private key",
    regex: /-----BEGIN PRIVATE KEY-----/g,
  },
  {
    type: "Wompi private key",
    regex: /\bprv_(?:test|prod)_[A-Za-z0-9]{16,}\b/g,
  },
  {
    type: "Wompi integrity secret",
    regex: /\b(?:test|prod)_integrity_[A-Za-z0-9]{16,}\b/g,
  },
  {
    type: "Wompi events secret",
    regex: /\b(?:test|prod)_events_[A-Za-z0-9]{16,}\b/g,
  },
  {
    type: "Wompi payouts API key",
    regex: /\b(?:test|prod|payouts)_[A-Za-z0-9_-]{24,}\b/g,
  },
];

const assignmentKeys = [
  "BUNNY_API_KEY",
  "FIREBASE_PRIVATE_KEY",
  "PRIVATE_MEDIA_SECRET",
  "WOMPI_PRIVATE_KEY",
  "WOMPI_INTEGRITY_SECRET",
  "WOMPI_EVENTS_SECRET",
  "WOMPI_PAYOUTS_API_KEY",
  "WOMPI_PAYOUTS_EVENTS_SECRET",
];

const placeholderWords = [
  "clave",
  "secret",
  "tu-",
  "your-",
  "example",
  "placeholder",
  "pon-",
  "random",
];

const isRealAssignmentValue = (value) => {
  const clean = value.trim().replace(/^["']|["']$/g, "");

  if (!clean || clean.length < 12) return false;

  const lower = clean.toLowerCase();

  return !placeholderWords.some((word) => lower.includes(word));
};

const getLineNumber = (content, index) => {
  return content.slice(0, index).split(/\r?\n/).length;
};

for (const file of trackedFiles) {
  let content = "";

  try {
    const buffer = readFileSync(file);
    if (buffer.includes(0)) continue;
    content = buffer.toString("utf8");
  } catch {
    continue;
  }

  for (const pattern of tokenPatterns) {
    for (const match of content.matchAll(pattern.regex)) {
      problems.push({
        file,
        line: getLineNumber(content, match.index || 0),
        type: pattern.type,
      });
    }
  }

  const assignmentRegex = new RegExp(
    `\\b(${assignmentKeys.join("|")})[ \\t]*=[ \\t]*([^\\r\\n#]*)`,
    "g"
  );

  for (const match of content.matchAll(assignmentRegex)) {
    const value = match[2] || "";
    if (value.includes("process.env.")) continue;
    if (!isRealAssignmentValue(value)) continue;

    problems.push({
      file,
      line: getLineNumber(content, match.index || 0),
      type: `Valor sensible asignado a ${match[1]}`,
    });
  }
}

if (problems.length) {
  console.error("\nSecurity check fallido. No se imprimen secretos.\n");

  for (const problem of problems) {
    console.error(`- ${problem.file}:${problem.line} ${problem.type}`);
  }

  console.error(
    "\nMueve esos valores a .env.local/variables del servidor y rota cualquier llave expuesta."
  );
  process.exit(1);
}

console.log("Security check correcto: no hay .env versionados ni secretos obvios.");
