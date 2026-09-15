/**
 * Local drafts in `localStorage` — the pre-event-log store (ADR-0001/0002). Slice 3 moves drafts
 * into the IndexedDB event log and migrates these keys once without deleting them (ADR-0011).
 * Until then every page reads and writes through here rather than touching the keys directly.
 */
import { parseDraftIndex } from "../core/legacy-backup.ts";
import type { DraftEntry } from "../core/legacy-backup.ts";

const INDEX_KEY = "bvp:index";
const CONFIG_PREFIX = "bvp:config:";
/** One config handed from one page to another (Studio → Editor, → Player). */
const TRANSFER_KEY = "bvp:transfer";
/** A draft slug the home page asks Studio to open. */
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

export function saveDraftIndex(entries: readonly DraftEntry[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function loadDraftConfig(slug: string): unknown {
  return parse(localStorage.getItem(CONFIG_PREFIX + slug));
}

/** The stored JSON text of a draft, unparsed — handed on verbatim by the home page. */
export function loadDraftConfigText(slug: string): string | null {
  return localStorage.getItem(CONFIG_PREFIX + slug);
}

export function saveDraftConfig(slug: string, config: unknown): void {
  localStorage.setItem(CONFIG_PREFIX + slug, JSON.stringify(config));
}

export function setTransfer(config: unknown): void {
  localStorage.setItem(TRANSFER_KEY, JSON.stringify(config));
}

export function setTransferText(text: string): void {
  localStorage.setItem(TRANSFER_KEY, text);
}

/** The last transferred config. Deliberately not removed: a reload of the receiving tab reads it
 * again, as it always has. */
export function getTransfer(): unknown {
  return parse(localStorage.getItem(TRANSFER_KEY));
}

export function setResume(slug: string): void {
  localStorage.setItem(RESUME_KEY, slug);
}

export function takeResume(): string | null {
  const slug = localStorage.getItem(RESUME_KEY);
  if (slug !== null) localStorage.removeItem(RESUME_KEY);
  return slug;
}
