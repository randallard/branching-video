/**
 * What's left of the pre-event-log local drafts store (ADR-0001/0002) after slice 3b.3 wired every
 * page onto the IndexedDB event log. `bvp:index`/`bvp:config:*` are now read-only here — nothing
 * writes them any more, but `DraftStore`'s one-time migration (ADR-0011) still reads them so a
 * browser that had drafts before this slice doesn't lose them. `bvp:transfer` is unrelated to
 * drafts and deliberately stays in `localStorage`: an ephemeral handoff to the Player, not state
 * that needs to merge or survive. Handoffs between Studio, the Editor and the home page carry the
 * show id in the URL instead (ADR-0029), which retired `bvp:resume`.
 */
import { parseDraftIndex } from "../core/legacy-backup.ts";
import type { DraftEntry } from "../core/legacy-backup.ts";

const INDEX_KEY = "bvp:index";
const CONFIG_PREFIX = "bvp:config:";
/** One config handed to the Player to play (never imported — ADR-0029). */
const TRANSFER_KEY = "bvp:transfer";

function parse(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function loadDraftIndex(): DraftEntry[] {
  return parseDraftIndex(parse(localStorage.getItem(INDEX_KEY)));
}

export function loadDraftConfig(slug: string): unknown {
  return parse(localStorage.getItem(CONFIG_PREFIX + slug));
}

export function setTransfer(config: unknown): void {
  localStorage.setItem(TRANSFER_KEY, JSON.stringify(config));
}

/** The last transferred config. Deliberately not removed: a reload of the receiving tab reads it
 * again, as it always has. */
export function getTransfer(): unknown {
  return parse(localStorage.getItem(TRANSFER_KEY));
}
