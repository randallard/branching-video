import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  draftsFromLegacyBackup,
  legacyShowId,
  migrateLocalDrafts,
  snapshotEvent,
  snapshotEventsFromDrafts,
} from "./migrate.ts";
import type { LegacyDraft } from "./migrate.ts";
import { parseLegacyBackup } from "./legacy-backup.ts";
import { findShow, reduce, toConfig } from "./reduce.ts";
import { unionEvents } from "./bundle.ts";
import { arbitraryConfig } from "./arbitraries.test-util.ts";

const AT = "2026-09-15T12:00:00.000Z";
const LATER = "2026-09-16T12:00:00.000Z";

describe("migrating existing data into the log (ADR-0011)", () => {
  it("gives the same content the same event id, whatever the clock says", () => {
    // This is what makes importing the same file twice a no-op, here and on any other device.
    fc.assert(
      fc.property(arbitraryConfig, (config) => {
        expect(snapshotEvent("s", config, AT).id).toBe(snapshotEvent("s", config, LATER).id);
      })
    );
  });

  it("separates the same content on different shows", () => {
    fc.assert(
      fc.property(arbitraryConfig, (config) => {
        expect(snapshotEvent("a", config, AT).id).not.toBe(snapshotEvent("b", config, AT).id);
      })
    );
  });

  it("migrating twice leaves the log unchanged", () => {
    fc.assert(
      fc.property(fc.array(arbitraryConfig, { maxLength: 4 }), (configs) => {
        const drafts: LegacyDraft[] = configs.map((config, i) => ({
          slug: `draft-${String(i)}`,
          modified: 1_700_000_000_000 + i,
          config,
        }));
        const once = snapshotEventsFromDrafts(drafts, AT);
        const twice = snapshotEventsFromDrafts(drafts, LATER);
        expect(unionEvents(once, twice)).toEqual(unionEvents(once));
        expect(reduce(unionEvents(once, twice))).toEqual(reduce(once));
      })
    );
  });

  it("carries a draft's config through to the reduced show", () => {
    fc.assert(
      fc.property(arbitraryConfig, (config) => {
        const events = snapshotEventsFromDrafts(
          [{ slug: "my-show", modified: 1_700_000_000_000, config }],
          AT
        );
        const show = findShow(reduce(events), legacyShowId("my-show"));
        expect(show).toBeDefined();
        expect(toConfig(show!)).toEqual(config);
      })
    );
  });

  it("uses the draft's own modified time, falling back to the import time", () => {
    const config = { title: "T", startNode: "a", nodes: [] };
    const [dated] = snapshotEventsFromDrafts([{ slug: "a", modified: 1_700_000_000_000, config }], AT);
    expect(dated?.at).toBe(new Date(1_700_000_000_000).toISOString());

    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const [e] = snapshotEventsFromDrafts([{ slug: "a", modified: bad, config }], AT);
      expect(e?.at).toBe(AT);
    }
  });

  it("skips unreadable drafts instead of failing the whole migration", () => {
    const good = { title: "T", startNode: "a", nodes: [] };
    const events = snapshotEventsFromDrafts(
      [
        { slug: "broken", modified: 1, config: "not a config" },
        { slug: "", modified: 1, config: good },
        { slug: "fine", modified: 1, config: good },
      ],
      AT
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.showId).toBe(legacyShowId("fine"));
  });

  it("lands an old backup on the same shows as the drafts it came from", () => {
    // ADR-0011: a backup's drafts and the same browser's migrated drafts must not fork.
    const config = { title: "Ukulele", startNode: "intro", nodes: [{ id: "intro", title: "I", choices: [] }] };
    const index = [{ slug: "ukulele", title: "Ukulele", modified: 1_700_000_000_000 }];

    const fromLocal = migrateLocalDrafts(index, () => config, AT);
    const backup = parseLegacyBackup({
      type: "bvp-backup",
      version: 1,
      exportedAt: 1_700_000_000_000,
      index,
      configs: { ukulele: config },
    });
    expect(backup).not.toBeNull();
    const fromBackup = snapshotEventsFromDrafts(draftsFromLegacyBackup(backup!), LATER);

    expect(fromBackup.map((e) => e.id)).toEqual(fromLocal.map((e) => e.id));
    expect(reduce(unionEvents(fromLocal, fromBackup)).shows).toHaveLength(1);
  });
});
