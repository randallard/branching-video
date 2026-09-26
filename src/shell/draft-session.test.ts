import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShowConfig } from "../core/config.ts";
import { takeBackstop } from "./backstop.ts";
import { DraftSession, adoptExternalConfig } from "./draft-session.ts";
import { DraftStore } from "./draft-store.ts";
import { createInMemoryStore } from "./event-store.ts";
import { memoryStorage } from "./memory-storage.test-util.ts";

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

describe("the unload backstop", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** A page's session over a shared log, and a "next page" that opens the same log afresh. */
  async function setup() {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-19T10:00:00.000Z"));
    const log = createInMemoryStore();
    const storage = memoryStorage();
    const first = new DraftStore(log, [], true);
    const session = new DraftSession(first);
    session.useBackstop(storage);
    await session.persist(config("Ukulele", ["intro"]));
    const showId = session.showId!;
    const nextPage = async (): Promise<{ store: DraftStore; appended: number }> => {
      const store = new DraftStore(log, await log.all(), true);
      return { store, appended: await store.replay(takeBackstop(storage)) };
    };
    return { log, storage, first, session, showId, nextPage };
  }

  it("recovers an edit whose write never landed before the page went away", async () => {
    const { session, showId, nextPage } = await setup();
    vi.setSystemTime(new Date("2026-09-19T10:00:05.000Z"));
    session.persistSoon({ ...config("Ukulele", ["intro"]), title: "Typed as the tab closed" });
    session.writeBackstop(); // pagehide — and the page dies before the burst is written

    const { store } = await nextPage();
    expect(store.config(showId)?.title).toBe("Typed as the tab closed");
  });

  it("never lets a replay outrank an edit made after it", async () => {
    const { session, storage, showId, nextPage } = await setup();
    vi.setSystemTime(new Date("2026-09-19T10:00:05.000Z"));
    session.persistSoon({ ...config("Ukulele", ["intro"]), title: "Parked on hide" });
    session.writeBackstop(); // the tab was hidden, not closed…
    const key = storage.key(0) ?? "";
    const parked = storage.getItem(key) ?? "";
    vi.setSystemTime(new Date("2026-09-19T10:00:09.000Z"));
    await session.persist({ ...config("Ukulele", ["intro"]), title: "Edited after coming back" });
    // …and the parked copy outlived it (a crash before the key was cleared), so it gets replayed.
    storage.setItem(key, parked);
    const { store, appended } = await nextPage();
    expect(appended).toBeGreaterThan(0); // it really did replay…
    expect(store.config(showId)?.title).toBe("Edited after coming back"); // …and lost to the newer edit
  });

  it("adds nothing when replaying an edit that did land", async () => {
    const { session, storage, nextPage } = await setup();
    session.persistSoon({ ...config("Ukulele", ["intro"]), title: "Landed" });
    session.writeBackstop();
    const key = storage.key(0) ?? "";
    const parked = storage.getItem(key) ?? "";
    await session.flush(); // the write lands and the session clears its key…
    storage.setItem(key, parked); // …unless the page died in between: put it back.
    const { appended } = await nextPage();
    expect(appended).toBe(0);
  });

  it("fixes a new node's key when the edit is made, so a replay can't duplicate it", async () => {
    const { session, showId, nextPage } = await setup();
    const edited = config("Ukulele", ["intro", "chords"]);
    session.nodeKeys.push(null);
    session.persistSoon(edited);
    expect(session.nodeKeys.every((k) => k !== null)).toBe(true);
    session.writeBackstop();
    await session.flush(); // the write landed too

    const { store, appended } = await nextPage();
    expect(appended).toBe(0);
    expect(store.config(showId)?.nodes.map((n) => n.id)).toEqual(["intro", "chords"]);
  });

  it("clears its parked edits once they have all landed", async () => {
    const { session, storage } = await setup();
    session.persistSoon({ ...config("Ukulele", ["intro"]), title: "Briefly parked" });
    session.writeBackstop();
    expect(storage.length).toBe(1);
    await session.flush();
    expect(storage.length).toBe(0);
  });
});

describe("a failed save", () => {
  it("rejects its own caller but doesn't stop the saves after it", async () => {
    const inner = createInMemoryStore();
    let failNext = false;
    const flaky = {
      append: async (events: Parameters<typeof inner.append>[0]) => {
        if (failNext) {
          failNext = false;
          throw new Error("disk full");
        }
        await inner.append(events);
      },
      all: () => inner.all(),
    };
    const s = new DraftStore(flaky, [], true);
    const session = new DraftSession(s);
    await session.persist(config("A"));
    failNext = true;
    await expect(session.persist({ ...config("A"), title: "B" })).rejects.toThrow("disk full");
    await session.persist({ ...config("A"), title: "C" });
    expect(s.config(session.showId!)?.title).toBe("C");
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
