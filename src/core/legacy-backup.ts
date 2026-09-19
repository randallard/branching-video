/**
 * Parsing the pre-event-log "Export All" backup (`bvp-backup`, ADR-0001). Its merge classification
 * (ADR-0002) retired in slice 3b.3: `DraftStore.importLegacyBackup` turns a parsed backup straight
 * into snapshot events (ADR-0011) instead, so there's nothing left to classify or resolve — this
 * module is parsing only.
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

