/**
 * The URL fragment that names a draft when one page hands it to another (ADR-0029):
 * `editor.html#show=<showId>`, `studio.html#show=<showId>`. The id travels, never the config, so
 * the receiving page opens the show from the log instead of importing a possibly stale copy.
 */

const PREFIX = "#show=";

/** `#show=<showId>`, encoded so any id survives the round trip (legacy ids carry a `:`). */
export function showHash(showId: string): string {
  return PREFIX + encodeURIComponent(showId);
}

/** The show id a fragment names, or `null` when it names none. */
export function parseShowHash(hash: string): string | null {
  if (!hash.startsWith(PREFIX)) return null;
  let showId: string;
  try {
    showId = decodeURIComponent(hash.slice(PREFIX.length));
  } catch {
    return null;
  }
  return showId === "" ? null : showId;
}
