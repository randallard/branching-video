import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import { MANIFEST_FILE, buildManifest } from "./src/core/manifest.ts";

const root = import.meta.dirname;
const LIVE_DIR = resolve(root, "public/live");

// The five pages keep their published paths (ADR-0005): YouTube cards link to
// player.html#node and player.html?config=live/<show>.json.
const pages = ["index", "player", "studio", "editor", "create"];

function readLiveShows(): string {
  const files = readdirSync(LIVE_DIR).map((file) => ({
    file,
    text: file.endsWith(".json") ? readFileSync(resolve(LIVE_DIR, file), "utf8") : "",
  }));
  return JSON.stringify(buildManifest(files), null, 2) + "\n";
}

/** Serves live/manifest.json in dev and emits it at build, generated from public/live, so the
 * show list can't go stale (replaces the manual `pnpm manifest` step). */
function liveManifest(): Plugin {
  return {
    name: "branching-video:live-manifest",
    configureServer(server) {
      server.middlewares.use(`/live/${MANIFEST_FILE}`, (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(readLiveShows());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: `live/${MANIFEST_FILE}`, source: readLiveShows() });
    },
  };
}

export default defineConfig({
  // Relative asset URLs: every page sits at the site root, so "./" works under
  // https://<user>.github.io/<any-repo-name>/ — forks don't need to edit this.
  base: "./",
  // Multi-page, like GitHub Pages: an unknown path is a 404, never a fallback to index.html.
  appType: "mpa",
  plugins: [liveManifest()],
  server: { host: true, port: 8080, strictPort: true },
  preview: { host: true, port: 8080, strictPort: true },
  build: {
    rollupOptions: {
      input: Object.fromEntries(pages.map((p) => [p, resolve(root, `${p}.html`)])),
    },
  },
});
