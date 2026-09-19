import { describe, expect, it } from "vitest";
import type { ShowConfig } from "../core/config.ts";
import { LEGACY_BACKUP_TYPE } from "../core/config.ts";
import type { LegacyBackup } from "../core/legacy-backup.ts";
import { DraftStore } from "./draft-store.ts";
import { createInMemoryStore } from "./event-store.ts";
import { snapshotEvent } from "../core/migrate.ts";

const config = (title: string, nodeIds: string[] = ["intro"]): ShowConfig => ({
  title,
  startNode: nodeIds[0] ?? "",
  nodes: nodeIds.map((id) => ({ id, title: id, choices: [] })),
});

const store = (): DraftStore => new DraftStore(createInMemoryStore(), [], true);

describe("DraftStore", () => {
  it("creates, lists and reopens a show", async () => {
    const s = store();
    const id = await s.create(config("Ukulele"));
    expect(s.list().map((x) => x.title)).toEqual(["Ukulele"]);
    expect(s.config(id)).toEqual(config("Ukulele"));
    expect(s.open(id)?.nodeKeys.every((k) => k !== null)).toBe(true);
  });

  it("saves an edit and gives it back", async () => {
    const s = store();
    const id = await s.create(config("Before"));
    const working = s.open(id);
    expect(working).not.toBeNull();
    working!.config.title = "After";
    working!.config.nodes[0]!.title = "Renamed node";
    await s.save(working!);
    expect(s.config(id)?.title).toBe("After");
    expect(s.config(id)?.nodes[0]?.title).toBe("Renamed node");
  });

  it("appends nothing when a save changes nothing", async () => {
    const s = store();
    const id = await s.create(config("Steady"));
    const before = (await s.allEvents()).length;
    const appended = await s.save(s.open(id)!);
    expect(appended).toEqual([]);
    expect(await s.allEvents()).toHaveLength(before);
  });

  it("hides a deleted show and brings it back", async () => {
    const s = store();
    const id = await s.create(config("Temporary"));
    await s.remove(id);
    expect(s.list()).toEqual([]);
    await s.restore(id);
    expect(s.list().map((x) => x.showId)).toEqual([id]);
  });

  it("round-trips through an event bundle", async () => {
    const s = store();
    await s.create(config("Exported", ["a", "b"]));
    const bundle = await s.exportBundle();

    const fresh = store();
    const added = await fresh.importBundle(JSON.parse(bundle) as unknown);
    expect(added).toBeGreaterThan(0);
    expect(fresh.list().map((x) => x.title)).toEqual(["Exported"]);
    expect(fresh.config(fresh.list()[0]!.showId)).toEqual(config("Exported", ["a", "b"]));
  });

  it("importing the same bundle twice adds nothing the second time", async () => {
    const s = store();
    await s.create(config("Once"));
    const bundle = JSON.parse(await s.exportBundle()) as unknown;

    const fresh = store();
    await fresh.importBundle(bundle);
    const second = await fresh.importBundle(bundle);
    expect(second).toBe(0);
    expect(fresh.list()).toHaveLength(1);
  });

  it("merges another device's edits rather than choosing between them", async () => {
    const laptop = store();
    const id = await laptop.create(config("Shared"));
    const shared = JSON.parse(await laptop.exportBundle()) as unknown;

    const phone = store();
    await phone.importBundle(shared);

    // Each device edits a different field of the same show.
    const onLaptop = laptop.open(id)!;
    onLaptop.config.nodes[0]!.title = "Titled on the laptop";
    await laptop.save(onLaptop);

    const onPhone = phone.open(id)!;
    onPhone.config.nodes[0]!.start = 42;
    await phone.save(onPhone);

    await laptop.importBundle(JSON.parse(await phone.exportBundle()) as unknown);
    const merged = laptop.config(id);
    expect(merged?.nodes[0]?.title).toBe("Titled on the laptop");
    expect(merged?.nodes[0]?.start).toBe(42);
  });

  it("imports a single-show file onto an existing show, or as a new one (ADR-0011)", async () => {
    const s = store();
    const id = await s.create(config("Ukulele", ["intro"]));
    expect(s.matchingTitle("Ukulele").map((x) => x.showId)).toEqual([id]);

    const updated = config("Ukulele", ["intro", "chords"]);
    await s.importConfig(updated, id);
    expect(s.config(id)?.nodes).toHaveLength(2);
    expect(s.list()).toHaveLength(1);

    const separate = await s.importConfig(config("Ukulele", ["other"]), null);
    expect(separate).not.toBe(id);
    expect(s.list()).toHaveLength(2);
  });

  it("re-importing the same file is a no-op", async () => {
    const s = store();
    const id = await s.create(config("Stable"));
    const file = config("Stable", ["intro", "second"]);
    await s.importConfig(file, id);
    const count = (await s.allEvents()).length;
    await s.importConfig(file, id);
    expect(await s.allEvents()).toHaveLength(count);
  });

  describe("delete-versus-edit collisions (ADR-0024)", () => {
    /** One device deletes a node; another, later, edits it. */
    async function collided(): Promise<DraftStore> {
      const s = store();
      const id = await s.create(config("Show", ["a", "b"]));
      const state = s.find(id)!;
      const keyOfB = state.nodes[1]!.nodeKey;

      // Delete node b.
      const dropped = s.open(id)!;
      dropped.config.nodes = [dropped.config.nodes[0]!];
      dropped.nodeKeys = [dropped.nodeKeys[0]!];
      await s.save(dropped);

      // Another device's later edit to the node that is now gone.
      const events = await s.allEvents();
      await s.importBundle({
        format: "branching-video-events",
        bundleVersion: 1,
        exportedAt: "2099-01-01T00:00:00.000Z",
        events: [
          ...events,
          {
            id: "late-edit",
            at: "2099-01-01T00:00:00.000Z",
            v: 1,
            kind: "node-field-set",
            showId: id,
            nodeKey: keyOfB,
            field: "title",
            value: "Edited elsewhere",
          },
        ],
      });
      return s;
    }

    it("reports the collision with the node as it stood", async () => {
      const s = await collided();
      expect(s.collisions()).toHaveLength(1);
      expect(s.collisions()[0]?.node.id).toBe("b");
    });

    it("restoring the node settles it", async () => {
      const s = await collided();
      await s.restoreNode(s.collisions()[0]!);
      expect(s.collisions()).toEqual([]);
      const showId = s.list()[0]!.showId;
      expect(s.config(showId)?.nodes.map((n) => n.id)).toContain("b");
    });

    it("confirming the removal settles it and leaves the node gone", async () => {
      const s = await collided();
      await s.confirmRemoval(s.collisions()[0]!);
      expect(s.collisions()).toEqual([]);
      const showId = s.list()[0]!.showId;
      expect(s.config(showId)?.nodes.map((n) => n.id)).not.toContain("b");
    });
  });

  it("imports a legacy bvp-backup as snapshot events, and re-importing is a no-op", async () => {
    const s = store();
    const backup: LegacyBackup = {
      type: LEGACY_BACKUP_TYPE,
      version: 1,
      exportedAt: Date.parse("2026-01-01T00:00:00.000Z"),
      index: [{ slug: "ukulele", title: "Ukulele", modified: Date.parse("2026-01-01T00:00:00.000Z") }],
      configs: { ukulele: config("Ukulele") },
    };
    const added = await s.importLegacyBackup(backup);
    expect(added).toBeGreaterThan(0);
    expect(s.list().map((x) => x.title)).toEqual(["Ukulele"]);
    expect(s.list().map((x) => x.showId)).toEqual(["slug:ukulele"]);

    const again = await s.importLegacyBackup(backup);
    expect(again).toBe(0);
    expect(s.list()).toHaveLength(1);
  });

  it("reduces a migrated legacy draft the same as a created one", async () => {
    const legacy = snapshotEvent("slug:ukulele", config("Ukulele"), "2026-09-01T00:00:00.000Z");
    const s = new DraftStore(createInMemoryStore([legacy]), [legacy], true);
    expect(s.list().map((x) => x.title)).toEqual(["Ukulele"]);
    expect(s.config("slug:ukulele")).toEqual(config("Ukulele"));
    // And it is editable from there like any other show.
    const working = s.open("slug:ukulele")!;
    working.config.title = "Ukulele, revised";
    await s.save(working);
    expect(s.config("slug:ukulele")?.title).toBe("Ukulele, revised");
  });
});
