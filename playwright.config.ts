import os from "node:os";
import path from "node:path";

import { defineConfig } from "@playwright/test";

const artifactRoot = process.env.LOCALAPPDATA || os.tmpdir();
const playwrightOutputDir =
  process.env.PLAYWRIGHT_OUTPUT_DIR ||
  path.join(
    artifactRoot,
    "applendium-web",
    "playwright-artifacts",
    String(Date.now()),
  );
const viteCacheDir =
  process.env.VITE_CACHE_DIR ||
  path.join(
    artifactRoot,
    "applendium-web",
    "vite-cache",
    String(Date.now()),
  );

export default defineConfig({
  testDir: "./e2e",
  outputDir: playwrightOutputDir,
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    headless: true,
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    env: {
      VITE_DEV_AUTH_BYPASS: "true",
      VITE_DEV_AUTH_EMAIL: "candidate@example.test",
      VITE_DEV_AUTH_UID: "playwright-premium-user",
      VITE_API_BASE_URL: "http://127.0.0.1:4010",
      VITE_CACHE_DIR: viteCacheDir,
    },
  },
});
