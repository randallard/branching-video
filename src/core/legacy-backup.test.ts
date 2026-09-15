import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  buildLegacyBackup,
  classifyImport,
  importedSlug,
  parseLegacyBackup,
} from "./legacy-backup.ts";
import type { DraftEntry } from "./legacy-backup.ts";
import { buildManifest, parseManifest } from "./manifest.ts";

const slug = fc.constantFrom("a", "b", "c", "d", "e");
const cfg = fc.record({ title: fc.constantFrom("x", "y"), nodes: fc.constant([]) });
const drafts = fc.uniqueArray(
  fc.record({ slug, title: fc.string({ maxLength: 4 }), modified: fc.nat() }),
  { selector: (e) => e.slug, maxLength: 5 }
);
const side = fc.tuple(drafts, fc.dictionary(slug, cfg));

describe("classifyImport", () => {
  it("partitions every importable backup entry into exactly one bucket", () => {
    fc.assert(
      fc.property(side, side, ([theirIndex, theirConfigs], [myIndex, myConfigs]) => {
        const bundle = parseLegacyBackup(buildLegacyBackup(theirIndex, theirConfigs, 1))!;
        const c = classifyImport(bundle, myIndex, (s) => myConfigs[s]);
        const bucketed = [
          ...c.fresh.map((e) => e.slug),
          ...c.identical.map((e) => e.slug),
          ...c.conflicts.map((x) => x.entry.slug),
        ].sort();
        const importable = theirIndex.filter((e) => theirConfigs[e.slug] !== undefined).map((e) => e.slug).sort();
        expect(bucketed).toEqual(importable);
        const mine = new Set(myIndex.map((e: DraftEntry) => e.slug));
        for (const e of c.fresh) expect(mine.has(e.slug)).toBe(false);
        for (const e of [...c.identical, ...c.conflicts.map((x) => x.entry)]) {
          expect(mine.has(e.slug)).toBe(true);
        }
      })
    );
  });

  it("finds nothing to resolve when a machine imports its own backup", () => {
    fc.assert(
      fc.property(side, ([index, configs]) => {
        const bundle = parseLegacyBackup(buildLegacyBackup(index, configs, 1))!;
        const c = classifyImport(bundle, index, (s) => configs[s]);
        expect(c.fresh).toEqual([]);
        expect(c.conflicts).toEqual([]);
      })
    );
  });

  it("rejects things that are not backups", () => {
    expect(parseLegacyBackup({ nodes: [] })).toBeNull();
    expect(parseLegacyBackup({ type: "bvp-backup", index: [] })).toBeNull();
  });
});

describe("importedSlug", () => {
  it("is never taken", () => {
    fc.assert(
      fc.property(fc.string(), fc.array(fc.string()), (base, taken) => {
        expect(taken).not.toContain(importedSlug(base, new Set(taken)));
      })
    );
  });
});

describe("manifest", () => {
  it("lists json shows sorted, titled from the config or the filename", () => {
    expect(
      buildManifest([
        { file: "z.json", text: '{"title":"Zed"}' },
        { file: "manifest.json", text: "[]" },
        { file: "notes.txt", text: "" },
        { file: "a.json", text: "not json" },
        { file: "b.json", text: '{"title":"  "}' },
      ])
    ).toEqual([
      { file: "a.json", title: "a.json" },
      { file: "b.json", title: "b.json" },
      { file: "z.json", title: "Zed" },
    ]);
  });

  it("round-trips through parseManifest", () => {
    fc.assert(
      fc.property(fc.array(fc.record({ file: fc.string(), text: fc.string() })), (files) => {
        const m = buildManifest(files);
        expect(parseManifest(JSON.parse(JSON.stringify(m)))).toEqual(m);
      })
    );
  });
});
