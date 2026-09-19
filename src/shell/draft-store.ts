/**
 * Drafts, on top of the event log (ADR-0007) — the seam the pages use instead of `drafts.ts`.
 *
 * It holds the event store, the reduced shows, and the rules for turning an edit into events. The
 * pages get a small document-shaped API (`list`, `open`, `save`) and never see an event, which is
 * what keeps the move off `localStorage` from rewriting Studio and the Editor.
 *
 * `bvp:transfer` and `bvp:resume` deliberately stay in `localStorage` (`drafts.ts`): they are
 * ephemeral page-to-page plumbing — one config handed from Studio to the Editor, one id the home
 * page asks Studio to open — not drafts, and nothing about them needs to merge or survive.
 */
import type { ShowConfig } from "../core/config.ts";
import { diffShow, emptyShowState, workingFromState } from "../core/diff.ts";
import type { WorkingShow } from "../core/diff.ts";
import type { ShowEvent } from "../core/events.ts";
import { parseBundle, serializeBundle, unionEvents } from "../core/bundle.ts";
import type { RemovalCollision, ShowState, ShowsState } from "../core/reduce.ts";
import { findShow, reduce, toConfig } from "../core/reduce.ts";
import {
  draftsFromLegacyBackup,
  migrateLocalDrafts,
  snapshotEvent,
  snapshotEventsFromDrafts,
} from "../core/migrate.ts";
import type { LegacyBackup } from "../core/legacy-backup.ts";
import { loadDraftConfig, loadDraftIndex } from "./drafts.ts";
import type { EventStore } from "./event-store.ts";
import { openEventStore } from "./event-store.ts";

/** Set once the `localStorage` drafts have been folded in. The migration is idempotent anyway —
 * snapshot ids are content hashes (ADR-0011) — so this is an optimisation, not a correctness
 * guard, and a cleared marker costs a redundant pass rather than duplicate shows. */
const MIGRATED_KEY = "bvp:migrated-to-events";

/** What the home page and Studio's resume list show. */
export interface ShowSummary {
  showId: string;
  title: string;
  nodeCount: number;
  updatedAt: string;
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export class DraftStore {
  private state: ShowsState = reduce([]);
  private readonly store: EventStore;
  /** False when IndexedDB was unavailable, so the page can say the session won't be kept. */
  readonly persistent: boolean;

  /** The last timestamp this store issued — see `now()`. */
  private lastAt = "";

  constructor(store: EventStore, events: readonly ShowEvent[], persistent: boolean) {
    this.store = store;
    this.persistent = persistent;
    this.adopt(events);
  }

  /**
   * Take on an event set: reduce it, and never issue a timestamp that sorts before any of it.
   *
   * The second half matters as much as the first. After syncing from another device, an event this
   * device creates has to sort *after* what it has just seen — otherwise the edit appears to have
   * happened before events already in hand and is overridden by them, or worse lands before the
   * `node-added` it refers to and is dropped entirely. That was a real bug: a device that imported
   * a bundle and then edited it produced an event in the same millisecond as the import's, and the
   * random id tiebreak decided whether the edit survived.
   *
   * The cost is ADR-0008's accepted one: a device with a badly wrong clock drags everyone's
   * timestamps forward with it. Edits that visibly land beat edits that silently vanish.
   */
  private adopt(events: readonly ShowEvent[]): void {
    this.state = reduce(events);
    for (const e of events) if (e.at > this.lastAt) this.lastAt = e.at;
  }

  /**
   * A timestamp strictly after the last one this store issued.
   *
   * ADR-0008 orders events by `(at, id)` and breaks ties by id — which is random. Timestamps are
   * only millisecond-precise and one save writes several events at once, so a device's own edits
   * routinely land in the same millisecond and would then be ordered by coin toss: a `node-removed`
   * could sort before the `node-added` it followed. Stepping forward keeps a device's own edits in
   * the order they were made. Across devices the real clocks still decide, as ADR-0008 accepts.
   */
  private now(): string {
    const wall = new Date().toISOString();
    const at = wall > this.lastAt ? wall : new Date(Date.parse(this.lastAt) + 1).toISOString();
    this.lastAt = at;
    return at;
  }

  private async append(events: readonly ShowEvent[]): Promise<ShowEvent[]> {
    if (events.length === 0) return [];
    await this.store.append(events);
    this.adopt(await this.store.all());
    return [...events];
  }

  /** Undeleted shows, most recently edited first. */
  list(): ShowSummary[] {
    return this.state.shows
      .filter((s) => !s.deleted)
      .map((s) => ({
        showId: s.showId,
        title: s.title,
        nodeCount: s.nodes.length,
        updatedAt: s.updatedAt,
      }));
  }

  find(showId: string): ShowState | undefined {
    return findShow(this.state, showId);
  }

  /** The config for a show, as the pages and the player expect it. */
  config(showId: string): ShowConfig | null {
    const show = this.find(showId);
    return show === undefined ? null : toConfig(show);
  }

  /** A show opened for editing: the config plus the node keys the diff will need back. */
  open(showId: string): WorkingShow | null {
    const show = this.find(showId);
    return show === undefined ? null : workingFromState(show, toConfig(show));
  }

  /** Save an edited show. Returns the events appended — empty when nothing changed, which is what
   * makes this safe to call on every autosave. */
  async save(working: WorkingShow): Promise<ShowEvent[]> {
    const before = this.find(working.showId) ?? emptyShowState(working.showId);
    return this.append(
      diffShow(before, working, {
        at: this.now(),
        newEventId: newId,
        newNodeKey: newId,
      })
    );
  }

  /** A brand-new show. Returns its generated id (ADR-0009). */
  async create(config: ShowConfig): Promise<string> {
    const showId = newId();
    await this.save({ showId, config, nodeKeys: config.nodes.map(() => null) });
    return showId;
  }

  async remove(showId: string): Promise<void> {
    await this.append([
      { id: newId(), at: this.now(), v: 1, kind: "show-deleted", showId },
    ]);
  }

  async restore(showId: string): Promise<void> {
    await this.append([
      { id: newId(), at: this.now(), v: 1, kind: "show-restored", showId },
    ]);
  }

  /** Import a single-show config file onto an existing show, or as a new one (ADR-0011). */
  async importConfig(config: ShowConfig, onto: string | null): Promise<string> {
    const showId = onto ?? newId();
    await this.append([snapshotEvent(showId, config, this.now())]);
    return showId;
  }

  /** Shows whose title matches a config file, for ADR-0011's update-or-add question. */
  matchingTitle(title: string): ShowSummary[] {
    return this.list().filter((s) => s.title === title);
  }

  /** Delete-versus-edit collisions awaiting an answer (ADR-0024). */
  collisions(): RemovalCollision[] {
    return this.state.collisions;
  }

  /** Answer a collision by bringing the node back. */
  async restoreNode(collision: RemovalCollision): Promise<void> {
    const show = this.find(collision.showId);
    const order = show?.nodes[show.nodes.length - 1]?.order ?? "";
    await this.append([
      {
        id: newId(),
        at: this.now(),
        v: 1,
        kind: "node-added",
        showId: collision.showId,
        nodeKey: collision.nodeKey,
        node: collision.node,
        order: order === "" ? "V" : order + "V",
      },
    ]);
  }

  /** Answer a collision by leaving the node deleted — recorded as a fresh removal, which puts the
   * discarded edits behind it (ADR-0024). */
  async confirmRemoval(collision: RemovalCollision): Promise<void> {
    await this.append([
      {
        id: newId(),
        at: this.now(),
        v: 1,
        kind: "node-removed",
        showId: collision.showId,
        nodeKey: collision.nodeKey,
      },
    ]);
  }

  async exportBundle(): Promise<string> {
    return serializeBundle(await this.store.all(), new Date().toISOString());
  }

  /** Merge an event bundle. Union only — an import can add events, never remove them. */
  async importBundle(raw: unknown): Promise<number> {
    const incoming = parseBundle(raw);
    const existing = await this.store.all();
    const before = existing.length;
    await this.store.append(incoming);
    const after = await this.store.all();
    this.adopt(after);
    return after.length - before;
  }

  /** Every event, for a caller that wants to merge sets itself. */
  async allEvents(): Promise<readonly ShowEvent[]> {
    return this.store.all();
  }

  /** Import an old `bvp-backup` bundle as snapshot events (ADR-0011) — each draft lands on the
   * same deterministic `slug:<slug>` show a `localStorage` migration would have used, so a backup
   * and the browser it came from never fork. No update-or-add question: unlike a single-show
   * config file, a legacy draft already has an identity. Returns the event count appended, after
   * dedup — content-hash ids make re-importing the same backup a no-op. */
  async importLegacyBackup(backup: LegacyBackup): Promise<number> {
    const drafts = draftsFromLegacyBackup(backup);
    const events = snapshotEventsFromDrafts(drafts, this.now());
    const existing = await this.store.all();
    const before = existing.length;
    await this.store.append(events);
    const after = await this.store.all();
    this.adopt(after);
    return after.length - before;
  }
}

/**
 * Open the store and fold in anything still living in `localStorage` (ADR-0011). The `bvp:*` keys
 * are left exactly where they are, so rolling back to the previous build loses nothing.
 */
export async function openDraftStore(): Promise<DraftStore> {
  const { store, persistent } = await openEventStore();

  let migrated: boolean;
  try {
    migrated = localStorage.getItem(MIGRATED_KEY) !== null;
  } catch {
    // Storage blocked entirely; fall through and let the content-hash ids keep it idempotent.
    migrated = false;
  }

  if (!migrated) {
    const events = migrateLocalDrafts(loadDraftIndex(), loadDraftConfig, new Date().toISOString());
    if (events.length > 0) await store.append(events);
    try {
      localStorage.setItem(MIGRATED_KEY, new Date().toISOString());
    } catch {
      // No localStorage to remember it in; the content-hash ids make a repeat pass harmless.
    }
  }

  return new DraftStore(store, unionEvents(await store.all()), persistent);
}
