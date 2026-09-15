import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { normalizeConfig } from "./config.ts";
import { continuesToNext, routeShape, segmentEndAction } from "./routing.ts";
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

  it("shows choices exactly when a node has them", () => {
    fc.assert(
      fc.property(arbitraryConfig, fc.boolean(), (config, branch) => {
        for (const node of config.nodes) {
          expect(segmentEndAction(config, node, branch).kind === "choices").toBe(node.choices.length > 0);
        }
      })
    );
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
