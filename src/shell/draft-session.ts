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
import type { BackstopEntry } from "./backstop.ts";
import { writeBackstop } from "./backstop.ts";
import type { DraftStore } from "./draft-store.ts";
import { newId } from "./draft-store.ts";

/** One open show. A queued save carries the slot it was queued against, so switching drafts while
 * a save is still pending can't land that save on the newly opened show. */
interface Slot {
  showId: string | null;
  nodeKeys: (string | null)[];
}

/** The newest edit to a slot that isn't in IndexedDB yet, and when it was made. */
interface Unsaved {
  slot: Slot;
  config: ShowConfig;
  at: string;
}

/** How long typing has to pause before it is written: one event per field per edit burst, not
 * per keystroke (ADR-0007) — which is also what keeps a field's history (ADR-0023) readable. */
export const EDIT_BURST_MS = 1000;

export class DraftSession {
  /** Names this session's unload backstop key, so two tabs can't overwrite each other's. */
  readonly id = newId();
  private slot: Slot = { showId: null, nodeKeys: [] };
  private readonly store: DraftStore;
  private queue: Promise<void> = Promise.resolve();
  private pending: { edit: Unsaved; timer: ReturnType<typeof setTimeout> } | null = null;
  private readonly unsaved = new Map<Slot, Unsaved>();
  private backstopStorage: Storage | null = null;
  private backstopWritten = false;
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

  /** Save now. The first save of a new show creates it; `nodeKeys` is re-synced afterwards. */
  persist(config: ShowConfig): Promise<void> {
    this.cancelPending();
    return this.enqueue(this.note(config));
  }

  /** `persist`, once typing pauses for `EDIT_BURST_MS`. Any other persist, `flush`, `attach` or
   * `reset` writes it straight away instead. */
  persistSoon(config: ShowConfig): void {
    this.cancelPending();
    const edit = this.note(config);
    const timer = setTimeout(() => {
      this.pending = null;
      void this.enqueue(edit);
    }, EDIT_BURST_MS);
    this.pending = { edit, timer };
  }

  /** Write a pending `persistSoon` now — before leaving the page, say. */
  flush(): Promise<void> {
    const p = this.pending;
    if (p === null) return this.queue;
    this.cancelPending();
    return this.enqueue(p.edit);
  }

  /** Park every edit not yet in IndexedDB in `storage`, synchronously (see `backstop.ts`). */
  useBackstop(storage: Storage): void {
    this.backstopStorage = storage;
  }

  writeBackstop(): void {
    const storage = this.backstopStorage;
    if (storage === null) return;
    const entries: BackstopEntry[] = [...this.unsaved.values()].map((u) => {
      const { showId, nodeKeys } = identify(u.slot);
      return { showId, nodeKeys: [...nodeKeys], config: JSON.parse(JSON.stringify(u.config)) as ShowConfig, at: u.at };
    });
    writeBackstop(storage, this.id, entries);
    this.backstopWritten = entries.length > 0;
  }

  /** Record an edit as unsaved, and give its show and any new nodes their ids now, so an
   * in-flight write and a backstop replay of the same edit agree on identity. */
  private note(config: ShowConfig): Unsaved {
    identify(this.slot);
    const edit = { slot: this.slot, config, at: this.store.peekNow() };
    this.unsaved.set(this.slot, edit);
    return edit;
  }

  private cancelPending(): void {
    if (this.pending !== null) clearTimeout(this.pending.timer);
    this.pending = null;
  }

  /** Chained, so saves land in order. A failed save rejects its own caller but must not wedge the
   * queue — otherwise one bad write would silently stop every save after it. */
  private enqueue(edit: Unsaved): Promise<void> {
    const run = this.queue.then(() => this.doPersist(edit));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async doPersist(edit: Unsaved): Promise<void> {
    const { showId, nodeKeys } = identify(edit.slot);
    await this.store.save({ showId, config: edit.config, nodeKeys });
    // In place, not reassigned: a page may hold this array and push to it between saves.
    const fresh = this.store.open(showId)?.nodeKeys;
    if (fresh !== undefined) edit.slot.nodeKeys.splice(0, edit.slot.nodeKeys.length, ...fresh);
    if (this.unsaved.get(edit.slot) === edit) this.unsaved.delete(edit.slot);
    if (this.unsaved.size === 0 && this.backstopWritten) this.writeBackstop();
    this.onSaved?.();
  }
}

/** Fill in a slot's missing ids — the show's, and any node added since the last save. */
function identify(slot: Slot): { showId: string; nodeKeys: string[] } {
  slot.showId ??= newId();
  for (let i = 0; i < slot.nodeKeys.length; i++) slot.nodeKeys[i] ??= newId();
  return { showId: slot.showId, nodeKeys: slot.nodeKeys as string[] };
}

/**
 * Park unsaved edits in `localStorage` whenever the page is hidden or going away (`backstop.ts`),
 * after starting the ordinary flush. `visibilitychange` covers mobile, where a backgrounded tab can
 * be killed without `pagehide`; the backstop is written on every hide, which is safe because a
 * replay never outranks an edit made after it.
 */
export function guardAgainstUnload(session: DraftSession): void {
  let storage: Storage;
  try {
    storage = localStorage;
  } catch {
    return;
  }
  session.useBackstop(storage);
  const park = (): void => {
    void session.flush();
    session.writeBackstop();
  };
  window.addEventListener("pagehide", park);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") park();
  });
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
