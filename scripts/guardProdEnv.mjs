import fs from "fs";
import path from "path";

const envFileNames = [".env", ".env.local", ".env.production", ".env.production.local"];
const envLocalPath = path.resolve(process.cwd(), ".env.local");
const entries = new Map();

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    entries.set(key, value);
  }
}

for (const fileName of envFileNames) {
  parseEnvFile(path.resolve(process.cwd(), fileName));
}

for (const [key, value] of Object.entries(process.env)) {
  entries.set(key, value ?? "");
}

if (!fs.existsSync(envLocalPath)) {
  // Continue to production-env completeness checks below.
} else {
  const raw = fs.readFileSync(envLocalPath, "utf8");

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    entries.set(key, value);
  }
}

function getEnv(key) {
  return (entries.get(key) || "").trim();
}

const violations = [];

const apiBaseUrl = getEnv("VITE_API_BASE_URL");
if (/^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/|$)/i.test(apiBaseUrl)) {
  violations.push(`VITE_API_BASE_URL points to a local host in .env.local: ${apiBaseUrl}`);
}

const devAuthBypass = getEnv("VITE_DEV_AUTH_BYPASS").toLowerCase();
if (devAuthBypass === "true") {
  violations.push("VITE_DEV_AUTH_BYPASS=true is set in .env.local");
}

if (entries.has("VITE_DEV_AUTH_EMAIL")) {
  violations.push("VITE_DEV_AUTH_EMAIL is set in .env.local");
}

if (entries.has("VITE_DEV_AUTH_UID")) {
  violations.push("VITE_DEV_AUTH_UID is set in .env.local");
}

const requiredProdVars = [
  "VITE_API_BASE_URL",
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_APP_ID",
];

for (const key of requiredProdVars) {
  if (!getEnv(key)) {
    violations.push(`${key} is required for a production web build`);
  }
}

if (!violations.length) {
  process.exit(0);
}

console.error("[web build] Refusing to build an incomplete or unsafe production bundle.");
console.error("[web build] Vite embeds VITE_* values at build time, so missing Firebase env vars ship as disabled auth.");
console.error("[web build] Keep local-only settings in .env.development.local and production-safe settings in Netlify env or .env.production.local.");
for (const violation of violations) {
  console.error(`- ${violation}`);
}

process.exit(1);
