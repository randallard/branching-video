import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { arbitraryConfig } from "./arbitraries.test-util.ts";
import { menuSections } from "./menu.ts";

describe("menuSections", () => {
  it("lists every node exactly once, in config order within each section", () => {
    fc.assert(
      fc.property(arbitraryConfig, ({ nodes }) => {
        const sections = menuSections(nodes);
        const listed = sections.flatMap((s) => s.nodes);
        expect([...listed].sort((a, b) => nodes.indexOf(a) - nodes.indexOf(b))).toEqual(nodes);
        expect(listed).toHaveLength(nodes.length);
        for (const s of sections) {
          const positions = s.nodes.map((n) => nodes.indexOf(n));
          expect(positions).toEqual([...positions].sort((a, b) => a - b));
        }
      })
    );
  });

  it("splits only a show that has both main nodes and asides, asides second", () => {
    fc.assert(
      fc.property(arbitraryConfig, ({ nodes }) => {
        const sections = menuSections(nodes);
        const mixed = nodes.some((n) => n.isAside === true) && nodes.some((n) => n.isAside !== true);
        if (mixed) {
          expect(sections.map((s) => s.heading)).toEqual(["Main chapters", "Deep dives"]);
          expect(sections[0]?.nodes.every((n) => n.isAside !== true)).toBe(true);
          expect(sections[1]?.nodes.every((n) => n.isAside === true)).toBe(true);
        } else {
          expect(sections.map((s) => s.heading)).toEqual([undefined]);
        }
      })
    );
  });
});
