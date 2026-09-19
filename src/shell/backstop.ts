/**
 * The unload backstop: edits not yet in IndexedDB, parked in `localStorage` as a page goes away.
 *
 * IndexedDB is asynchronous, and a closing tab doesn't wait for asynchronous work, so an edit
 * whose write is still pending when the page unloads can be lost. `localStorage` is synchronous
 * and does complete during `pagehide`. The next page to open the draft store replays what's parked
 * here through the ordinary diff, stamped with when the edit was made, so a replay can never
 * outrank an edit made after it, and replaying something that did land adds nothing.
 *
 * One key per session, so two tabs going away at once can't overwrite each other's edits.
 */
import type { ShowConfig } from "../core/config.ts";
import { isRecord, normalizeConfig } from "../core/config.ts";

export const BACKSTOP_PREFIX = "bvp:unsaved:";

export interface BackstopEntry {
  showId: string;
  nodeKeys: string[];
  config: ShowConfig;
  /** When the edit was made — the replay's timestamp. */
  at: string;
}

/** Park `entries` under this session's key, or clear it when there are none. Best effort: a full
 * or blocked `localStorage` must never break the page that is trying to save. */
export function writeBackstop(storage: Storage, sessionId: string, entries: readonly BackstopEntry[]): void {
  const key = BACKSTOP_PREFIX + sessionId;
  try {
    if (entries.length === 0) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(entries));
  } catch {
    // Nothing more a page can do while it is unloading.
  }
}

function parseEntry(v: unknown): BackstopEntry | null {
  if (!isRecord(v)) return null;
  const { showId, nodeKeys, at } = v;
  const config = normalizeConfig(v["config"]);
  if (typeof showId !== "string" || typeof at !== "string" || config === null) return null;
  if (!Array.isArray(nodeKeys) || !nodeKeys.every((k): k is string => typeof k === "string")) return null;
  if (nodeKeys.length !== config.nodes.length) return null;
  return { showId, nodeKeys, config, at };
}

/** Remove and return every session's parked edits, oldest first. Taking rather than reading means
 * two pages booting at once can't both replay the same entry. */
export function takeBackstop(storage: Storage): BackstopEntry[] {
  const keys: string[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(BACKSTOP_PREFIX)) keys.push(key);
    }
  } catch {
    return [];
  }
  const entries: BackstopEntry[] = [];
  for (const key of keys) {
    let raw: string | null;
    try {
      raw = storage.getItem(key);
      storage.removeItem(key);
    } catch {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw ?? "[]");
    } catch {
      continue;
    }
    if (!Array.isArray(parsed)) continue;
    for (const v of parsed) {
      const entry = parseEntry(v);
      if (entry) entries.push(entry);
    }
  }
  return entries.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}
