import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// vs-caos-editor (the vendored engine source, see ../../../CLAUDE.md) lives
// outside this pnpm workspace root as a sibling directory. @caos-cm6/engine
// depends on @creatures-lsp/caos-kt and @creatures-lsp/caos-util via
// pnpm's link: protocol (see packages/engine/package.json), which resolves
// to real files under vs-caos-editor/packages/*, so Vite's dev server
// needs filesystem access outside its default workspace-root boundary.
// Revisit once caos-kt/caos-util are consumed as normal published/vendored
// packages instead of a bring-up-phase link:.
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

// bench/index.html (plan/06-mobile-ux-and-performance.md's latency
// benchmark harness) is a second, standalone page alongside the main demo
// — Vite's dev server already resolves any *.html path directly with no
// config, this rollupOptions.input entry is only needed so `vite build`
// (a real multi-page build) emits it too instead of just the root page.
export default defineConfig({
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
