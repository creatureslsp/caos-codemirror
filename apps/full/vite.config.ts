import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
export default defineConfig({
  plugins: [preact()],
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        bench: fileURLToPath(new URL("./bench/index.html", import.meta.url)),
      },
    },
  },
});
