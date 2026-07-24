import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

// vs-caos-editor (the vendored engine source, see ../../../CLAUDE.md) lives
// outside this pnpm workspace root as a sibling directory. The engine
// worker imports one caos-util file by deep relative path into it (see
// packages/engine/src/worker/caos.worker.ts's comment), so Vite's dev
// server needs filesystem access outside its default workspace-root
// boundary. Revisit once caos-kt/caos-util are consumed as normal
// published/vendored packages instead of a bring-up-phase link:.
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

export default defineConfig({
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
