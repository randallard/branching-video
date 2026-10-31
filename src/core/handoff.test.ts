import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseShowHash, showHash } from "./handoff.ts";

describe("showHash / parseShowHash", () => {
  it("round-trips any non-empty id", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (id) => {
        expect(parseShowHash(showHash(id))).toBe(id);
      })
    );
  });

  it("round-trips the id shapes the store actually issues", () => {
    for (const id of ["c3aba252-5239-4396-8c29-9bc0a1aff6c4", "slug:most-useful-music-theory-for-ukulele"]) {
      expect(parseShowHash(showHash(id))).toBe(id);
    }
  });

  it("names no show for other fragments", () => {
    for (const hash of ["", "#", "#transfer", "#show=", "#intro", "#show=%E0%A4%A"]) {
      expect(parseShowHash(hash)).toBeNull();
    }
  });
});
