import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { normalizeConfig } from "./config.ts";
import { autoAdvanceTarget, continuesToNext, playOnOverlaps, routeShape, segmentEndAction } from "./routing.ts";
import { validate } from "./validate.ts";
import { arbitraryConfig } from "./arbitraries.test-util.ts";

describe("segmentEndAction", () => {
  it("continues only into the node immediately after, and never from the last node", () => {
    fc.assert(
      fc.property(arbitraryConfig, fc.boolean(), (config, branch) => {
        config.nodes.forEach((node, i) => {
          const action = segmentEndAction(config, node, branch);
          if (action.kind === "continue") {
            expect(action.nodeId).toBe(config.nodes[i + 1]?.id);
          }
          if (i === config.nodes.length - 1) expect(action.kind).not.toBe("continue");
        });
      })
    );
  });

  it("shows choices exactly when a node has them, unless its only choice is the default", () => {
    fc.assert(
      fc.property(arbitraryConfig, fc.boolean(), (config, branch) => {
        for (const node of config.nodes) {
          const singleDefault = node.choices.length === 1 && node.choices[0]?.default === true;
          expect(segmentEndAction(config, node, branch).kind === "choices").toBe(
            node.choices.length > 0 && !singleDefault
          );
        }
      })
    );
  });

  it("auto-advances exactly from a lone default choice, to that choice's target (ADR-0031)", () => {
    fc.assert(
      fc.property(arbitraryConfig, fc.boolean(), (config, branch) => {
        for (const node of config.nodes) {
          const action = segmentEndAction(config, node, branch);
          const only = node.choices.length === 1 ? node.choices[0] : undefined;
          if (only?.default === true) {
            expect(action).toEqual({ kind: "auto-advance", nodeId: only.target });
          } else {
            expect(action.kind).not.toBe("auto-advance");
            expect(autoAdvanceTarget(node)).toBeUndefined();
          }
        }
      })
    );
  });

  it("auto-advances Big Buck Bunny's single-Continue nodes but keeps a real fork", () => {
    const config = normalizeConfig({
      title: "t",
      startNode: "intro",
      nodes: [
        { id: "intro", choices: [{ label: "Continue", target: "fork", default: true }] },
        {
          id: "fork",
          choices: [
            { label: "Deep dive", target: "aside" },
            { label: "Continue", target: "end", default: true },
          ],
        },
        { id: "aside", isAside: true, returnTo: "fork", choices: [] },
        { id: "nudge", choices: [{ label: "Next", target: "end" }] },
        { id: "end", choices: [] },
      ],
    })!;
    const [intro, fork, , nudge] = config.nodes;
    expect(segmentEndAction(config, intro!, false)).toEqual({ kind: "auto-advance", nodeId: "fork" });
    expect(segmentEndAction(config, fork!, false).kind).toBe("choices");
    // One choice that isn't the default has no countdown to skip: the viewer still decides.
    expect(segmentEndAction(config, nudge!, false).kind).toBe("choices");
  });

  it("agrees with continuesToNext whenever there is no branch point to resume", () => {
    fc.assert(
      fc.property(arbitraryConfig, (config) => {
        config.nodes.forEach((node, i) => {
          const kind = segmentEndAction(config, node, false).kind;
          const isLast = i === config.nodes.length - 1;
          expect(kind === "continue" || (kind === "wrap" && isLast)).toBe(continuesToNext(routeShape(node)));
        });
      })
    );
  });

  it("plays a no-choice show straight through, ending on the wrap screen", () => {
    const config = normalizeConfig({
      title: "Ukulele",
      startNode: "intro",
      masterVideoId: "Jvu5VZVe3MI",
      nodes: [
        { id: "intro", start: 0, end: 51.6, choices: [] },
        { id: "string-names", start: 51.6, end: 61.3, choices: [] },
        { id: "chords", start: 61.3, end: 90, choices: [] },
      ],
    })!;
    const [a, b, c] = config.nodes;
    expect(segmentEndAction(config, a!, false)).toEqual({ kind: "continue", nodeId: "string-names" });
    expect(segmentEndAction(config, b!, false)).toEqual({ kind: "continue", nodeId: "chords" });
    expect(segmentEndAction(config, c!, false)).toEqual({ kind: "wrap" });
    // …so the validator no longer calls those nodes dead ends or unreachable.
    expect(validate(config).warnings).toEqual([
      'node "chords" is the last node and has no choices, aside returnTo, or endScreen — viewer will see generic "Watch again" screen',
    ]);
  });

  it("keeps the existing routes ahead of continuing", () => {
    const config = normalizeConfig({
      title: "t",
      startNode: "main",
      nodes: [
        { id: "main", choices: [{ label: "dive", target: "aside" }] },
        { id: "aside", isAside: true, returnTo: "main", returnAtCurrentTime: true, choices: [] },
        { id: "end", endScreen: { heading: "bye", links: [] }, choices: [] },
        { id: "after", choices: [] },
      ],
    })!;
    const [main, aside, end] = config.nodes;
    expect(segmentEndAction(config, main!, false).kind).toBe("choices");
    expect(segmentEndAction(config, aside!, true).kind).toBe("resume-branch");
    expect(segmentEndAction(config, aside!, false)).toEqual({ kind: "return-to", nodeId: "main" });
    expect(segmentEndAction(config, end!, false).kind).toBe("end-screen");
  });
});

describe("playOnOverlaps", () => {
  it("reports only real play-on hops whose target starts inside the source, on the same video", () => {
    fc.assert(
      fc.property(arbitraryConfig, (config) => {
        // Duplicate ids are a validation error, and the validator only looks for overlaps on a
        // config without errors, so an id must name exactly one node here.
        fc.pre(new Set(config.nodes.map((n) => n.id)).size === config.nodes.length);
        const byId = new Map(config.nodes.map((n) => [n.id, n]));
        for (const o of playOnOverlaps(config)) {
          const a = byId.get(o.from)!;
          const b = byId.get(o.to)!;
          const action = segmentEndAction(config, a, false);
          expect(["continue", "auto-advance"]).toContain(action.kind);
          expect("nodeId" in action && action.nodeId).toBe(b.id);
          expect(a.videoId ?? config.masterVideoId).toBe(b.videoId ?? config.masterVideoId);
          expect(a.start ?? 0).toBeLessThanOrEqual(o.toStart);
          expect(o.toStart).toBeLessThan(o.fromEnd);
          expect(o.replay).toBeCloseTo(o.fromEnd - o.toStart);
          expect(o.replay).toBeGreaterThan(0);
        }
      }),
      // Overlaps are rare in generated configs (~1 in 120 with unique ids), so look at plenty.
      { numRuns: 2000 }
    );
  });

  it("flags a start inside the node before it, and nothing else", () => {
    const config = normalizeConfig({
      title: "t",
      startNode: "a",
      masterVideoId: "AAAAAAAAAAA",
      nodes: [
        { id: "a", start: 0, end: 10, choices: [] },
        { id: "b", start: 10, end: 20, choices: [] }, // contiguous: fine
        { id: "c", start: 19.8, end: 30, choices: [] }, // starts inside b: 0.2 s twice
        { id: "d", videoId: "BBBBBBBBBBB", start: 5, end: 9, choices: [] }, // another video
        { id: "e", start: 2, end: 4, choices: [] }, // jumps back before d's start: a cut, not overlap
        { id: "f", start: 4, end: 8, choices: [{ label: "x", target: "a" }, { label: "y", target: "b" }] },
        { id: "g", start: 7, end: 9, choices: [] }, // after a fork: no play-on edge into it
      ],
    })!;
    const found = playOnOverlaps(config);
    expect(found.map(({ from, to }) => [from, to])).toEqual([["b", "c"]]);
    expect(found[0]?.replay).toBeCloseTo(0.2);
  });

  it("follows a lone default choice too (ADR-0031)", () => {
    const config = normalizeConfig({
      title: "t",
      startNode: "a",
      masterVideoId: "AAAAAAAAAAA",
      nodes: [
        { id: "a", start: 0, end: 10, choices: [{ label: "Continue", target: "c", default: true }] },
        { id: "b", start: 50, end: 60, choices: [] },
        { id: "c", start: 9, end: 20, choices: [] },
      ],
    })!;
    expect(playOnOverlaps(config).map(({ from, to }) => [from, to])).toEqual([["a", "c"]]);
  });
});

