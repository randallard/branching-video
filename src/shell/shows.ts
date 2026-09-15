/** Published shows in `live/`, discovered through `live/manifest.json` (ADR-0005). */
import { MANIFEST_FILE, parseManifest } from "../core/manifest.ts";
import type { ManifestEntry } from "../core/manifest.ts";

export const SHOWS_DIR = "live/";

export async function fetchShows(): Promise<ManifestEntry[]> {
  const res = await fetch(SHOWS_DIR + MANIFEST_FILE);
  if (!res.ok) throw new Error(`${SHOWS_DIR}${MANIFEST_FILE}: HTTP ${String(res.status)}`);
  return parseManifest(await res.json());
}

/** Best-effort show title via YouTube's keyless, CORS-enabled oEmbed endpoint. */
export async function fetchVideoTitle(id: string): Promise<string | null> {
  try {
    const r = await fetch(
      "https://www.youtube.com/oembed?format=json&url=" +
        encodeURIComponent("https://www.youtube.com/watch?v=" + id)
    );
    if (!r.ok) return null;
    const body: unknown = await r.json();
    return typeof body === "object" && body !== null && "title" in body && typeof body.title === "string" && body.title
      ? body.title
      : null;
  } catch {
    return null;
  }
}
