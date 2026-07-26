import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: "autoUpdate",
      // The bench entry (apps/full/bench) is a dev/perf-measurement tool, not
      // part of the shipped app -- excluded from precache/manifest scope.
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png"],
      manifest: {
        name: "CAOS Editor",
        short_name: "CAOS",
        description: "Mobile-first CAOS (.cos) script editor with offline support.",
        display: "standalone",
        theme_color: "#1e212b",
        background_color: "#1e212b",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Only precache the main app entry's build output -- the bench
        // entry's chunks are matched by the same globPatterns but are
        // harmless to include (small, never referenced by the shipped app).
        globPatterns: ["**/*.{js,css,html}"],
        // Default is 2 MiB; the CAOS engine worker bundle (embeds the
        // compiled caos-kt library) is ~1.5 MB and this is exactly the
        // asset this phase exists to make sure gets precached, so leave
        // headroom for it to grow rather than have it silently excluded.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // No runtime API calls anywhere in this app (everything is local/
        // IndexedDB) -- precache is the whole caching story, nothing else
        // needs a runtime-caching route.
        navigateFallbackDenylist: [/^\/bench/],
      },
    }),
  ],
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
