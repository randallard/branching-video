import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { normalizeConfig } from "./config.ts";
import { serializeEditor, serializeStudio } from "./serialize.ts";
import { validate } from "./validate.ts";
import { arbitraryConfig } from "./arbitraries.test-util.ts";

// The real file that prompted the migration: a single-show export with no choices.
const ukulele = {
  title: "Most Useful Music Theory for Ukulele",
  startNode: "intro",
  choiceDisplaySeconds: 8,
  masterVideoId: "Jvu5VZVe3MI",
  nodes: [
    { id: "intro", title: "intro", choices: [], start: 0, end: 51.6 },
    { id: "string-names", title: "string names - acronym", choices: [], start: 51.6, end: 61.3 },
  ],
};

describe("normalizeConfig", () => {
  it("returns null without a nodes array, and never throws", () => {
    expect(normalizeConfig(null)).toBeNull();
    expect(normalizeConfig({ title: "x" })).toBeNull();
    expect(normalizeConfig({ type: "bvp-backup", index: [], configs: {} })).toBeNull();
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        normalizeConfig(v);
      })
    );
  });

  it("keeps a real export intact through both serializers", () => {
    const cfg = normalizeConfig(ukulele);
    expect(cfg).not.toBeNull();
    expect(serializeStudio(cfg!)).toEqual(ukulele);
    expect(serializeEditor(cfg!)).toEqual(ukulele);
  });

  it("drops underscore notes and wrongly-typed values", () => {
    const cfg = normalizeConfig({
      _note: "hi",
      title: 5,
      startNode: "a",
      nodes: [{ id: "a", start: "zero", end: null, choices: [{ label: "x", target: "a", _why: 1 }] }],
    });
    expect(cfg).toEqual({
      title: "",
      startNode: "a",
      nodes: [{ id: "a", title: "", choices: [{ label: "x", target: "a" }] }],
    });
  });
});

describe("serializers", () => {
  it("are stable: serialize(normalize(serialize(c))) equals serialize(c)", () => {
    fc.assert(
      fc.property(arbitraryConfig, (c) => {
        for (const ser of [serializeStudio, serializeEditor]) {
          const once = ser(c);
          const again = ser(normalizeConfig(JSON.parse(JSON.stringify(once)))!);
          expect(again).toEqual(once);
        }
      })
    );
  });

  it("never emit underscore or undefined fields", () => {
    fc.assert(
      fc.property(arbitraryConfig, (c) => {
        const keys: string[] = [];
        const text = JSON.stringify(serializeEditor(c), (k, v: unknown) => {
          keys.push(k);
          return v;
        });
        expect(keys.filter((k) => k.startsWith("_"))).toEqual([]);
        // JSON.stringify drops undefined-valued keys, so a lossless round trip means none.
        expect(JSON.parse(text)).toStrictEqual(serializeEditor(c));
      })
    );
  });

  it("validation sees the same errors in a config and its serialization", () => {
    fc.assert(
      fc.property(arbitraryConfig, (c) => {
        const ser = serializeEditor(c);
        expect(validate(ser).errors).toEqual(
          validate(JSON.parse(JSON.stringify(serializeEditor(normalizeConfig(ser)!)))).errors
        );
      })
    );
  });
});
