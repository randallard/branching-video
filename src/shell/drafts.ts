/**
 * What's left of the pre-event-log local drafts store (ADR-0001/0002) after slice 3b.3 wired every
 * page onto the IndexedDB event log. `bvp:index`/`bvp:config:*` are now read-only here — nothing
 * writes them any more, but `DraftStore`'s one-time migration (ADR-0011) still reads them so a
 * browser that had drafts before this slice doesn't lose them. `bvp:transfer`/`bvp:resume` are
 * unrelated to drafts and deliberately stay in `localStorage`: ephemeral page-to-page handoffs,
 * not state that needs to merge or survive.
 */
import { parseDraftIndex } from "../core/legacy-backup.ts";
import type { DraftEntry } from "../core/legacy-backup.ts";

const INDEX_KEY = "bvp:index";
const CONFIG_PREFIX = "bvp:config:";
/** One config handed from one page to another (Studio → Editor, → Player). */
const TRANSFER_KEY = "bvp:transfer";
/** A showId the home page asks Studio (or the Editor) to open (ADR-0009 — carried a slug before
 * slice 3b.3). */
const RESUME_KEY = "bvp:resume";

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

export function setResume(showId: string): void {
  localStorage.setItem(RESUME_KEY, showId);
}

export function takeResume(): string | null {
  const showId = localStorage.getItem(RESUME_KEY);
  if (showId !== null) localStorage.removeItem(RESUME_KEY);
  return showId;
}
