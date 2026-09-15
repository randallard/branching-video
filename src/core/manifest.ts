/**
 * `live/manifest.json` — the list of published shows the home page and Editor's Configs menu
 * read. Generated from `public/live/*.json` by the Vite plugin in `vite.config.ts`, in dev and
 * at build, so it can't go stale (replaces the manual `pnpm manifest` step; ADR-0005).
 */
import { isRecord } from "./config.ts";

export const MANIFEST_FILE = "manifest.json";

export interface ManifestEntry {
  file: string;
  title: string;
}

/** Title from the config's `title` when it is a non-blank string, else the filename. */
export function manifestTitle(file: string, text: string): string {
  try {
    const cfg: unknown = JSON.parse(text);
    if (isRecord(cfg) && typeof cfg["title"] === "string" && cfg["title"].trim()) {
      return cfg["title"];
    }
  } catch {
    // keep the filename as the title
  }
  return file;
}

export function buildManifest(
  files: readonly { file: string; text: string }[]
): ManifestEntry[] {
  return files
    .filter((f) => f.file.endsWith(".json") && f.file !== MANIFEST_FILE)
    .map((f) => ({ file: f.file, title: manifestTitle(f.file, f.text) }))
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
}

/** Parse a fetched manifest, keeping only well-formed entries. */
export function parseManifest(raw: unknown): ManifestEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: ManifestEntry[] = [];
  for (const e of raw) {
    if (isRecord(e) && typeof e["file"] === "string") {
      out.push({
        file: e["file"],
        title: typeof e["title"] === "string" ? e["title"] : e["file"],
      });
    }
  }
  return out;
}
