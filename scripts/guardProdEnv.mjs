import fs from "fs";
import path from "path";

const envLocalPath = path.resolve(process.cwd(), ".env.local");

if (!fs.existsSync(envLocalPath)) {
  process.exit(0);
}

const raw = fs.readFileSync(envLocalPath, "utf8");
const entries = new Map();

for (const line of raw.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const separator = trimmed.indexOf("=");
  if (separator === -1) continue;
  const key = trimmed.slice(0, separator).trim();
  const value = trimmed.slice(separator + 1).trim();
  entries.set(key, value);
}

const violations = [];

const apiBaseUrl = entries.get("VITE_API_BASE_URL") || "";
if (/^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/|$)/i.test(apiBaseUrl)) {
  violations.push(`VITE_API_BASE_URL points to a local host in .env.local: ${apiBaseUrl}`);
}

const devAuthBypass = (entries.get("VITE_DEV_AUTH_BYPASS") || "").trim().toLowerCase();
if (devAuthBypass === "true") {
  violations.push("VITE_DEV_AUTH_BYPASS=true is set in .env.local");
}

if (entries.has("VITE_DEV_AUTH_EMAIL")) {
  violations.push("VITE_DEV_AUTH_EMAIL is set in .env.local");
}

if (entries.has("VITE_DEV_AUTH_UID")) {
  violations.push("VITE_DEV_AUTH_UID is set in .env.local");
}

if (!violations.length) {
  process.exit(0);
}

console.error("[web build] Refusing to build a production bundle with dev-only values in .env.local.");
console.error("[web build] Vite loads .env.local in every mode, including production builds.");
console.error("[web build] Move dev-only settings into .env.development.local instead.");
for (const violation of violations) {
  console.error(`- ${violation}`);
}

process.exit(1);
