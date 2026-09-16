/**
 * The event store (ADR-0007): append and read-all, and nothing else.
 *
 * The store deliberately has no semantics — `reduce` owns all meaning. Appends are idempotent by
 * event id (`put`), so replaying a bundle, re-running the migration, or finishing a partly-applied
 * import is harmless. Union semantics all the way down.
 *
 * The interface is async because the real store is IndexedDB, which `localStorage` is not: the log
 * grows without bound (ADR-0007 defers compaction), and `localStorage`'s ~5 MB cap is a ceiling a
 * busy Studio would reach.
 */
import type { ShowEvent } from "../core/events.ts";
import { isShowEvent } from "../core/events.ts";

export interface EventStore {
  append(events: readonly ShowEvent[]): Promise<void>;
  all(): Promise<readonly ShowEvent[]>;
}

/** Same contract, held in memory — for tests and for a browser that won't give us IndexedDB. */
export function createInMemoryStore(seed: readonly ShowEvent[] = []): EventStore {
  const events = new Map<string, ShowEvent>(seed.map((e) => [e.id, e]));
  return {
    append: (batch) => {
      for (const e of batch) events.set(e.id, e);
      return Promise.resolve();
    },
    all: () => Promise.resolve([...events.values()]),
  };
}

const DB_NAME = "branching-video";
const DB_VERSION = 1;
const STORE = "events";

function asPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error ?? new Error("IndexedDB request failed"));
    };
  });
}

/** Open (creating on first run) the IndexedDB-backed store. Events are keyed by their id, so a
 * repeated append overwrites an identical event rather than duplicating it. */
export function openIndexedDbStore(dbName = DB_NAME): Promise<EventStore> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(dbName, DB_VERSION);
    open.onupgradeneeded = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    open.onerror = () => {
      reject(open.error ?? new Error(`IndexedDB open failed: ${dbName}`));
    };
    open.onsuccess = () => {
      const db = open.result;
      resolve({
        append: async (batch) => {
          if (batch.length === 0) return;
          const tx = db.transaction(STORE, "readwrite");
          const store = tx.objectStore(STORE);
          await Promise.all(batch.map((e) => asPromise(store.put(e))));
          await new Promise<void>((done, fail) => {
            tx.oncomplete = () => {
              done();
            };
            tx.onerror = () => {
              fail(tx.error ?? new Error("IndexedDB transaction failed"));
            };
          });
        },
        all: async () => {
          const store = db.transaction(STORE, "readonly").objectStore(STORE);
          const rows: unknown[] = await asPromise(store.getAll());
          // Anything that isn't event-shaped was not written by us; the reducer tolerates unknown
          // kinds, but it is entitled to a well-formed envelope.
          return rows.filter(isShowEvent);
        },
      });
    };
  });
}

/**
 * The store this build uses, falling back to memory when IndexedDB is unavailable — a private
 * window with storage blocked, say. A fallback store is not persisted, so the caller is told,
 * and the page can warn rather than quietly losing the session's work.
 */
export async function openEventStore(): Promise<{ store: EventStore; persistent: boolean }> {
  try {
    if (typeof indexedDB === "undefined") return { store: createInMemoryStore(), persistent: false };
    return { store: await openIndexedDbStore(), persistent: true };
  } catch {
    return { store: createInMemoryStore(), persistent: false };
  }
}
