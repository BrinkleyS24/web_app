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
const playwrightPort = process.env.PLAYWRIGHT_PORT || "4178";
const playwrightBaseUrl = `http://127.0.0.1:${playwrightPort}`;

export default defineConfig({
  testDir: "./e2e",
  outputDir: playwrightOutputDir,
  timeout: 30_000,
  use: {
    baseURL: playwrightBaseUrl,
    headless: true,
  },
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${playwrightPort} --strictPort`,
    url: playwrightBaseUrl,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "true",
    env: {
      VITE_DEV_AUTH_BYPASS: "true",
      VITE_DEV_AUTH_EMAIL: "candidate@example.test",
      VITE_DEV_AUTH_UID: "playwright-premium-user",
      VITE_API_BASE_URL: "http://127.0.0.1:4010",
      VITE_CACHE_DIR: viteCacheDir,
    },
  },
});
