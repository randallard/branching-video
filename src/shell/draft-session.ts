/**
 * The bookkeeping Studio and the Editor need identically once they're wired onto `DraftStore`
 * (slice 3b.3): which show is open, its `nodeKeys` (kept aligned with `config.nodes` by the page's
 * own node add/delete handlers), and a persist queue.
 *
 * The queue exists because `DraftStore`'s own doc comments record a real bug found in 3b parts
 * 1-2: two saves issued close enough together can race the store's `(at, id)` event ordering.
 * Chaining every `persist()` call onto the previous one removes that race without the caller
 * needing to think about it.
 */
import type { ShowConfig } from "../core/config.ts";
import type { DraftStore } from "./draft-store.ts";

/** One open show. A queued save carries the slot it was queued against, so switching drafts while
 * a save is still pending can't land that save on the newly opened show. */
interface Slot {
  showId: string | null;
  nodeKeys: (string | null)[];
}

/** How long typing has to pause before it is written: one event per field per edit burst, not
 * per keystroke (ADR-0007) — which is also what keeps a field's history (ADR-0023) readable. */
export const EDIT_BURST_MS = 1000;

export class DraftSession {
  private slot: Slot = { showId: null, nodeKeys: [] };
  private readonly store: DraftStore;
  private queue: Promise<void> = Promise.resolve();
  private pending: { slot: Slot; config: ShowConfig; timer: ReturnType<typeof setTimeout> } | null = null;
  /** Called after every save lands, so a page can refresh what it derives from the log. */
  onSaved: (() => void) | null = null;

  constructor(store: DraftStore) {
    this.store = store;
  }

  get showId(): string | null {
    return this.slot.showId;
  }

  /** Aligned with the open config's nodes; pages push/splice it as they add and delete nodes. */
  get nodeKeys(): (string | null)[] {
    return this.slot.nodeKeys;
  }

  /** Take on an already-resolved show (a resume, or the result of `adoptExternalConfig`). */
  attach(showId: string, nodeKeys: (string | null)[]): void {
    void this.flush();
    this.slot = { showId, nodeKeys };
  }

  /** A brand-new, not-yet-saved show. */
  reset(): void {
    void this.flush();
    this.slot = { showId: null, nodeKeys: [] };
  }

  /** `create()`s on the first call, `save()`s after; re-syncs `nodeKeys` from the store's
   * canonical state afterward, since the store — not the page — assigns real node keys. */
  persist(config: ShowConfig): Promise<void> {
    this.cancelPending();
    return this.enqueue(this.slot, config);
  }

  /** `persist`, once typing pauses for `EDIT_BURST_MS`. Any other persist, `flush`, `attach` or
   * `reset` writes it straight away instead. */
  persistSoon(config: ShowConfig): void {
    this.cancelPending();
    const slot = this.slot;
    const timer = setTimeout(() => {
      this.pending = null;
      void this.enqueue(slot, config);
    }, EDIT_BURST_MS);
    this.pending = { slot, config, timer };
  }

  /** Write a pending `persistSoon` now — before leaving the page, say. */
  flush(): Promise<void> {
    const p = this.pending;
    if (p === null) return this.queue;
    this.cancelPending();
    return this.enqueue(p.slot, p.config);
  }

  private cancelPending(): void {
    if (this.pending !== null) clearTimeout(this.pending.timer);
    this.pending = null;
  }

  private enqueue(slot: Slot, config: ShowConfig): Promise<void> {
    this.queue = this.queue.then(() => this.doPersist(slot, config));
    return this.queue;
  }

  private async doPersist(slot: Slot, config: ShowConfig): Promise<void> {
    if (slot.showId === null) {
      slot.showId = await this.store.create(config);
    } else {
      await this.store.save({ showId: slot.showId, config, nodeKeys: slot.nodeKeys });
    }
    // In place, not reassigned: a page may hold this array and push to it between saves.
    const fresh = this.store.open(slot.showId)?.nodeKeys;
    if (fresh !== undefined) slot.nodeKeys.splice(0, slot.nodeKeys.length, ...fresh);
    this.onSaved?.();
  }
}

export type AdoptOutcome =
  | { ok: true; showId: string; config: ShowConfig; nodeKeys: (string | null)[]; updated: boolean }
  | { ok: false; reason: string };

/**
 * The shared tail of "adopt a config from outside" (file open, `#transfer`, "Import config
 * JSON…") — ADR-0011's update-or-add question. The caller validates the config for its own
 * page's needs (Studio requires `masterVideoId`, the Editor doesn't) before calling this.
 *
 * A `confirm()` rather than a custom modal, matching the codebase's existing minimal-chrome style
 * — the one custom modal (the home page's merge UI) retires in this same slice.
 */
export async function adoptExternalConfig(
  store: DraftStore,
  config: ShowConfig
): Promise<AdoptOutcome> {
  const matches = store.matchingTitle(config.title);
  let onto: string | null = null;
  const first = matches[0];
  if (first) {
    const update = confirm(
      `A draft titled "${config.title}" already exists.\n\n` +
        `OK = update that draft.\nCancel = add this as a new, separate draft.`
    );
    if (update) onto = first.showId;
  }
  const showId = await store.importConfig(config, onto);
  const working = store.open(showId);
  if (!working) return { ok: false, reason: "Import failed unexpectedly." };
  return { ok: true, showId, config: working.config, nodeKeys: working.nodeKeys, updated: onto !== null };
}
