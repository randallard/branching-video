/**
 * The pre-event-log "Export All" backup (`bvp-backup`, ADR-0001) and its merge classification
 * (ADR-0002). Ported unchanged in slice 2; slice 3 replaces the merge with event import
 * (ADR-0007, ADR-0011) and this module shrinks to parsing old files.
 */
import { LEGACY_BACKUP_TYPE, isRecord } from "./config.ts";

export interface DraftEntry {
  slug: string;
  title: string;
  modified: number;
}

export interface LegacyBackup {
  type: typeof LEGACY_BACKUP_TYPE;
  version: 1;
  exportedAt: number;
  index: DraftEntry[];
  configs: Record<string, unknown>;
}

export interface Conflict {
  entry: DraftEntry;
  mine: DraftEntry;
  theirsConfig: unknown;
}

export interface Classification {
  fresh: DraftEntry[];
  identical: DraftEntry[];
  conflicts: Conflict[];
}

export type Resolution = "mine" | "theirs" | "both";

export function parseDraftEntry(v: unknown): DraftEntry | null {
  if (!isRecord(v) || typeof v["slug"] !== "string" || !v["slug"]) return null;
  return {
    slug: v["slug"],
    title: typeof v["title"] === "string" ? v["title"] : "",
    modified: typeof v["modified"] === "number" ? v["modified"] : 0,
  };
}

export function parseDraftIndex(raw: unknown): DraftEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(parseDraftEntry).filter((e): e is DraftEntry => e !== null);
}

/** `null` when the value is not a legacy backup bundle. */
export function parseLegacyBackup(raw: unknown): LegacyBackup | null {
  if (
    !isRecord(raw) ||
    raw["type"] !== LEGACY_BACKUP_TYPE ||
    !Array.isArray(raw["index"]) ||
    !isRecord(raw["configs"])
  ) {
    return null;
  }
  return {
    type: LEGACY_BACKUP_TYPE,
    version: 1,
    exportedAt: typeof raw["exportedAt"] === "number" ? raw["exportedAt"] : 0,
    index: parseDraftIndex(raw["index"]),
    configs: raw["configs"],
  };
}

export function buildLegacyBackup(
  index: readonly DraftEntry[],
  configs: Record<string, unknown>,
  exportedAt: number
): LegacyBackup {
  return { type: LEGACY_BACKUP_TYPE, version: 1, exportedAt, index: [...index], configs };
}

/**
 * Sort each incoming draft (ADR-0002): not present locally → fresh; present with a
 * byte-identical config (`JSON.stringify` equal) → identical; otherwise a conflict.
 * Entries whose config is missing from the bundle are skipped.
 */
export function classifyImport(
  bundle: LegacyBackup,
  localIndex: readonly DraftEntry[],
  localConfig: (slug: string) => unknown
): Classification {
  const bySlug = new Map(localIndex.map((e) => [e.slug, e]));
  const out: Classification = { fresh: [], identical: [], conflicts: [] };
  for (const e of bundle.index) {
    const theirs = bundle.configs[e.slug];
    if (theirs === undefined || theirs === null) continue;
    const mine = bySlug.get(e.slug);
    if (!mine) {
      out.fresh.push(e);
    } else if (JSON.stringify(localConfig(e.slug)) === JSON.stringify(theirs)) {
      out.identical.push(e);
    } else {
      out.conflicts.push({ entry: e, mine, theirsConfig: theirs });
    }
  }
  return out;
}

/** `<base>-imported`, then `<base>-imported-2`, … — the first slug not taken. */
export function importedSlug(base: string, taken: ReadonlySet<string>): string {
  let candidate = `${base}-imported`;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-imported-${String(n)}`;
    n++;
  }
  return candidate;
}
