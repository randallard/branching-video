/**
 * Per-field value history (ADR-0023): for one field, what else it has been.
 *
 * Derived, never stored — built from the writes `reduce` reports as it folds, so it needs no event
 * kind, no migration and nothing in a bundle, and it agrees with the reducer by construction.
 * Recovering a value is an ordinary edit through the diff, so it lands here as one more write.
 */
import { canonicalJson } from "./canonical.ts";
import type { ShowEvent } from "./events.ts";
import type { FieldWrite, HistoryField } from "./reduce.ts";
import { reduce } from "./reduce.ts";

export interface FieldRef {
  showId: string;
  /** `null` for a show-level field. */
  nodeKey: string | null;
  field: HistoryField;
}

export type HistoryEntry = Pick<FieldWrite, "value" | "at" | "eventId" | "source">;

/** Every field's writes, oldest first, keyed by `historyKey`. */
export type FieldHistories = ReadonlyMap<string, readonly HistoryEntry[]>;

export function historyKey(ref: FieldRef): string {
  return JSON.stringify([ref.showId, ref.nodeKey, ref.field]);
}

export function buildHistories(events: readonly ShowEvent[]): FieldHistories {
  const out = new Map<string, HistoryEntry[]>();
  reduce(events, (w) => {
    const key = historyKey(w);
    let list = out.get(key);
    if (list === undefined) {
      list = [];
      out.set(key, list);
    }
    list.push({ value: w.value, at: w.at, eventId: w.eventId, source: w.source });
  });
  return out;
}

/** A value with nothing in it. Never offered for recovery: getting "nothing" back is clearing the
 * field, which needs no history — and listing it would put a badge on every field ever filled in. */
export function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    value === false ||
    (Array.isArray(value) && value.length === 0)
  );
}

/**
 * The values a field has held other than its current one, newest first, each listed once at the
 * last time it was written. The current value is the fold's last write — what the reducer holds.
 */
export function priorValues(entries: readonly HistoryEntry[]): HistoryEntry[] {
  const last = entries[entries.length - 1];
  if (last === undefined) return [];
  const current = canonicalJson(last.value);
  const seen = new Set<string>([current]);
  const out: HistoryEntry[] = [];
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry === undefined || isEmptyValue(entry.value)) continue;
    const key = canonicalJson(entry.value);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }
  return out;
}
