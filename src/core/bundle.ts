/**
 * The event bundle: what Export All writes and Import All reads (ADR-0007).
 *
 * Because the log is append-only and `reduce` is a function of the event set, merging a bundle is
 * a union by event id. There is no conflict to resolve and nothing to choose between — importing
 * can add events, never remove them. That is what retires the keep-mine/keep-backup/keep-both
 * screen from ADR-0002, and why any transport works: a download, a USB stick, email to yourself.
 */
import type { ShowEvent } from "./events.ts";
import { compareEvents, isShowEvent } from "./events.ts";

export const BUNDLE_FORMAT = "branching-video-events";
export const BUNDLE_VERSION = 1;

export interface EventBundle {
  format: typeof BUNDLE_FORMAT;
  /** The envelope's version, distinct from each event's own `v`. */
  bundleVersion: typeof BUNDLE_VERSION;
  exportedAt: string;
  events: ShowEvent[];
}

/** Union by event id — first copy wins, since events are immutable and a repeated id is the same
 * event — returned in the `(at, id)` total order. */
export function unionEvents(...sets: readonly (readonly ShowEvent[])[]): ShowEvent[] {
  const byId = new Map<string, ShowEvent>();
  for (const set of sets) {
    for (const e of set) {
      if (!byId.has(e.id)) byId.set(e.id, e);
    }
  }
  return [...byId.values()].sort(compareEvents);
}

/** Bundle JSON. Deterministic for a given event set and `exportedAt` — events are deduped and
 * sorted — so two exports of the same log diff clean. The clock is the caller's: the core never
 * reads it. */
export function serializeBundle(events: readonly ShowEvent[], exportedAt: string): string {
  const bundle: EventBundle = {
    format: BUNDLE_FORMAT,
    bundleVersion: BUNDLE_VERSION,
    exportedAt,
    events: unionEvents(events),
  };
  return JSON.stringify(bundle, null, 2);
}

export function isEventBundle(raw: unknown): boolean {
  return (
    typeof raw === "object" &&
    raw !== null &&
    (raw as Record<string, unknown>)["format"] === BUNDLE_FORMAT
  );
}

/**
 * Events out of bundle JSON, deduped and sorted. Throws with a readable reason when the envelope
 * is wrong.
 *
 * Validation is envelope-deep only: an entry needs the common event shape, but its payload is not
 * schema-checked. The reducer is already defensive about kinds and missing targets, and a bundle
 * from a newer build should import rather than be rejected wholesale.
 */
export function parseBundle(raw: unknown): ShowEvent[] {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Not a Branching Video backup: expected a JSON object.");
  }
  const bundle = raw as Record<string, unknown>;
  if (bundle["format"] !== BUNDLE_FORMAT) {
    throw new Error(
      `Not a Branching Video event backup (format is ${JSON.stringify(bundle["format"])}).`
    );
  }
  const version = bundle["bundleVersion"];
  if (typeof version !== "number" || version > BUNDLE_VERSION) {
    throw new Error(
      `This backup was written by a newer version of Branching Video (bundle version ${String(
        version
      )}). Update the app and try again.`
    );
  }
  const events = bundle["events"];
  if (!Array.isArray(events)) {
    throw new Error("Backup is missing its `events` array.");
  }
  return unionEvents(events.filter(isShowEvent));
}
