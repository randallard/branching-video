import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseLegacyBackup } from "./legacy-backup.ts";
import { buildManifest, parseManifest } from "./manifest.ts";

describe("parseLegacyBackup", () => {
  it("parses a well-formed bvp-backup bundle", () => {
    const raw = {
      type: "bvp-backup",
      version: 1,
      exportedAt: 1,
      index: [{ slug: "a", title: "A", modified: 1 }],
      configs: { a: { title: "A", nodes: [] } },
    };
    expect(parseLegacyBackup(raw)).toEqual(raw);
  });

  it("rejects things that are not backups", () => {
    expect(parseLegacyBackup({ nodes: [] })).toBeNull();
    expect(parseLegacyBackup({ type: "bvp-backup", index: [] })).toBeNull();
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
