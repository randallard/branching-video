import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { canonicalJson, contentHash, stableHash } from "./canonical.ts";
import { arbitraryConfig } from "./arbitraries.test-util.ts";

/** Rebuild every object in a structure with its keys in reverse order. */
function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value).reverse()) {
      out[k] = reverseKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

describe("canonical json and content hash", () => {
  it("ignores key order", () => {
    fc.assert(
      fc.property(arbitraryConfig, (config) => {
        const shuffled = reverseKeys(JSON.parse(JSON.stringify(config)));
        expect(canonicalJson(shuffled)).toBe(canonicalJson(config));
        expect(contentHash(shuffled)).toBe(contentHash(config));
      })
    );
  });

  it("is stable across calls and 16 hex characters wide", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        const h = stableHash(s);
        expect(h).toMatch(/^[0-9a-f]{16}$/);
        expect(stableHash(s)).toBe(h);
      })
    );
  });

  it("separates configs that actually differ", () => {
    const a = { title: "a", startNode: "x", nodes: [] };
    const b = { title: "b", startNode: "x", nodes: [] };
    expect(contentHash(a)).not.toBe(contentHash(b));
  });
});
