/**
 * The draft event model (ADR-0007, kinds per ADR-0008).
 *
 * Every change to a draft is an immutable event appended to the log. Nothing is ever edited or
 * deleted in place: the reducer folds the event *set* into the current shows, so merging two
 * devices is a union by event id and can only ever add.
 *
 * Envelope: `id` is globally unique and is the dedupe key; `at` is a UTC ISO timestamp; `v` is
 * the per-event schema version. `(at, id)` is a deterministic total order, so every device
 * holding the same events computes the same shows — that is what "last writer" means throughout.
 */
import type { Choice, ShowConfig, ShowNode } from "./config.ts";

interface EventBase {
  id: string;
  at: string;
  v: 1;
}

/** Show-level fields a `show-field-set` may carry (ADR-0008). */
export type ShowField = "title" | "startNode" | "masterVideoId" | "choiceDisplaySeconds";

/** Node-level fields a `node-field-set` may carry. `id` is in here because a node's id is an
 * ordinary editable field (ADR-0009) — `nodeKey` is the identity. `order` is the fractional
 * position key from `order.ts`. */
export type NodeField =
  | "id"
  | "title"
  | "videoId"
  | "start"
  | "end"
  | "showChoicesAt"
  | "isAside"
  | "defaultAside"
  | "returnAtCurrentTime"
  | "returnTo"
  | "endScreen"
  | "order";

/** What an event says, without the envelope — the part callers build and tests generate. */
export type ShowEventBody =
  /** Replaces the whole show as of its `(at, id)`. How legacy drafts, old backups and
   * single-show config files enter the log (ADR-0011). */
  | { kind: "show-snapshot"; showId: string; config: ShowConfig }
  | { kind: "show-field-set"; showId: string; field: ShowField; value: unknown }
  | { kind: "node-added"; showId: string; nodeKey: string; node: ShowNode; order: string }
  | { kind: "node-field-set"; showId: string; nodeKey: string; field: NodeField; value: unknown }
  /** Choices are short and edited as a list, so they move as one value (ADR-0008). */
  | { kind: "node-choices-set"; showId: string; nodeKey: string; choices: Choice[] }
  | { kind: "node-removed"; showId: string; nodeKey: string }
  | { kind: "show-deleted"; showId: string }
  | { kind: "show-restored"; showId: string };

export type ShowEvent = EventBase & ShowEventBody;

/** Deterministic total order: `at` first (ISO strings sort chronologically), `id` as tiebreak.
 * The reducer sorts internally, so it is a function of the event set — any permutation of the
 * same events folds to the same shows. */
export function compareEvents(a: ShowEvent, b: ShowEvent): number {
  if (a.at !== b.at) return a.at < b.at ? -1 : 1;
  if (a.id !== b.id) return a.id < b.id ? -1 : 1;
  return 0;
}

/** Envelope-deep check, used when reading events back from storage or a bundle. Kind-specific
 * payloads are deliberately not validated: the reducer already tolerates anything it doesn't
 * understand, and an over-strict gate here would reject events written by a newer build. */
export function isShowEvent(value: unknown): value is ShowEvent {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e["id"] === "string" &&
    typeof e["at"] === "string" &&
    typeof e["kind"] === "string" &&
    typeof e["v"] === "number" &&
    typeof e["showId"] === "string"
  );
}
