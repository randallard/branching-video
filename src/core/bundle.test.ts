import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { BUNDLE_FORMAT, isEventBundle, parseBundle, serializeBundle, unionEvents } from "./bundle.ts";
import { reduce } from "./reduce.ts";
import { arbitraryEvents } from "./arbitraries.test-util.ts";

const EXPORTED_AT = "2026-09-15T12:00:00.000Z";

const roundTrip = (events: Parameters<typeof serializeBundle>[0]): ReturnType<typeof parseBundle> =>
  parseBundle(JSON.parse(serializeBundle(events, EXPORTED_AT)) as unknown);

describe("event bundles", () => {
  it("round-trips an event set", () => {
    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        expect(roundTrip(events)).toEqual(unionEvents(events));
      })
    );
  });

  it("serializes deterministically, whatever order the events arrive in", () => {
    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        expect(serializeBundle([...events].reverse(), EXPORTED_AT)).toBe(
          serializeBundle(events, EXPORTED_AT)
        );
      })
    );
  });

  it("importing a bundle twice is a no-op", () => {
    // ADR-0007: import can add events, never remove them, and union is idempotent.
    fc.assert(
      fc.property(arbitraryEvents, (events) => {
        const imported = roundTrip(events);
        expect(reduce(unionEvents(imported, imported))).toEqual(reduce(events));
      })
    );
  });

  it("merging two devices is a union, and order doesn't matter", () => {
    fc.assert(
      fc.property(arbitraryEvents, arbitraryEvents, (a, b) => {
        // Give the second device its own event ids, as separate devices would have.
        const other = b.map((e) => ({ ...e, id: `other-${e.id}` }));
        expect(reduce(unionEvents(a, other))).toEqual(reduce(unionEvents(other, a)));
      })
    );
  });

  it("recognises its own format", () => {
    const bundle = JSON.parse(serializeBundle([], EXPORTED_AT)) as Record<string, unknown>;
    expect(bundle["format"]).toBe(BUNDLE_FORMAT);
    expect(isEventBundle(bundle)).toBe(true);
    expect(isEventBundle({ type: "bvp-backup" })).toBe(false);
  });

  it("rejects the things people will actually drop on it", () => {
    expect(() => parseBundle(null)).toThrow(/expected a JSON object/i);
    expect(() => parseBundle({ type: "bvp-backup" })).toThrow(/not a branching video event backup/i);
    expect(() => parseBundle({ format: BUNDLE_FORMAT, bundleVersion: 1 })).toThrow(/events/i);
  });

  it("refuses a bundle from a newer build rather than silently dropping events", () => {
    expect(() =>
      parseBundle({ format: BUNDLE_FORMAT, bundleVersion: 99, exportedAt: EXPORTED_AT, events: [] })
    ).toThrow(/newer version/i);
  });

  it("skips entries that aren't events, keeping the rest", () => {
    const events = parseBundle({
      format: BUNDLE_FORMAT,
      bundleVersion: 1,
      exportedAt: EXPORTED_AT,
      events: [
        { id: "ok", at: EXPORTED_AT, v: 1, kind: "show-deleted", showId: "s" },
        null,
        "nonsense",
        { id: "no-showid", at: EXPORTED_AT, v: 1, kind: "show-deleted" },
      ],
    });
    expect(events.map((e) => e.id)).toEqual(["ok"]);
  });
});
