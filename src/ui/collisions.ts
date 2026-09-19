/**
 * ADR-0024: a node one device deleted while another was editing it is reported to the person
 * rather than silently resolved. Collisions only arise from `importBundle()` (merging another
 * device's fine-grained event stream) — a whole-show snapshot import (`importConfig`,
 * `importLegacyBackup`) can't produce one, since it replaces the show outright.
 *
 * One `confirm()` per collision, matching the codebase's existing minimal-chrome style — the one
 * custom modal this project had (the home page's merge UI) retires in this same slice, so this
 * doesn't build a replacement for what is, in practice, a rare case.
 */
import type { DraftStore } from "../shell/draft-store.ts";

export async function notifyCollisions(store: DraftStore): Promise<void> {
  for (const c of store.collisions()) {
    const title = store.find(c.showId)?.title || "Untitled show";
    const bring = confirm(
      `In "${title}", the node "${c.node.title || c.node.id}" was edited at ` +
        `${new Date(c.lastEditAt).toLocaleString()}, but it was deleted at ` +
        `${new Date(c.removedAt).toLocaleString()} (${String(c.discardedEdits)} edit(s) would be lost).\n\n` +
        `OK = bring the node back.\nCancel = leave it deleted.`
    );
    if (bring) await store.restoreNode(c);
    else await store.confirmRemoval(c);
  }
}
