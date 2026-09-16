import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { ShowEvent } from "./events.ts";
import { findShow, reduce, snapshotNodeKeys, toConfig } from "./reduce.ts";
import { arbitraryConfig, arbitraryEvents } from "./arbitraries.test-util.ts";

const AT = "2026-09-15T12:00:00.000Z";

describe("reduce", () => {
  it("is a function of the event set, not its arrival order", () => {
    // The flagship property (ADR-0007): this is what makes merging two devices a plain union.
    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        const forward = reduce(events);
        const backward = reduce([...events].reverse());
        expect(backward).toEqual(forward);
      })
    );
  });

  it("is unchanged by duplicate events", () => {
    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        expect(reduce([...events, ...events])).toEqual(reduce(events));
      })
    );
  });

  it("is unchanged by re-importing its own export (union is idempotent)", () => {
    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        const half = events.slice(0, Math.ceil(events.length / 2));
        expect(reduce([...events, ...half])).toEqual(reduce(events));
      })
    );
  });

  it("never throws, whatever the events say", () => {
    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        expect(() => reduce(events)).not.toThrow();
      })
    );
  });

  it("keeps nodes sorted by their order key", () => {
    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        for (const show of reduce(events).shows) {
          const orders = show.nodes.map((n) => n.order);
          expect([...orders].sort()).toEqual(orders);
        }
      })
    );
  });

  it("counts unknown kinds and skips them instead of failing", () => {
    const events = [
      { id: "a", at: AT, v: 1, kind: "show-field-set", showId: "s", field: "title", value: "Hi" },
      { id: "b", at: AT, v: 1, kind: "show-invented-later", showId: "s" },
    ] as unknown as ShowEvent[];
    const state = reduce(events);
    expect(state.unknownKinds).toEqual(["show-invented-later"]);
    expect(findShow(state, "s")?.title).toBe("Hi");
  });

  it("round-trips a config through a snapshot", () => {
    fc.assert(
      fc.property(arbitraryConfig, (config) => {
        const state = reduce([
          { id: "s1", at: AT, v: 1, kind: "show-snapshot", showId: "s", config },
        ]);
        const show = findShow(state, "s");
        expect(show).toBeDefined();
        expect(toConfig(show!)).toEqual(config);
      })
    );
  });

  it("gives the same snapshot the same node keys on any device", () => {
    fc.assert(
      fc.property(arbitraryConfig, (config) => {
        expect(snapshotNodeKeys(config)).toEqual(snapshotNodeKeys(config));
        expect(snapshotNodeKeys(config)).toHaveLength(config.nodes.length);
      })
    );
  });

  it("keys follow the node, not its position (ADR-0025)", () => {
    // Reordering a config must not repoint a key at a different node -- otherwise re-importing a
    // reordered file lands every prior edit on the wrong node, silently. `arbitraryConfig` draws
    // node ids from a small set, so duplicate ids -- the case this hardens -- come up often.
    fc.assert(
      fc.property(arbitraryConfig, (config) => {
        const mapping = (c: typeof config): Set<string> =>
          new Set(
            snapshotNodeKeys(c).map((key, i) => `${key}\u0000${JSON.stringify(c.nodes[i])}`)
          );
        const reversed = { ...config, nodes: [...config.nodes].reverse() };
        expect(mapping(reversed)).toEqual(mapping(config));
      })
    );
  });

  it("keeps two fully identical nodes rather than collapsing them", () => {
    const node = { id: "dupe", title: "Same", choices: [] };
    const config = { title: "T", startNode: "dupe", nodes: [node, { ...node }] };
    expect(new Set(snapshotNodeKeys(config)).size).toBe(2);
    const state = reduce([
      { id: "s1", at: AT, v: 1, kind: "show-snapshot", showId: "s", config },
    ]);
    expect(findShow(state, "s")?.nodes).toHaveLength(2);
  });

  it("distinguishes same-id nodes by content, not by position", () => {
    const config = {
      title: "T",
      startNode: "x",
      nodes: [
        { id: "x", title: "First", choices: [] },
        { id: "x", title: "Second", choices: [] },
      ],
    };
    const [a, b] = snapshotNodeKeys(config);
    const swapped = { ...config, nodes: [...config.nodes].reverse() };
    const [ra, rb] = snapshotNodeKeys(swapped);
    // The key that meant "Second" still means "Second" after the swap.
    expect(rb).toBe(a);
    expect(ra).toBe(b);
  });

  describe("last writer wins per field (ADR-0008)", () => {
    const set = (id: string, at: string, field: string, value: unknown): ShowEvent =>
      ({ id, at, v: 1, kind: "show-field-set", showId: "s", field, value }) as ShowEvent;

    it("resolves the same field to the later write", () => {
      const state = reduce([
        set("a", "2026-09-01T00:00:00.000Z", "title", "old"),
        set("b", "2026-09-02T00:00:00.000Z", "title", "new"),
      ]);
      expect(findShow(state, "s")?.title).toBe("new");
    });

    it("keeps both sides when two devices edit different fields", () => {
      // The whole point of edit-level events: a snapshot merge would drop one of these.
      const state = reduce([
        set("laptop", "2026-09-02T00:00:00.000Z", "title", "From the laptop"),
        set("phone", "2026-09-01T00:00:00.000Z", "masterVideoId", "Jvu5VZVe3MI"),
      ]);
      const show = findShow(state, "s");
      expect(show?.title).toBe("From the laptop");
      expect(show?.masterVideoId).toBe("Jvu5VZVe3MI");
    });

    it("breaks an exact timestamp tie by event id, deterministically", () => {
      const a = set("aaa", AT, "title", "by aaa");
      const b = set("bbb", AT, "title", "by bbb");
      expect(findShow(reduce([a, b]), "s")?.title).toBe("by bbb");
      expect(findShow(reduce([b, a]), "s")?.title).toBe("by bbb");
    });
  });

  describe("node lifecycle", () => {
    const base = (id: string, at: string): Pick<ShowEvent, "id" | "at" | "v"> => ({ id, at, v: 1 });

    it("removal wins over a later field set on that node", () => {
      const events = [
        {
          ...base("add", "2026-09-01T00:00:00.000Z"),
          kind: "node-added",
          showId: "s",
          nodeKey: "k",
          node: { id: "intro", title: "Intro", choices: [] },
          order: "V",
        },
        { ...base("rm", "2026-09-02T00:00:00.000Z"), kind: "node-removed", showId: "s", nodeKey: "k" },
        {
          ...base("edit", "2026-09-03T00:00:00.000Z"),
          kind: "node-field-set",
          showId: "s",
          nodeKey: "k",
          field: "title",
          value: "Resurrected",
        },
      ] as ShowEvent[];
      expect(findShow(reduce(events), "s")?.nodes).toEqual([]);
    });

    it("a re-add after a removal brings the node back", () => {
      // Removal beats later *field sets* (ADR-0008), but adding the node again is a deliberate
      // act, not a stray edit, so it lifts the removal. Decided here, not in the ADR.
      const events = [
        {
          ...base("add", "2026-09-01T00:00:00.000Z"),
          kind: "node-added",
          showId: "s",
          nodeKey: "k",
          node: { id: "intro", title: "Intro", choices: [] },
          order: "V",
        },
        { ...base("rm", "2026-09-02T00:00:00.000Z"), kind: "node-removed", showId: "s", nodeKey: "k" },
        {
          ...base("again", "2026-09-03T00:00:00.000Z"),
          kind: "node-added",
          showId: "s",
          nodeKey: "k",
          node: { id: "intro", title: "Back again", choices: [] },
          order: "V",
        },
        {
          ...base("edit", "2026-09-04T00:00:00.000Z"),
          kind: "node-field-set",
          showId: "s",
          nodeKey: "k",
          field: "title",
          value: "And editable",
        },
      ] as ShowEvent[];
      const nodes = findShow(reduce(events), "s")?.nodes;
      expect(nodes).toHaveLength(1);
      // Edits after the re-add apply again — the removal is fully lifted, not just paused.
      expect(nodes?.[0]?.node.title).toBe("And editable");
    });

    it("keeps one show's removals out of another's", () => {
      const events = [
        {
          ...base("add", "2026-09-01T00:00:00.000Z"),
          kind: "node-added",
          showId: "other",
          nodeKey: "k",
          node: { id: "intro", title: "Untouched", choices: [] },
          order: "V",
        },
        { ...base("rm", "2026-09-02T00:00:00.000Z"), kind: "node-removed", showId: "s", nodeKey: "k" },
      ] as ShowEvent[];
      expect(findShow(reduce(events), "other")?.nodes).toHaveLength(1);
    });

    it("a later snapshot brings the show back wholesale", () => {
      const config = { title: "T", startNode: "intro", nodes: [{ id: "intro", title: "I", choices: [] }] };
      const events = [
        { ...base("rm", "2026-09-01T00:00:00.000Z"), kind: "node-removed", showId: "s", nodeKey: "n:intro" },
        { ...base("snap", "2026-09-02T00:00:00.000Z"), kind: "show-snapshot", showId: "s", config },
      ] as ShowEvent[];
      expect(findShow(reduce(events), "s")?.nodes).toHaveLength(1);
    });

    it("reports a delete-versus-edit collision (ADR-0024)", () => {
      const events = [
        {
          ...base("add", "2026-09-01T00:00:00.000Z"),
          kind: "node-added",
          showId: "s",
          nodeKey: "k",
          node: { id: "intro", title: "Work in progress", choices: [] },
          order: "V",
        },
        { ...base("rm", "2026-09-02T00:00:00.000Z"), kind: "node-removed", showId: "s", nodeKey: "k" },
        {
          ...base("phone", "2026-09-03T00:00:00.000Z"),
          kind: "node-field-set",
          showId: "s",
          nodeKey: "k",
          field: "title",
          value: "Edited on the phone",
        },
      ] as ShowEvent[];
      const state = reduce(events);
      expect(state.collisions).toHaveLength(1);
      const c = state.collisions[0];
      expect(c?.nodeKey).toBe("k");
      expect(c?.discardedEdits).toBe(1);
      expect(c?.lastEditAt).toBe("2026-09-03T00:00:00.000Z");
      // The node as it stood before deletion, so the notice can offer to bring it back.
      expect(c?.node.title).toBe("Work in progress");
    });

    it("reports nothing when the removal is simply the last word", () => {
      const events = [
        {
          ...base("add", "2026-09-01T00:00:00.000Z"),
          kind: "node-added",
          showId: "s",
          nodeKey: "k",
          node: { id: "intro", title: "Gone", choices: [] },
          order: "V",
        },
        {
          ...base("edit", "2026-09-02T00:00:00.000Z"),
          kind: "node-field-set",
          showId: "s",
          nodeKey: "k",
          field: "title",
          value: "Still here",
        },
        { ...base("rm", "2026-09-03T00:00:00.000Z"), kind: "node-removed", showId: "s", nodeKey: "k" },
      ] as ShowEvent[];
      expect(reduce(events).collisions).toEqual([]);
    });

    it("settles a collision when the node is restored", () => {
      // ADR-0024: answering is just another event.
      const events = [
        { ...base("rm", "2026-09-01T00:00:00.000Z"), kind: "node-removed", showId: "s", nodeKey: "k" },
        {
          ...base("edit", "2026-09-02T00:00:00.000Z"),
          kind: "node-field-set",
          showId: "s",
          nodeKey: "k",
          field: "title",
          value: "Edited after deletion",
        },
        {
          ...base("restore", "2026-09-03T00:00:00.000Z"),
          kind: "node-added",
          showId: "s",
          nodeKey: "k",
          node: { id: "intro", title: "Brought back", choices: [] },
          order: "V",
        },
      ] as ShowEvent[];
      expect(reduce(events).collisions).toEqual([]);
    });

    it("settles a collision when the answer is 'leave it deleted'", () => {
      // Recorded as a second removal, which puts the discarded edits behind it.
      const events = [
        { ...base("rm", "2026-09-01T00:00:00.000Z"), kind: "node-removed", showId: "s", nodeKey: "k" },
        {
          ...base("edit", "2026-09-02T00:00:00.000Z"),
          kind: "node-field-set",
          showId: "s",
          nodeKey: "k",
          field: "title",
          value: "Edited after deletion",
        },
      ] as ShowEvent[];
      expect(reduce(events).collisions).toHaveLength(1);

      const answered = [
        ...events,
        { ...base("stay-gone", "2026-09-03T00:00:00.000Z"), kind: "node-removed", showId: "s", nodeKey: "k" },
      ] as ShowEvent[];
      expect(reduce(answered).collisions).toEqual([]);
      expect(findShow(reduce(answered), "s")?.nodes).toEqual([]);
    });

    it("a snapshot clears any pending collision", () => {
      const config = { title: "T", startNode: "intro", nodes: [{ id: "intro", title: "I", choices: [] }] };
      const events = [
        { ...base("rm", "2026-09-01T00:00:00.000Z"), kind: "node-removed", showId: "s", nodeKey: "k" },
        {
          ...base("edit", "2026-09-02T00:00:00.000Z"),
          kind: "node-field-set",
          showId: "s",
          nodeKey: "k",
          field: "title",
          value: "Edited after deletion",
        },
        { ...base("snap", "2026-09-03T00:00:00.000Z"), kind: "show-snapshot", showId: "s", config },
      ] as ShowEvent[];
      expect(reduce(events).collisions).toEqual([]);
    });

    it("tracks delete and restore as ordinary last-writer edits", () => {
      const events = [
        { ...base("d", "2026-09-01T00:00:00.000Z"), kind: "show-deleted", showId: "s" },
        { ...base("r", "2026-09-02T00:00:00.000Z"), kind: "show-restored", showId: "s" },
      ] as ShowEvent[];
      expect(findShow(reduce(events), "s")?.deleted).toBe(false);
    });
  });
});
