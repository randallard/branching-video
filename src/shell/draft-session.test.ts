import { describe, expect, it } from "vitest";
import type { ShowConfig } from "../core/config.ts";
import { DraftSession, adoptExternalConfig } from "./draft-session.ts";
import { DraftStore } from "./draft-store.ts";
import { createInMemoryStore } from "./event-store.ts";

const config = (title: string, nodeIds: string[] = ["intro"]): ShowConfig => ({
  title,
  startNode: nodeIds[0] ?? "",
  nodes: nodeIds.map((id) => ({ id, title: id, choices: [] })),
});

const store = (): DraftStore => new DraftStore(createInMemoryStore(), [], true);

describe("DraftSession", () => {
  it("creates on the first persist, saves after", async () => {
    const s = store();
    const session = new DraftSession(s);
    expect(session.showId).toBeNull();

    await session.persist(config("Ukulele"));
    expect(session.showId).not.toBeNull();
    expect(session.nodeKeys.every((k) => k !== null)).toBe(true);
    expect(s.config(session.showId!)?.title).toBe("Ukulele");

    const edited = { ...config("Ukulele"), title: "Ukulele, revised" };
    await session.persist(edited);
    expect(s.config(session.showId!)?.title).toBe("Ukulele, revised");
    expect(s.list()).toHaveLength(1);
  });

  it("serializes overlapping persists rather than racing them", async () => {
    const s = store();
    const session = new DraftSession(s);
    const first = session.persist(config("A"));
    const second = session.persist({ ...config("A"), title: "B" });
    await Promise.all([first, second]);
    expect(s.list()).toHaveLength(1);
    expect(s.config(session.showId!)?.title).toBe("B");
  });

  it("attach() and reset() switch which show persist() targets", async () => {
    const s = store();
    const otherId = await s.create(config("Other"));
    const session = new DraftSession(s);

    const working = s.open(otherId)!;
    session.attach(otherId, working.nodeKeys);
    await session.persist({ ...config("Other"), title: "Renamed" });
    expect(s.config(otherId)?.title).toBe("Renamed");
    expect(s.list()).toHaveLength(1);

    session.reset();
    await session.persist(config("Fresh"));
    expect(session.showId).not.toBe(otherId);
    expect(s.list()).toHaveLength(2);
  });

  it("coalesces a burst of persistSoon calls into one write per field", async () => {
    const s = store();
    const session = new DraftSession(s);
    await session.persist(config("U"));
    const before = (await s.allEvents()).length;

    const live = config("U");
    for (const title of ["Uk", "Uku", "Ukulele"]) {
      live.title = title;
      session.persistSoon(live);
    }
    await session.flush();

    expect((await s.allEvents()).length - before).toBe(1);
    expect(s.config(session.showId!)?.title).toBe("Ukulele");
  });

  it("writes a pending edit to the show it was made on, even if another is opened first", async () => {
    const s = store();
    const firstId = await s.create(config("First"));
    const secondId = await s.create(config("Second"));
    const session = new DraftSession(s);
    session.attach(firstId, s.open(firstId)!.nodeKeys);

    session.persistSoon({ ...config("First"), title: "First, edited" });
    session.attach(secondId, s.open(secondId)!.nodeKeys);
    await session.flush();

    expect(s.config(firstId)?.title).toBe("First, edited");
    expect(s.config(secondId)?.title).toBe("Second");
  });

  it("tells the page after each save lands", async () => {
    const s = store();
    const session = new DraftSession(s);
    let saves = 0;
    session.onSaved = () => saves++;
    await session.persist(config("A"));
    await session.persist(config("B"));
    expect(saves).toBe(2);
  });
});

describe("adoptExternalConfig", () => {
  it("adds a new show when no title matches", async () => {
    const s = store();
    const outcome = await adoptExternalConfig(s, config("New show"));
    expect(outcome.ok).toBe(true);
    expect(s.list().map((x) => x.title)).toEqual(["New show"]);
  });

  it("updates the matching show when the person confirms", async () => {
    const s = store();
    const id = await s.create(config("Ukulele", ["intro"]));
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    try {
      const outcome = await adoptExternalConfig(s, config("Ukulele", ["intro", "chords"]));
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.showId).toBe(id);
        expect(outcome.updated).toBe(true);
      }
      expect(s.list()).toHaveLength(1);
      expect(s.config(id)?.nodes).toHaveLength(2);
    } finally {
      globalThis.confirm = originalConfirm;
    }
  });

  it("adds a new show alongside the existing one when the person declines", async () => {
    const s = store();
    const id = await s.create(config("Ukulele", ["intro"]));
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => false;
    try {
      const outcome = await adoptExternalConfig(s, config("Ukulele", ["other"]));
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        expect(outcome.showId).not.toBe(id);
        expect(outcome.updated).toBe(false);
      }
      expect(s.list()).toHaveLength(2);
    } finally {
      globalThis.confirm = originalConfirm;
    }
  });
});
