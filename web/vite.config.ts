import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAW_CSS_PREFIX = "\0raw-css:";
let rawCssCounter = 0;
const rawCssFiles = new Map<string, string>();

function rawText() {
  return {
    name: "raw-text",
    enforce: "pre" as const,
    resolveId(source: string, importer: string | undefined) {
      if (source.endsWith("?raw")) {
        const clean = source.replace("?raw", "");
        const absolute = importer ? resolve(importer, "..", clean) : resolve(clean);
        const id = `${RAW_CSS_PREFIX}${rawCssCounter++}`;
        rawCssFiles.set(id, absolute);
        return { id, external: false };
      }
    },
    load(id: string) {
      const file = rawCssFiles.get(id);
      if (file) {
        return `export default ${JSON.stringify(readFileSync(file, "utf-8"))};`;
      }
    },
  };
}

// The build. Everything about the *test* run -- the environment, what counts as
// a unit test, and since 015 US2 the coverage the `unit` gate measures over
// `src/` -- lives in `vitest.config.ts`, which imports this file and merges its
// own `test` block onto it. One `test` block, in the file the spec names.
export default defineConfig({
  plugins: [react(), rawText()],
});
