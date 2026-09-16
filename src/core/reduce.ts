/**
 * Fold the event log into the current shows (ADR-0007).
 *
 * `reduce` is a function of the event *set*: it dedupes by id, sorts by `(at, id)`, then folds.
 * Arrival order never matters, which is what makes "merge two devices" a plain union. Events
 * whose `kind` this build doesn't know are counted and skipped, never an error — an older build
 * must not corrupt data written by a newer one.
 *
 * Per-field last-writer-wins (ADR-0008) falls out of folding in total order: each `*-field-set`
 * touches one field, so independent edits to different fields both survive.
 */
import type { Choice, JsonRecord, ShowConfig, ShowNode } from "./config.ts";
import { normalizeNode } from "./config.ts";
import type { NodeField, ShowEvent, ShowField } from "./events.ts";
import { compareEvents } from "./events.ts";
import { orderKeys } from "./order.ts";

export interface NodeState {
  nodeKey: string;
  order: string;
  node: ShowNode;
}

export interface ShowState {
  showId: string;
  title: string;
  startNode: string;
  choiceDisplaySeconds?: number | undefined;
  masterVideoId?: string | undefined;
  /** Sorted by `(order, nodeKey)` — the order the show plays in. */
  nodes: NodeState[];
  deleted: boolean;
  /** The `at` of the newest event applied to this show; drives "last edited" in the UI. */
  updatedAt: string;
}

export interface ShowsState {
  /** Sorted by `updatedAt` descending, then `showId`, so the most recently edited show is first. */
  shows: ShowState[];
  /** Kinds this build didn't recognise, for a diagnostic — never an error. */
  unknownKinds: string[];
}

interface Working {
  showId: string;
  title: string;
  startNode: string;
  choiceDisplaySeconds: number | undefined;
  masterVideoId: string | undefined;
  nodes: Map<string, NodeState>;
  /** Removal wins over later field sets on that node (ADR-0008). */
  removed: Set<string>;
  deleted: boolean;
  updatedAt: string;
}

function emptyShow(showId: string): Working {
  return {
    showId,
    title: "",
    startNode: "",
    choiceDisplaySeconds: undefined,
    masterVideoId: undefined,
    nodes: new Map(),
    removed: new Set(),
    deleted: false,
    updatedAt: "",
  };
}

/** Deep-copy a node through the lenient normalizer, so state never aliases an event's payload
 * and a hand-written snapshot gets the same treatment as a loaded file. */
function cloneNode(node: unknown): ShowNode {
  return normalizeNode((node ?? {}) as JsonRecord);
}

function cloneChoices(choices: unknown): Choice[] {
  return cloneNode({ choices }).choices;
}

/**
 * Node keys for a snapshot, derived from the snapshot's own content so that the same snapshot
 * imported on two devices produces the same keys and later per-field edits line up. A node's
 * `id` is the natural handle (it's unique in any config that validates); duplicates and blanks
 * fall back to position.
 */
export function snapshotNodeKeys(config: ShowConfig): string[] {
  const seen = new Map<string, number>();
  return config.nodes.map((node, index) => {
    const base = node.id === "" ? `i:${String(index)}` : `n:${node.id}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}#${String(count)}`;
  });
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function applyShowField(show: Working, field: ShowField, value: unknown): void {
  switch (field) {
    case "title":
      show.title = str(value) ?? "";
      return;
    case "startNode":
      show.startNode = str(value) ?? "";
      return;
    case "masterVideoId":
      show.masterVideoId = str(value);
      return;
    case "choiceDisplaySeconds":
      show.choiceDisplaySeconds = num(value);
      return;
  }
}

function applyNodeField(entry: NodeState, field: NodeField, value: unknown): void {
  const node = entry.node;
  // Each field is cleared by name rather than through `node[field]`: an optional property under
  // `exactOptionalPropertyTypes` has to be removed, not set to undefined.
  switch (field) {
    case "order": {
      const order = str(value);
      if (order !== undefined && order !== "") entry.order = order;
      return;
    }
    case "id":
      node.id = str(value) ?? "";
      return;
    case "title":
      node.title = str(value) ?? "";
      return;
    case "videoId": {
      const s = str(value);
      if (s === undefined || s === "") delete node.videoId;
      else node.videoId = s;
      return;
    }
    case "returnTo": {
      const s = str(value);
      if (s === undefined || s === "") delete node.returnTo;
      else node.returnTo = s;
      return;
    }
    case "start": {
      const n = num(value);
      if (n === undefined) delete node.start;
      else node.start = n;
      return;
    }
    case "end": {
      const n = num(value);
      if (n === undefined) delete node.end;
      else node.end = n;
      return;
    }
    case "showChoicesAt": {
      const n = num(value);
      if (n === undefined) delete node.showChoicesAt;
      else node.showChoicesAt = n;
      return;
    }
    case "isAside":
      if (value === true) node.isAside = true;
      else delete node.isAside;
      return;
    case "defaultAside":
      if (value === true) node.defaultAside = true;
      else delete node.defaultAside;
      return;
    case "returnAtCurrentTime":
      if (value === true) node.returnAtCurrentTime = true;
      else delete node.returnAtCurrentTime;
      return;
    case "endScreen": {
      const normalized = cloneNode({ endScreen: value }).endScreen;
      if (normalized === undefined) delete node.endScreen;
      else node.endScreen = normalized;
      return;
    }
  }
}

function applySnapshot(show: Working, config: ShowConfig): void {
  show.title = config.title;
  show.startNode = config.startNode;
  show.choiceDisplaySeconds = config.choiceDisplaySeconds;
  show.masterVideoId = config.masterVideoId;
  show.nodes.clear();
  // A snapshot is the whole show, so it also clears the record of what was removed before it.
  show.removed.clear();
  const keys = snapshotNodeKeys(config);
  const orders = orderKeys(config.nodes.length);
  config.nodes.forEach((node, i) => {
    const nodeKey = keys[i] ?? `i:${String(i)}`;
    show.nodes.set(nodeKey, { nodeKey, order: orders[i] ?? "", node: cloneNode(node) });
  });
}

export function reduce(events: readonly ShowEvent[]): ShowsState {
  // Dedupe by id — a union merge may hand us the same event twice, and events are immutable, so
  // the first copy is as good as any.
  const byId = new Map<string, ShowEvent>();
  for (const e of events) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  const ordered = [...byId.values()].sort(compareEvents);

  const shows = new Map<string, Working>();
  const unknownKinds = new Set<string>();

  const showFor = (showId: string): Working => {
    let s = shows.get(showId);
    if (s === undefined) {
      s = emptyShow(showId);
      shows.set(showId, s);
    }
    return s;
  };

  for (const e of ordered) {
    const show = showFor(e.showId);
    switch (e.kind) {
      case "show-snapshot":
        applySnapshot(show, e.config);
        break;
      case "show-field-set":
        applyShowField(show, e.field, e.value);
        break;
      case "node-added": {
        // A re-add is a deliberate act, so it lifts an earlier removal of that key.
        show.removed.delete(e.nodeKey);
        show.nodes.set(e.nodeKey, {
          nodeKey: e.nodeKey,
          order: e.order,
          node: cloneNode(e.node),
        });
        break;
      }
      case "node-field-set": {
        if (show.removed.has(e.nodeKey)) break;
        const entry = show.nodes.get(e.nodeKey);
        if (entry !== undefined) applyNodeField(entry, e.field, e.value);
        break;
      }
      case "node-choices-set": {
        if (show.removed.has(e.nodeKey)) break;
        const entry = show.nodes.get(e.nodeKey);
        if (entry !== undefined) entry.node.choices = cloneChoices(e.choices);
        break;
      }
      case "node-removed":
        show.nodes.delete(e.nodeKey);
        show.removed.add(e.nodeKey);
        break;
      case "show-deleted":
        show.deleted = true;
        break;
      case "show-restored":
        show.deleted = false;
        break;
      default:
        unknownKinds.add((e as { kind: string }).kind);
        break;
    }
    if (e.at > show.updatedAt) show.updatedAt = e.at;
  }

  const out: ShowState[] = [...shows.values()].map((s) => ({
    showId: s.showId,
    title: s.title,
    startNode: s.startNode,
    ...(s.choiceDisplaySeconds !== undefined
      ? { choiceDisplaySeconds: s.choiceDisplaySeconds }
      : {}),
    ...(s.masterVideoId !== undefined ? { masterVideoId: s.masterVideoId } : {}),
    nodes: [...s.nodes.values()].sort(
      (a, b) =>
        (a.order < b.order ? -1 : a.order > b.order ? 1 : 0) ||
        (a.nodeKey < b.nodeKey ? -1 : a.nodeKey > b.nodeKey ? 1 : 0)
    ),
    deleted: s.deleted,
    updatedAt: s.updatedAt,
  }));

  out.sort(
    (a, b) =>
      (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0) ||
      (a.showId < b.showId ? -1 : a.showId > b.showId ? 1 : 0)
  );

  return { shows: out, unknownKinds: [...unknownKinds].sort() };
}

/** The publish-format config for a reduced show (ADR-0010) — what Studio, the Editor, the
 * validator and export all hand around. */
export function toConfig(show: ShowState): ShowConfig {
  const config: ShowConfig = {
    title: show.title,
    startNode: show.startNode,
    nodes: show.nodes.map((n) => n.node),
  };
  if (show.choiceDisplaySeconds !== undefined) {
    config.choiceDisplaySeconds = show.choiceDisplaySeconds;
  }
  if (show.masterVideoId !== undefined) config.masterVideoId = show.masterVideoId;
  return config;
}

/** Look one show up by id. */
export function findShow(state: ShowsState, showId: string): ShowState | undefined {
  return state.shows.find((s) => s.showId === showId);
}
