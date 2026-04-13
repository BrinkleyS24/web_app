import os from "node:os";
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const cacheRoot = process.env.LOCALAPPDATA || os.tmpdir();
const defaultViteCacheDir = path.join(cacheRoot, "applendium-web", "vite-cache");

export default defineConfig({
  cacheDir: process.env.VITE_CACHE_DIR || defaultViteCacheDir,
  plugins: [react(), tailwindcss()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true,
    css: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "esnext",
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});
