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

export class DraftSession {
  showId: string | null = null;
  nodeKeys: (string | null)[] = [];
  private readonly store: DraftStore;
  private queue: Promise<void> = Promise.resolve();

  constructor(store: DraftStore) {
    this.store = store;
  }

  /** Take on an already-resolved show (a resume, or the result of `adoptExternalConfig`). */
  attach(showId: string, nodeKeys: (string | null)[]): void {
    this.showId = showId;
    this.nodeKeys = nodeKeys;
  }

  /** A brand-new, not-yet-saved show. */
  reset(): void {
    this.showId = null;
    this.nodeKeys = [];
  }

  /** `create()`s on the first call, `save()`s after; re-syncs `nodeKeys` from the store's
   * canonical state afterward, since the store — not the page — assigns real node keys. */
  persist(config: ShowConfig): Promise<void> {
    this.queue = this.queue.then(() => this.doPersist(config));
    return this.queue;
  }

  private async doPersist(config: ShowConfig): Promise<void> {
    if (this.showId === null) {
      this.showId = await this.store.create(config);
    } else {
      await this.store.save({ showId: this.showId, config, nodeKeys: this.nodeKeys });
    }
    this.nodeKeys = this.store.open(this.showId)?.nodeKeys ?? this.nodeKeys;
  }
}

export type AdoptOutcome =
  | { ok: true; showId: string; config: ShowConfig; nodeKeys: (string | null)[] }
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
  return { ok: true, showId, config: working.config, nodeKeys: working.nodeKeys };
}
