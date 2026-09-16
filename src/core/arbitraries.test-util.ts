/** fast-check generators for show configs, shared by the core property tests. */
import fc from "fast-check";
import type { Choice, EndLink, ShowConfig, ShowNode } from "./config.ts";
import type { NodeField, ShowEvent, ShowEventBody, ShowField } from "./events.ts";

const nodeId = fc.constantFrom("intro", "a", "b", "c", "aside", "end");
const text = fc.string({ maxLength: 12 });
const seconds = fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true });

const choice: fc.Arbitrary<Choice> = fc.record(
  {
    label: text,
    target: fc.oneof(nodeId, fc.constant("")),
    default: fc.constant(true),
    style: fc.constantFrom("primary", "secondary", "loud"),
  },
  { requiredKeys: ["label", "target"] }
);

const link: fc.Arbitrary<EndLink> = fc.record(
  { label: text, target: nodeId, url: fc.constant("https://example.com") },
  { requiredKeys: ["label"] }
);

const node: fc.Arbitrary<ShowNode> = fc.record(
  {
    id: nodeId,
    title: text,
    videoId: fc.constant("dQw4w9WgXcQ"),
    start: seconds,
    end: seconds,
    showChoicesAt: seconds,
    isAside: fc.constant(true),
    defaultAside: fc.constant(true),
    returnAtCurrentTime: fc.constant(true),
    returnTo: nodeId,
    endScreen: fc.record(
      { heading: text, body: text, links: fc.array(link, { maxLength: 3 }) },
      { requiredKeys: ["links"] }
    ),
    choices: fc.array(choice, { maxLength: 3 }),
  },
  { requiredKeys: ["id", "title", "choices"] }
);

export const arbitraryConfig: fc.Arbitrary<ShowConfig> = fc.record(
  {
    title: text,
    startNode: fc.oneof(nodeId, fc.constant("")),
    choiceDisplaySeconds: fc.integer({ min: 0, max: 60 }),
    masterVideoId: fc.constant("Jvu5VZVe3MI"),
    nodes: fc.array(node, { maxLength: 6 }),
  },
  { requiredKeys: ["title", "startNode", "nodes"] }
);

// ── Event-log generators (ADR-0008) ───────────────

const showId = fc.constantFrom("s1", "s2", "s3");
const nodeKey = fc.constantFrom("k1", "k2", "k3");
const order = fc.constantFrom("V", "k", "s", "Vk", "ks");
const showField: fc.Arbitrary<ShowField> = fc.constantFrom(
  "title",
  "startNode",
  "masterVideoId",
  "choiceDisplaySeconds"
);
const nodeField: fc.Arbitrary<NodeField> = fc.constantFrom(
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
  "endScreen",
  "order"
);
/** Deliberately loose: a field-set value can be the wrong type, and the reducer must cope. */
const fieldValue = fc.oneof(text, seconds, fc.boolean(), fc.constant(null), fc.constant("V"));

/** Distinct ISO timestamps, so `(at, id)` ordering is exercised both ways. */
const at = fc.constantFrom(
  "2026-09-01T00:00:00.000Z",
  "2026-09-02T00:00:00.000Z",
  "2026-09-03T00:00:00.000Z"
);

const body: fc.Arbitrary<ShowEventBody> = fc.oneof<fc.Arbitrary<ShowEventBody>[]>(
  fc.record({ kind: fc.constant("show-snapshot" as const), showId, config: arbitraryConfig }),
  fc.record({
    kind: fc.constant("show-field-set" as const),
    showId,
    field: showField,
    value: fieldValue,
  }),
  fc.record({
    kind: fc.constant("node-added" as const),
    showId,
    nodeKey,
    node,
    order,
  }),
  fc.record({
    kind: fc.constant("node-field-set" as const),
    showId,
    nodeKey,
    field: nodeField,
    value: fieldValue,
  }),
  fc.record({
    kind: fc.constant("node-choices-set" as const),
    showId,
    nodeKey,
    choices: fc.array(choice, { maxLength: 3 }),
  }),
  fc.record({ kind: fc.constant("node-removed" as const), showId, nodeKey }),
  fc.record({ kind: fc.constant("show-deleted" as const), showId }),
  fc.record({ kind: fc.constant("show-restored" as const), showId })
);

/** A set of events with unique ids — the shape the reducer is specified against. */
export const arbitraryEvents: fc.Arbitrary<ShowEvent[]> = fc
  .array(fc.tuple(at, body), { maxLength: 12 })
  .map((rows) =>
    rows.map(([eventAt, rest], i) => ({ id: `e${String(i)}`, at: eventAt, v: 1 as const, ...rest }))
  );
