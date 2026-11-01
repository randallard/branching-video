import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { ShowConfig, ShowNode } from "./config.ts";
import { arbitraryConfig } from "./arbitraries.test-util.ts";
import { cueDue, endIsReal, initialPlayback, pastEnd, reducePlayback } from "./playback.ts";
import type { Playback, PlaybackAction } from "./playback.ts";

// Ids overlap arbitraryConfig's, plus one no show has, so some navigations miss.
const action: fc.Arbitrary<PlaybackAction> = fc.oneof(
  fc.record({
    type: fc.constant("navigate" as const),
    nodeId: fc.constantFrom("intro", "a", "b", "c", "aside", "end", "missing"),
    at: fc.option(fc.double({ min: 0, max: 5000, noNaN: true, noDefaultInfinity: true })),
  }),
  fc.constantFrom<PlaybackAction>(
    { type: "resume" },
    { type: "playing" },
    { type: "show-choices" }
  )
);

// isAside and returnAtCurrentTime are always true in arbitraryConfig; mix in main-line nodes.
const show: fc.Arbitrary<ShowConfig> = fc
  .tuple(arbitraryConfig, fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }))
  .map(([config, main]) => ({
    ...config,
    nodes: config.nodes.map((n, i) => (main[i] ? { ...n, isAside: undefined, defaultAside: undefined } : n)),
  }));

function lastNode(config: ShowConfig, id: string | null): ShowNode | undefined {
  return config.nodes.filter((n) => n.id === id).at(-1);
}

/** Every state from the initial one through each action, with the action that made it. */
function trace(config: ShowConfig, actions: PlaybackAction[]): { before: Playback; action: PlaybackAction; after: Playback }[] {
  let p = initialPlayback;
  return actions.map((a) => {
    const before = p;
    p = reducePlayback(config, p, a);
    return { before, action: a, after: p };
  });
}

const sequences = fc.tuple(show, fc.array(action, { maxLength: 40 }));

describe("reducePlayback", () => {
  it("keeps a branch point only while an aside plays, and it always names a main-line node", () => {
    fc.assert(
      fc.property(sequences, ([config, actions]) => {
        for (const { after } of trace(config, actions)) {
          if (after.branch === null) continue;
          expect(lastNode(config, after.nodeId)?.isAside).toBe(true);
          expect(lastNode(config, after.branch.nodeId)?.isAside).not.toBe(true);
        }
      })
    );
  });

  it("shows choices at most once per segment, and showing them spends the cue", () => {
    fc.assert(
      fc.property(sequences, ([config, actions]) => {
        let shownThisSegment = 0;
        for (const { before, action: a, after } of trace(config, actions)) {
          if (after.choicesVisible) expect(after.cueSpent).toBe(true);
          if (a.type === "navigate" || (a.type === "resume" && after !== before)) shownThisSegment = 0;
          if (!before.choicesVisible && after.choicesVisible) shownThisSegment++;
          expect(shownThisSegment).toBeLessThanOrEqual(1);
        }
      })
    );
  });

  it("starts every segment unready, and only `playing` makes it ready", () => {
    fc.assert(
      fc.property(sequences, ([config, actions]) => {
        for (const { before, action: a, after } of trace(config, actions)) {
          if (a.type === "navigate" || (a.type === "resume" && after !== before)) {
            expect(after.ready).toBe(false);
            expect(after.choicesVisible).toBe(false);
          }
          if (!before.ready && after.ready) expect(a.type).toBe("playing");
        }
      })
    );
  });

  it("only ever plays a node of the show", () => {
    fc.assert(
      fc.property(sequences, ([config, actions]) => {
        for (const { after } of trace(config, actions)) {
          if (after.nodeId !== null) expect(lastNode(config, after.nodeId)).toBeDefined();
        }
      })
    );
  });

  it("resumes at exactly the captured node and time, and consumes the branch point", () => {
    fc.assert(
      fc.property(sequences, ([config, actions]) => {
        for (const { before, action: a, after } of trace(config, actions)) {
          if (a.type !== "resume") continue;
          if (before.branch === null) {
            expect(after).toBe(before);
            continue;
          }
          expect(after.nodeId).toBe(before.branch.nodeId);
          expect(after.startAt).toBe(before.branch.time);
          expect(after.branch).toBeNull();
        }
      })
    );
  });

  it("spends the cue on entry exactly when the segment starts at or past it", () => {
    fc.assert(
      fc.property(sequences, ([config, actions]) => {
        for (const { before, action: a, after } of trace(config, actions)) {
          const entered = a.type === "navigate" ? lastNode(config, a.nodeId) : undefined;
          if (!entered && !(a.type === "resume" && after !== before)) continue;
          const node = lastNode(config, after.nodeId);
          if (!node) throw new Error("entered a node that isn't in the show");
          expect(after.cueSpent).toBe(typeof node.showChoicesAt === "number" && after.startAt >= node.showChoicesAt);
          if (a.type === "navigate") expect(after.startAt).toBe(node.start ?? 0);
        }
      })
    );
  });
});

describe("branch points", () => {
  const main: ShowNode = { id: "main", title: "", choices: [] };
  const aside: ShowNode = { id: "aside", title: "", choices: [], isAside: true, returnAtCurrentTime: true };
  const nested: ShowNode = { id: "nested", title: "", choices: [], isAside: true, returnAtCurrentTime: true };
  const config: ShowConfig = { title: "", startNode: "main", nodes: [main, aside, nested] };
  const run = (...actions: PlaybackAction[]): Playback =>
    actions.reduce((p, a) => reducePlayback(config, p, a), initialPlayback);

  it("is taken leaving the main line, kept through a nested aside, and resumed", () => {
    const p = run(
      { type: "navigate", nodeId: "main", at: null },
      { type: "navigate", nodeId: "aside", at: 42 },
      { type: "navigate", nodeId: "nested", at: 7 }
    );
    expect(p.branch).toEqual({ nodeId: "main", time: 42 });
    const back = reducePlayback(config, p, { type: "resume" });
    expect(back).toMatchObject({ nodeId: "main", startAt: 42, branch: null });
  });

  it("is dropped when the main line is reached another way (ADR-0036)", () => {
    const p = run(
      { type: "navigate", nodeId: "main", at: null },
      { type: "navigate", nodeId: "aside", at: 42 },
      { type: "navigate", nodeId: "main", at: 3 }
    );
    expect(p.branch).toBeNull();
  });
});

describe("the page's questions", () => {
  const node: ShowNode = { id: "n", title: "", choices: [], showChoicesAt: 10, end: 20 };
  const ready: Playback = { ...initialPlayback, nodeId: "n", ready: true };

  it("fires the cue once it's reached and not spent", () => {
    expect(cueDue(ready, node, 9.9)).toBe(false);
    expect(cueDue(ready, node, 10)).toBe(true);
    expect(cueDue({ ...ready, cueSpent: true }, node, 15)).toBe(false);
  });

  it("treats ENDED as real only once ready, and near `end` when there is one", () => {
    expect(endIsReal(initialPlayback, node, 20)).toBe(false);
    expect(endIsReal(ready, node, 20)).toBe(true);
    expect(endIsReal(ready, node, 2)).toBe(false);
    expect(endIsReal(ready, node, null)).toBe(true);
    expect(endIsReal(ready, { id: "x", title: "", choices: [] }, 999)).toBe(true);
  });

  it("calls the backstop just past `end`", () => {
    expect(pastEnd(node, 20.2)).toBe(false);
    expect(pastEnd(node, 20.25)).toBe(true);
    expect(pastEnd({ id: "x", title: "", choices: [] }, 1e6)).toBe(false);
  });
});
