import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { orderBetween, orderKeys } from "./order.ts";

describe("fractional order keys", () => {
  it("orderKeys yields n distinct keys in ascending order", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 200 }), (n) => {
        const keys = orderKeys(n);
        expect(keys).toHaveLength(n);
        expect(new Set(keys).size).toBe(n);
        expect([...keys].sort()).toEqual(keys);
        expect(keys.every((k) => k !== "")).toBe(true);
      })
    );
  });

  it("orderBetween lands strictly between its bounds", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 60 }), fc.nat(), (n, pick) => {
        const keys = orderKeys(n);
        const i = pick % (n - 1);
        const a = keys[i]!;
        const b = keys[i + 1]!;
        const mid = orderBetween(a, b);
        expect(a < mid).toBe(true);
        expect(mid < b).toBe(true);
      })
    );
  });

  it("handles the open ends of the list", () => {
    const keys = orderKeys(3);
    const first = orderBetween(null, keys[0]!);
    const last = orderBetween(keys[2]!, null);
    expect(first < keys[0]!).toBe(true);
    expect(keys[2]! < last).toBe(true);
    expect(orderBetween(null, null)).not.toBe("");
  });

  it("survives repeated insertion at the same spot", () => {
    // The pathological edit pattern: always insert just after the first node. Keys get longer,
    // but they must stay strictly ordered and distinct.
    let a = orderKeys(2)[0]!;
    const b = orderKeys(2)[1]!;
    const seen = new Set<string>([a, b]);
    for (let i = 0; i < 500; i++) {
      const mid = orderBetween(a, b);
      expect(a < mid && mid < b).toBe(true);
      expect(seen.has(mid)).toBe(false);
      seen.add(mid);
      a = mid;
    }
  });

  it("refuses bounds that are out of sequence", () => {
    expect(() => orderBetween("k", "V")).toThrow();
    expect(() => orderBetween("V", "V")).toThrow();
  });
});
