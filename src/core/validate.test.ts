import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { validate } from "./validate.ts";

/** A linear chain of `n` nodes on one master video, each choosing the next — always valid. */
function chain(n: number): unknown {
  const ids = Array.from({ length: n }, (_, i) => `n${String(i)}`);
  return {
    title: "chain",
    startNode: "n0",
    masterVideoId: "Jvu5VZVe3MI",
    nodes: ids.map((id, i) => {
      const next = ids[i + 1];
      return {
        id,
        title: id,
        start: i * 10,
        end: i * 10 + 10,
        ...(next
          ? { choices: [{ label: "Continue", target: next, default: true }] }
          : { choices: [], endScreen: { heading: "done", links: [] } }),
      };
    }),
  };
}

describe("validate", () => {
  it("never throws, on any JSON", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        const r = validate(v);
        expect(Array.isArray(r.errors)).toBe(true);
      })
    );
  });

  it("accepts any well-formed linear chain with no errors or warnings", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 }), (n) => {
        const r = validate(chain(n));
        expect(r.errors).toEqual([]);
        expect(r.warnings).toEqual([]);
        expect(r.nodeCount).toBe(n);
        expect(r.uniqueIds).toBe(n);
      })
    );
  });

  it("flags every dangling choice target", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), fc.string({ minLength: 1 }), (n, bad) => {
        fc.pre(!/^n\d+$/.test(bad));
        const cfg = chain(n) as { nodes: { choices: { target: string }[] }[] };
        cfg.nodes[0]!.choices = [{ target: bad }];
        const r = validate(cfg);
        expect(r.errors.some((e) => e.includes(`target "${bad}" not found`))).toBe(true);
      })
    );
  });

  it("ignores underscore fields like the player does", () => {
    const cfg = chain(2) as Record<string, unknown>;
    cfg["_notes"] = ["anything"];
    expect(validate(cfg).errors).toEqual([]);
  });

  it("reports the known rules", () => {
    const r = validate({
      startNode: "missing",
      nodes: [
        { id: "a", start: 10, end: 5, choices: [{ label: "", target: "a", default: true }, { label: "x", target: "a", default: true }] },
        { id: "a", videoId: "v", defaultAside: true },
      ],
    });
    expect(r.errors).toEqual([
      'node "a": no "videoId" and no top-level "masterVideoId" set',
      'node "a": "start" (10) must be less than "end" (5)',
      'node "a" choices[0]: missing "label"',
      'node "a": 2 choices marked default — only one allowed',
      'nodes[1]: duplicate id "a"',
      '"startNode" points to unknown node "missing"',
      'node "a": defaultAside requires "returnTo"',
    ]);
  });
});
