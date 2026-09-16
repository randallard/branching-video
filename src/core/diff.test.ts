import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { ShowConfig } from "./config.ts";
import { diffShow, emptyShowState, workingFromState } from "./diff.ts";
import type { WorkingShow } from "./diff.ts";
import type { ShowEvent } from "./events.ts";
import { findShow, reduce, toConfig } from "./reduce.ts";
import { unionEvents } from "./bundle.ts";
import { arbitraryConfig } from "./arbitraries.test-util.ts";

const SHOW = "s";

/** Deterministic id/key generators, so a diff is reproducible in a test. */
function context(at: string, tag = "e") {
  let n = 0;
  let k = 0;
  return {
    at,
    newEventId: () => `${tag}${String(n++)}`,
    newNodeKey: () => `${tag}k${String(k++)}`,
  };
}

/** Apply a config to an (initially empty) log the way a page would: diff, then append. */
function save(events: readonly ShowEvent[], config: ShowConfig, at: string, tag = "e"): ShowEvent[] {
  const state = findShow(reduce(events), SHOW) ?? emptyShowState(SHOW);
  const working: WorkingShow = { showId: SHOW, config, nodeKeys: state.nodes.map((n) => n.nodeKey) };
  return [...events, ...diffShow(state, working, context(at, tag))];
}

describe("diffShow", () => {
  it("round-trips any config through a diff", () => {
    // The property the pages depend on: save what's on screen, reduce, get it back.
    fc.assert(
      fc.property(arbitraryConfig, (config) => {
        const events = save([], config, "2026-09-15T00:00:00.000Z");
        const show = findShow(reduce(events), SHOW);
        expect(show).toBeDefined();
        expect(toConfig(show!)).toEqual(config);
      })
    );
  });

  it("round-trips an edit applied on top of an existing show", () => {
    fc.assert(
      fc.property(arbitraryConfig, arbitraryConfig, (first, second) => {
        const afterFirst = save([], first, "2026-09-15T00:00:00.000Z", "a");
        const afterSecond = save(afterFirst, second, "2026-09-16T00:00:00.000Z", "b");
        expect(toConfig(findShow(reduce(afterSecond), SHOW)!)).toEqual(second);
      })
    );
  });

  it("emits nothing when nothing changed", () => {
    // Called on every autosave, so a no-op edit must not grow the log.
    fc.assert(
      fc.property(arbitraryConfig, (config) => {
        const events = save([], config, "2026-09-15T00:00:00.000Z");
        const unchanged = save(events, config, "2026-09-16T00:00:00.000Z", "b");
        expect(unchanged).toHaveLength(events.length);
      })
    );
  });

  it("keeps a rename a rename, not a delete and an add", () => {
    const before: ShowConfig = {
      title: "T",
      startNode: "intro",
      nodes: [{ id: "intro", title: "Intro", choices: [] }],
    };
    const events = save([], before, "2026-09-15T00:00:00.000Z");
    const renamed: ShowConfig = {
      ...before,
      nodes: [{ id: "opening", title: "Intro", choices: [] }],
    };
    const after = save(events, renamed, "2026-09-16T00:00:00.000Z", "b");

    const emitted = after.slice(events.length);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.kind).toBe("node-field-set");
    // The key is untouched; only the id field moved.
    const show = findShow(reduce(after), SHOW);
    expect(show?.nodes).toHaveLength(1);
    expect(show?.nodes[0]?.nodeKey).toBe(findShow(reduce(events), SHOW)?.nodes[0]?.nodeKey);
  });

  it("lets two devices edit different fields of the same node and keeps both", () => {
    // The whole reason ADR-0008 wanted diffs instead of snapshots.
    const base: ShowConfig = {
      title: "Show",
      startNode: "intro",
      nodes: [{ id: "intro", title: "Intro", start: 0, end: 10, choices: [] }],
    };
    const shared = save([], base, "2026-09-15T00:00:00.000Z");

    const laptop = save(
      shared,
      { ...base, nodes: [{ ...base.nodes[0]!, title: "Retitled on the laptop" }] },
      "2026-09-16T00:00:00.000Z",
      "laptop"
    );
    const phone = save(
      shared,
      { ...base, nodes: [{ ...base.nodes[0]!, end: 42 }] },
      "2026-09-16T01:00:00.000Z",
      "phone"
    );

    const merged = findShow(reduce(unionEvents(laptop, phone)), SHOW);
    expect(merged?.nodes[0]?.node.title).toBe("Retitled on the laptop");
    expect(merged?.nodes[0]?.node.end).toBe(42);
  });

  it("removes a node that is gone from the edited config", () => {
    const before: ShowConfig = {
      title: "T",
      startNode: "a",
      nodes: [
        { id: "a", title: "A", choices: [] },
        { id: "b", title: "B", choices: [] },
      ],
    };
    const events = save([], before, "2026-09-15T00:00:00.000Z");
    const after = save(events, { ...before, nodes: [before.nodes[0]!] }, "2026-09-16T00:00:00.000Z", "b");
    const emitted = after.slice(events.length);
    expect(emitted.map((e) => e.kind)).toEqual(["node-removed"]);
    expect(findShow(reduce(after), SHOW)?.nodes).toHaveLength(1);
  });

  it("reorders without rewriting every node's order", () => {
    const nodes = ["a", "b", "c", "d"].map((id) => ({ id, title: id, choices: [] }));
    const before: ShowConfig = { title: "T", startNode: "a", nodes };
    const events = save([], before, "2026-09-15T00:00:00.000Z");

    // Move the last node to the front. A page reorders the key list with the nodes, which is what
    // keeps this a move rather than four nodes changing identity.
    const state = findShow(reduce(events), SHOW)!;
    const keyById = new Map(state.nodes.map((n) => [n.node.id, n.nodeKey]));
    const order = ["d", "a", "b", "c"];
    const working: WorkingShow = {
      showId: SHOW,
      config: { ...before, nodes: order.map((id) => nodes.find((n) => n.id === id)!) },
      nodeKeys: order.map((id) => keyById.get(id)!),
    };
    const emitted = diffShow(state, working, context("2026-09-16T00:00:00.000Z", "b"));

    // Only the node that actually moved needs a new order key.
    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.kind).toBe("node-field-set");
    expect(toConfig(findShow(reduce([...events, ...emitted]), SHOW)!).nodes.map((n) => n.id)).toEqual(
      ["d", "a", "b", "c"]
    );
  });

  it("carries an inserted node without disturbing its neighbours", () => {
    const nodes = ["a", "b"].map((id) => ({ id, title: id, choices: [] }));
    const before: ShowConfig = { title: "T", startNode: "a", nodes };
    const events = save([], before, "2026-09-15T00:00:00.000Z");

    const inserted = { id: "middle", title: "middle", choices: [] };
    const state = findShow(reduce(events), SHOW)!;
    const working: WorkingShow = {
      showId: SHOW,
      config: { ...before, nodes: [nodes[0]!, inserted, nodes[1]!] },
      // The page knows the first and last are existing nodes and the middle one is new.
      nodeKeys: [state.nodes[0]!.nodeKey, null, state.nodes[1]!.nodeKey],
    };
    const emitted = diffShow(state, working, context("2026-09-16T00:00:00.000Z", "b"));
    expect(emitted.map((e) => e.kind)).toEqual(["node-added"]);
    expect(toConfig(findShow(reduce([...events, ...emitted]), SHOW)!).nodes.map((n) => n.id)).toEqual(
      ["a", "middle", "b"]
    );
  });

  it("builds a working show from reduced state", () => {
    const config: ShowConfig = {
      title: "T",
      startNode: "a",
      nodes: [{ id: "a", title: "A", choices: [] }],
    };
    const events = save([], config, "2026-09-15T00:00:00.000Z");
    const state = findShow(reduce(events), SHOW)!;
    const working = workingFromState(state, toConfig(state));
    expect(working.showId).toBe(SHOW);
    expect(working.nodeKeys).toEqual(state.nodes.map((n) => n.nodeKey));
  });
});
