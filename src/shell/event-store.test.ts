import { describe, expect, it } from "vitest";
import type { ShowEvent } from "../core/events.ts";
import { createInMemoryStore } from "./event-store.ts";

const event = (id: string): ShowEvent => ({
  id,
  at: "2026-09-15T12:00:00.000Z",
  v: 1,
  kind: "show-field-set",
  showId: "s",
  field: "title",
  value: id,
});

describe("event store contract", () => {
  it("appends and reads back", async () => {
    const store = createInMemoryStore();
    await store.append([event("a"), event("b")]);
    expect([...(await store.all())].map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("is idempotent by event id", async () => {
    // Re-running the migration or finishing a partly-applied import must not duplicate anything.
    const store = createInMemoryStore();
    await store.append([event("a")]);
    await store.append([event("a"), event("b")]);
    expect(await store.all()).toHaveLength(2);
  });

  it("accepts an empty append", async () => {
    const store = createInMemoryStore();
    await store.append([]);
    expect(await store.all()).toHaveLength(0);
  });

  it("starts from a seed", async () => {
    const store = createInMemoryStore([event("seeded")]);
    expect((await store.all()).map((e) => e.id)).toEqual(["seeded"]);
  });
});
