import { describe, expect, it } from "vitest";
import type { ShowConfig } from "../core/config.ts";
import { DraftStore } from "../shell/draft-store.ts";
import { createInMemoryStore } from "../shell/event-store.ts";
import { notifyCollisions } from "./collisions.ts";

const config = (title: string, nodeIds: string[] = ["intro"]): ShowConfig => ({
  title,
  startNode: nodeIds[0] ?? "",
  nodes: nodeIds.map((id) => ({ id, title: id, choices: [] })),
});

const store = (): DraftStore => new DraftStore(createInMemoryStore(), [], true);

/** One device deletes a node; another, later, edits it — same fixture shape as
 * draft-store.test.ts's own collision tests. */
async function collided(): Promise<DraftStore> {
  const s = store();
  const id = await s.create(config("Show", ["a", "b"]));
  const keyOfB = s.find(id)!.nodes[1]!.nodeKey;

  const dropped = s.open(id)!;
  dropped.config.nodes = [dropped.config.nodes[0]!];
  dropped.nodeKeys = [dropped.nodeKeys[0]!];
  await s.save(dropped);

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

describe("notifyCollisions", () => {
  it("does nothing when there are no collisions", async () => {
    const s = store();
    await s.create(config("Untouched"));
    await notifyCollisions(s);
    expect(s.collisions()).toEqual([]);
  });

  it("restores the node when the person confirms", async () => {
    const s = await collided();
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    try {
      await notifyCollisions(s);
    } finally {
      globalThis.confirm = originalConfirm;
    }
    expect(s.collisions()).toEqual([]);
    const showId = s.list()[0]!.showId;
    expect(s.config(showId)?.nodes.map((n) => n.id)).toContain("b");
  });

  it("leaves the node deleted when the person declines", async () => {
    const s = await collided();
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => false;
    try {
      await notifyCollisions(s);
    } finally {
      globalThis.confirm = originalConfirm;
    }
    expect(s.collisions()).toEqual([]);
    const showId = s.list()[0]!.showId;
    expect(s.config(showId)?.nodes.map((n) => n.id)).not.toContain("b");
  });
});
