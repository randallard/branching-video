/**
 * Turning an edited config back into events (ADR-0008).
 *
 * Studio and the Editor both hold a whole `ShowConfig` and serialize it on every autosave. Writing
 * that straight into the log as a snapshot would work, and would also throw away the reason the
 * log exists: two devices' snapshots can only merge by picking one, so editing node timings on a
 * phone and choice labels on a laptop loses one side. Emitting one event per *changed field* is
 * what lets both survive.
 *
 * It is also the coalescing ADR-0007 asks for. A diff taken when the editor saves produces one
 * event per field that actually moved, not one per keystroke.
 *
 * Nodes are matched by `nodeKey`, which a config does not carry — so a page edits a `WorkingShow`,
 * the config plus a positionally-aligned key list. That list is how a *rename* stays a rename: the
 * key is unchanged while the node's `id` field changes, rather than looking like a delete and an
 * add.
 */
import type { ShowConfig, ShowNode } from "./config.ts";
import { canonicalJson } from "./canonical.ts";
import type { ShowEvent, ShowEventBody, ShowField } from "./events.ts";
import { orderBetween } from "./order.ts";
import type { ShowState } from "./reduce.ts";

/** A config being edited, with the key of each node as it was loaded. `null` marks a node the
 * page has added since, which has no key until the diff gives it one. */
export interface WorkingShow {
  showId: string;
  config: ShowConfig;
  nodeKeys: (string | null)[];
}

/** The impure bits, injected so the core stays pure and the tests stay deterministic. */
export interface DiffContext {
  /** UTC ISO timestamp for every event in this batch. */
  at: string;
  newEventId: () => string;
  newNodeKey: () => string;
}

/** Hand a reduced show to a page for editing. */
export function workingFromState(show: ShowState, config: ShowConfig): WorkingShow {
  return { showId: show.showId, config, nodeKeys: show.nodes.map((n) => n.nodeKey) };
}

/** A show that isn't in the log yet, so a new show diffs as "everything changed". */
export function emptyShowState(showId: string): ShowState {
  return { showId, title: "", startNode: "", nodes: [], deleted: false, updatedAt: "" };
}

const SHOW_FIELDS = ["title", "startNode", "masterVideoId", "choiceDisplaySeconds"] as const;

/** Node fields compared one by one. `endScreen` and `choices` are compared structurally instead. */
const SCALAR_NODE_FIELDS = [
  "id",
  "title",
  "videoId",
  "start",
  "end",
  "showChoicesAt",
  "isAside",
  "defaultAside",
  "returnAtCurrentTime",
  "returnTo",
] as const;

function showValue(config: ShowConfig, field: ShowField): unknown {
  return config[field];
}

function stateShowValue(show: ShowState, field: ShowField): unknown {
  return show[field];
}

function same(a: unknown, b: unknown): boolean {
  return a === b || canonicalJson(a) === canonicalJson(b);
}

/** An absent value has to travel as `null`: `undefined` does not survive JSON, and the reducer
 * reads "not a usable value" as "clear this field". */
function payload(value: unknown): unknown {
  return value ?? null;
}

/** One node's existing order key, with the working state of the longest-run search. */
interface Anchor {
  index: number;
  order: string;
  run: number;
  from: number;
}

/**
 * The positions whose existing order key can be kept: the longest run of them that is already in
 * ascending sequence. Everything else gets a new key, and `n - run` is the fewest keys any correct
 * assignment can rewrite — so moving one node emits one order event rather than renumbering the
 * list behind it.
 */
function keepableOrders(existing: (string | undefined)[]): Set<number> {
  const anchors: Anchor[] = [];
  existing.forEach((order, index) => {
    if (order !== undefined && order !== "") anchors.push({ index, order, run: 1, from: -1 });
  });

  let best: Anchor | undefined;
  for (let i = 0; i < anchors.length; i++) {
    const here = anchors[i];
    if (here === undefined) continue;
    for (let j = 0; j < i; j++) {
      const prior = anchors[j];
      if (prior === undefined) continue;
      if (prior.order < here.order && prior.run + 1 > here.run) {
        here.run = prior.run + 1;
        here.from = j;
      }
    }
    if (best === undefined || here.run > best.run) best = here;
  }

  const keep = new Set<number>();
  let cursor = best;
  while (cursor !== undefined) {
    keep.add(cursor.index);
    cursor = cursor.from === -1 ? undefined : anchors[cursor.from];
  }
  return keep;
}

/** Order keys for the edited node list, reusing each node's existing key wherever the list is
 * still in sequence, so moving one node doesn't rewrite every other node's order. */
function assignOrders(existing: (string | undefined)[]): string[] {
  const keep = keepableOrders(existing);
  const out: string[] = [];
  let prev: string | null = null;
  for (let i = 0; i < existing.length; i++) {
    const current = existing[i];
    if (keep.has(i) && current !== undefined) {
      out.push(current);
      prev = current;
      continue;
    }
    // Fit underneath the next key we are keeping, so the run we kept stays where it is.
    let next: string | null = null;
    for (let j = i + 1; j < existing.length; j++) {
      const candidate = existing[j];
      if (keep.has(j) && candidate !== undefined) {
        next = candidate;
        break;
      }
    }
    const fresh = orderBetween(prev, next);
    out.push(fresh);
    prev = fresh;
  }
  return out;
}

/**
 * The events that turn `before` into `after`. Empty when nothing changed, which is what makes it
 * safe to call on every autosave.
 */
export function diffShow(before: ShowState, after: WorkingShow, ctx: DiffContext): ShowEvent[] {
  const events: ShowEvent[] = [];
  const { showId } = after;
  const emit = (body: ShowEventBody): void => {
    events.push({ id: ctx.newEventId(), at: ctx.at, v: 1, ...body });
  };

  for (const field of SHOW_FIELDS) {
    const next = showValue(after.config, field);
    if (!same(stateShowValue(before, field), next)) {
      emit({ kind: "show-field-set", showId, field, value: payload(next) });
    }
  }

  const beforeByKey = new Map(before.nodes.map((n) => [n.nodeKey, n]));
  const nodes = after.config.nodes;

  // Resolve every edited node to a key first, so orders and removals see the final picture.
  const keys = nodes.map((_, i) => after.nodeKeys[i] ?? ctx.newNodeKey());
  const orders = assignOrders(keys.map((key) => beforeByKey.get(key)?.order));

  nodes.forEach((node: ShowNode, i) => {
    const key = keys[i] ?? ctx.newNodeKey();
    const order = orders[i] ?? "";
    const previous = beforeByKey.get(key);

    if (previous === undefined) {
      // New to the log, or a key the log has since removed — either way, an add.
      emit({ kind: "node-added", showId, nodeKey: key, node, order });
      return;
    }

    for (const field of SCALAR_NODE_FIELDS) {
      const next = node[field];
      if (!same(previous.node[field], next)) {
        emit({ kind: "node-field-set", showId, nodeKey: key, field, value: payload(next) });
      }
    }
    if (!same(previous.node.endScreen, node.endScreen)) {
      emit({
        kind: "node-field-set",
        showId,
        nodeKey: key,
        field: "endScreen",
        value: payload(node.endScreen),
      });
    }
    if (!same(previous.node.choices, node.choices)) {
      emit({ kind: "node-choices-set", showId, nodeKey: key, choices: node.choices });
    }
    if (previous.order !== order) {
      emit({ kind: "node-field-set", showId, nodeKey: key, field: "order", value: order });
    }
  });

  const kept = new Set(keys);
  for (const previous of before.nodes) {
    if (!kept.has(previous.nodeKey)) {
      emit({ kind: "node-removed", showId, nodeKey: previous.nodeKey });
    }
  }

  return events;
}
