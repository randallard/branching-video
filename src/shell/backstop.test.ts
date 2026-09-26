import { describe, expect, it } from "vitest";
import type { BackstopEntry } from "./backstop.ts";
import { BACKSTOP_PREFIX, takeBackstop, writeBackstop } from "./backstop.ts";
import { memoryStorage } from "./memory-storage.test-util.ts";

const entry = (showId: string, at: string, title = "T"): BackstopEntry => ({
  showId,
  nodeKeys: ["k1"],
  config: { title, startNode: "a", nodes: [{ id: "a", title: "A", choices: [] }] },
  at,
});

describe("unload backstop storage", () => {
  it("takes every session's entries, oldest first, and removes them", () => {
    const s = memoryStorage();
    writeBackstop(s, "tab-a", [entry("s1", "2026-09-19T10:00:02.000Z")]);
    writeBackstop(s, "tab-b", [entry("s2", "2026-09-19T10:00:01.000Z")]);
    s.setItem("bvp:resume", "unrelated");

    expect(takeBackstop(s).map((e) => e.showId)).toEqual(["s2", "s1"]);
    expect(takeBackstop(s)).toEqual([]);
    expect(s.getItem("bvp:resume")).toBe("unrelated");
  });

  it("clears a session's key when it has nothing left to park", () => {
    const s = memoryStorage();
    writeBackstop(s, "tab-a", [entry("s1", "2026-09-19T10:00:00.000Z")]);
    writeBackstop(s, "tab-a", []);
    expect(s.length).toBe(0);
  });

  it("skips anything malformed rather than failing the page that boots", () => {
    const s = memoryStorage();
    s.setItem(`${BACKSTOP_PREFIX}garbage`, "{not json");
    s.setItem(`${BACKSTOP_PREFIX}not-a-list`, JSON.stringify({ showId: "x" }));
    const mismatched = { ...entry("s3", "2026-09-19T10:00:00.000Z"), nodeKeys: ["k1", "k2"] };
    writeBackstop(s, "mixed", [entry("s1", "2026-09-19T10:00:00.000Z"), mismatched]);
    expect(takeBackstop(s).map((e) => e.showId)).toEqual(["s1"]);
    expect(s.length).toBe(0);
  });

  it("never throws when storage does", () => {
    const broken = new Proxy(memoryStorage(), {
      get() {
        throw new Error("blocked");
      },
    });
    expect(() => {
      writeBackstop(broken, "tab", [entry("s1", "2026-09-19T10:00:00.000Z")]);
    }).not.toThrow();
    expect(takeBackstop(broken)).toEqual([]);
  });
});
