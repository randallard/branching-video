/**
 * Handing a draft to another page in this browser (ADR-0029), and keeping the open show in the URL
 * so a reload reopens it.
 */
import type { ShowConfig } from "../core/config.ts";
import { showHash } from "../core/handoff.ts";
import type { DraftSession } from "./draft-session.ts";

/**
 * Open `page` in a new tab on the session's show. Everything happens synchronously inside the
 * click, so the popup keeps its user activation: a show with no id yet is persisted (which fixes
 * its id at once), then unsaved edits are flushed **and** parked in the unload backstop, which the
 * new page replays before it opens anything — so it sees the latest edit even if the write hasn't
 * landed.
 */
export function handOff(session: DraftSession, config: ShowConfig, page: string): void {
  if (session.showId === null) {
    // The failure surfaces through the backstop replay; nothing more to do with it here.
    session.persist(config).catch(() => undefined);
  }
  session.flush().catch(() => undefined);
  session.writeBackstop();
  const showId = session.showId;
  syncShowHash(showId);
  window.open(showId === null ? page : page + showHash(showId), "_blank");
}

/** Put `#show=<id>` in the address bar for the open show, or clear it when there is none. Replaces
 * the history entry rather than adding one: switching drafts is not navigation. */
export function syncShowHash(showId: string | null): void {
  const want = showId === null ? "" : showHash(showId);
  if (location.hash === want) return;
  history.replaceState(null, "", location.pathname + location.search + want);
}

/** Shown when a `#show=` fragment names a show this browser doesn't have (ADR-0029) — a link
 * from another device, or a draft since deleted. The page then boots as if it had no fragment. */
export const MISSING_DRAFT_TEXT =
  "That draft isn't in this browser's drafts, so it can't be opened here. Drafts live in the browser they were made in; use Export All and Import All on the home page to move them.";
