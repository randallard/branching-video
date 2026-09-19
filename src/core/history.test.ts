import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { canonicalJson } from "./canonical.ts";
import type { ShowConfig } from "./config.ts";
import { diffShow, workingFromState } from "./diff.ts";
import type { ShowEvent } from "./events.ts";
import { buildHistories, historyKey, isEmptyValue, priorValues } from "./history.ts";
import type { FieldRef } from "./history.ts";
import { findShow, reduce, toConfig } from "./reduce.ts";
import type { HistoryField } from "./reduce.ts";
import { arbitraryEvents } from "./arbitraries.test-util.ts";

const SHOW_FIELDS = ["title", "startNode", "masterVideoId", "choiceDisplaySeconds"] as const;
const NODE_FIELDS = [
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
  "choices",
] as const;

const T1 = "2026-09-15T10:00:00.000Z";
const T2 = "2026-09-15T11:00:00.000Z";
const T3 = "2026-09-15T12:00:00.000Z";
const T4 = "2026-09-15T13:00:00.000Z";

function entries(events: readonly ShowEvent[], ref: FieldRef) {
  return buildHistories(events).get(historyKey(ref)) ?? [];
}

function prior(events: readonly ShowEvent[], showId: string, nodeKey: string | null, field: HistoryField) {
  return priorValues(entries(events, { showId, nodeKey, field })).map((e) => e.value);
}

const base: ShowConfig = {
  title: "Ukulele",
  startNode: "intro",
  nodes: [{ id: "intro", title: "Intro", start: 0, choices: [] }],
};

const snapshot = (at: string, config: ShowConfig = base): ShowEvent => ({
  id: `snap-${at}`,
  at,
  v: 1,
  kind: "show-snapshot",
  showId: "s",
  config,
});

describe("buildHistories", () => {
  it("ends every field's history on the value the reducer holds", () => {
    // The history observes the reducer's own fold, so the two can never disagree on who won.
    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        const histories = buildHistories(events);
        for (const show of reduce(events).shows) {
          for (const field of SHOW_FIELDS) {
            const list = histories.get(historyKey({ showId: show.showId, nodeKey: null, field }));
            const last = list?.[list.length - 1];
            if (last !== undefined) expect(canonicalJson(last.value)).toBe(canonicalJson(show[field]));
          }
          for (const { nodeKey, node } of show.nodes) {
            for (const field of NODE_FIELDS) {
              const list = histories.get(historyKey({ showId: show.showId, nodeKey, field }));
              // Every node in the state arrived by a snapshot or an add, both of which write every field.
              expect(list).toBeDefined();
              const last = list?.[list.length - 1];
              expect(canonicalJson(last?.value)).toBe(canonicalJson(node[field]));
            }
          }
        }
      })
    );
  });

  it("is a function of the event set, like the reducer", () => {
    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        const forward = buildHistories(events);
        expect(buildHistories([...events].reverse())).toEqual(forward);
        expect(buildHistories([...events, ...events])).toEqual(forward);
      })
    );
  });
});

describe("priorValues", () => {
  it("never offers the current value, an empty value, or the same value twice", () => {
    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        for (const list of buildHistories(events).values()) {
          const current = canonicalJson(list[list.length - 1]?.value);
          const offered = priorValues(list).map((e) => canonicalJson(e.value));
          expect(offered).not.toContain(current);
          expect(new Set(offered).size).toBe(offered.length);
          for (const e of priorValues(list)) expect(isEmptyValue(e.value)).toBe(false);
        }
      })
    );
  });

  it("lists newest first, each value at the last time it was written", () => {
    const events: ShowEvent[] = [
      snapshot(T1),
      { id: "a", at: T2, v: 1, kind: "show-field-set", showId: "s", field: "title", value: "Uke" },
      { id: "b", at: T3, v: 1, kind: "show-field-set", showId: "s", field: "title", value: "Ukulele" },
      { id: "c", at: T4, v: 1, kind: "show-field-set", showId: "s", field: "title", value: "Uke theory" },
    ];
    const list = priorValues(entries(events, { showId: "s", nodeKey: null, field: "title" }));
    expect(list.map((e) => [e.value, e.at, e.source])).toEqual([
      ["Ukulele", T3, "edit"],
      ["Uke", T2, "edit"],
    ]);
  });
});

describe("ADR-0023 recovery", () => {
  it("keeps the losing side of a two-device edit recoverable", () => {
    // The phone renamed the node, the laptop renamed it later; the laptop wins (ADR-0008), and the
    // phone's value is still there to get back.
    const phone: ShowEvent = {
      id: "phone",
      at: T2,
      v: 1,
      kind: "node-field-set",
      showId: "s",
      nodeKey: "n:intro",
      field: "title",
      value: "Welcome",
    };
    const laptop: ShowEvent = { ...phone, id: "laptop", at: T3, value: "Opening" };
    const events = [snapshot(T1), laptop, phone];

    expect(findShow(reduce(events), "s")?.nodes[0]?.node.title).toBe("Opening");
    expect(prior(events, "s", "n:intro", "title")).toEqual(["Welcome", "Intro"]);
  });

  it("recovers by an ordinary edit, and the displaced value joins the history", () => {
    const events: ShowEvent[] = [
      snapshot(T1),
      { id: "a", at: T2, v: 1, kind: "show-field-set", showId: "s", field: "title", value: "Renamed" },
    ];
    const show = findShow(reduce(events), "s");
    if (!show) throw new Error("show missing");
    const config = toConfig(show);
    config.title = "Ukulele";

    let n = 0;
    const recovery = diffShow(show, workingFromState(show, config), {
      at: T3,
      newEventId: () => `r${String(n++)}`,
      newNodeKey: () => "unused",
    });
    expect(recovery.map((e) => e.kind)).toEqual(["show-field-set"]);

    const after = [...events, ...recovery];
    expect(findShow(reduce(after), "s")?.title).toBe("Ukulele");
    expect(prior(after, "s", null, "title")).toEqual(["Renamed"]);
  });

  it("does not list an edit the reducer discarded because the node was removed", () => {
    const events: ShowEvent[] = [
      snapshot(T1),
      { id: "rm", at: T2, v: 1, kind: "node-removed", showId: "s", nodeKey: "n:intro" },
      {
        id: "late",
        at: T3,
        v: 1,
        kind: "node-field-set",
        showId: "s",
        nodeKey: "n:intro",
        field: "title",
        value: "Lost",
      },
    ];
    expect(entries(events, { showId: "s", nodeKey: "n:intro", field: "title" }).map((e) => e.value)).toEqual([
      "Intro",
    ]);
  });

  it("tracks choices as one value, and attributes an import to the import", () => {
    const choices = [{ label: "Go", target: "intro" }];
    const events: ShowEvent[] = [
      snapshot(T1, { ...base, nodes: [{ id: "intro", title: "Intro", choices }] }),
      { id: "c", at: T2, v: 1, kind: "node-choices-set", showId: "s", nodeKey: "n:intro", choices: [] },
    ];
    const list = priorValues(entries(events, { showId: "s", nodeKey: "n:intro", field: "choices" }));
    expect(list.map((e) => [e.value, e.source])).toEqual([[choices, "import"]]);
  });

  it("does not badge a field just because it started empty", () => {
    const events: ShowEvent[] = [
      {
        id: "add",
        at: T1,
        v: 1,
        kind: "node-added",
        showId: "s",
        nodeKey: "k",
        node: { id: "n", title: "", choices: [] },
        order: "V",
      },
      { id: "t", at: T2, v: 1, kind: "node-field-set", showId: "s", nodeKey: "k", field: "title", value: "Named" },
    ];
    expect(prior(events, "s", "k", "title")).toEqual([]);
  });
});
