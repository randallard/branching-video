# ADR-0029 built: handoffs carry the show id

Built on branch `transfer-handoff-by-show-id`. **Not yet committed**; it's waiting on Ryan's local
check. The decision is [ADR-0029](../adr/0029-same-device-handoffs-carry-the-show-id-not-the-config.md),
committed as `93deb7c`. The bug that prompted it is in [the previous
entry](2026-09-26-backstop-browser-check-and-transfer-revert.md).

## What changed

- `src/core/handoff.ts`: `showHash` / `parseShowHash`, the `#show=<id>` fragment. It's
  percent-encoded because legacy ids are `slug:<slug>`. Property-tested round trip.
- `src/shell/handoff.ts`: `handOff(session, config, page)` for Studio's "Open in Editor" and the
  Editor's "Open in Studio". `syncShowHash` keeps the open show in the address bar.
  `MISSING_DRAFT_TEXT` is the alert for an id this browser doesn't have.
- Home page: the Studio and Editor links are plain `href`s to `#show=<id>`, so middle-click works.
  `bvp:resume` and its `setResume`/`takeResume` are gone.
- The Editor and Studio no longer receive `#transfer`. `bvp:transfer` is now the Player's
  alone. `adoptConfig` and its update-or-add prompt only see real files now.
- Studio gained `openShow(showId)`, shared by "Resume draft…" and the `#show=` boot. It turns
  away a draft with no master video with a setup-screen message instead of opening a workspace
  that can't play.

## The one design problem: the sender's newest edit

The Editor holds a typing burst for 1 s, and every write is async. `handOff` can't `await` the
write before `window.open` without risking the popup blocker. So, all synchronously inside the
click, it does ADR-0028's park: persist first if the show has no id yet (an untouched example),
start the flush, write the backstop, then open the tab. The new page's `openDraftStore()`
replays the parked edit.

That exposed a real race in `openDraftStore()` itself. It read the log, **then** took the parked
edits. The sender is still alive in a handoff and clears its key once its own write lands. A
write landing between the read and the take would be in neither. The take now happens *before*
the read. Either the key is still there (and replay is a no-op if the write also landed), or it
was cleared after the write committed, which means before the read. This also narrows the
ADR-0028 case where another open tab's write is in flight while a page boots.

## Keeping the URL honest

For "a reload reopens the show" to be true, the fragment has to follow whatever is open:

- **Editor:** set on `openDraft`/`adoptConfig`, cleared on `loadConfig`, and set on the first
  edit of a new show (`persistNow`/`persistSoon`), since ids are fixed at edit time.
- **Studio:** set in `enterWorkspace` (which persists at once, so the id exists by then), and
  cleared in `resetToSetup`.

`replaceState` is used, not `pushState`: switching drafts isn't navigation, and Back shouldn't walk
through them.

## Verification

- `pnpm lint` clean, `pnpm test` 138 (was 135; +3 for the hash helpers), `pnpm e2e` 69 (was 62).
- **New e2e:**
  - a stale Studio tab handing off reverts nothing and makes no copy (this entry's bug, as a test);
  - a Studio edit just before Open in Editor arrives;
  - Open in Studio carries an in-burst edit even with the Editor's IndexedDB writes failing, so
    only the parked copy can carry it;
  - Open in Studio from the untouched example makes exactly one draft;
  - the Editor reload reopens the draft;
  - an unknown `#show=` id in the Editor and in Studio.
- **Updated e2e:** the home page's Editor link and Studio's Open in Editor no longer queue a
  `confirm`. The harness fails on any unexpected dialog, so these now *assert* there's no prompt.
  The home Studio link test also checks that a reload keeps the draft.
- **Mutation check:** removing `session.writeBackstop()` from `handOff` fails the
  writes-never-land test.
- **In Chrome against the dev server** (`127.0.0.1:8080`, a separate origin from Ryan's drafts):
  1. The home Studio link opened `studio.html#show=<id>`.
  2. Open in Editor opened the same id with no prompt.
  3. I changed the title in the Editor (⟲ 2), then clicked Open in Editor again from the Studio
     tab, which still showed the old title.
  4. The new Editor showed the Editor's edit, with one draft and zero `show-snapshot` events.
