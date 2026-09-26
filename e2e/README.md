# Browser tests

The Playwright suite from [ADR-0027](../docs/adr/0027-playwright-browser-tests-against-the-built-site.md):
Chromium, against the **built** site under `vite preview`, hermetic.

```sh
pnpm exec playwright install chromium   # once per machine, and after a Playwright bump
pnpm e2e                                # builds, then runs the suite on port 4299
pnpm exec playwright test -g "history"  # a subset (after a build)
pnpm exec playwright test --ui          # watch it run
```

The preview runs on **4299** (`E2E_PORT` to change it), so a run never touches the dev server on
8080. Locally an already-running server on that port is reused; in CI it never is.

## How it works

- `support/app.ts` gives every test an `app` fixture: a browser context where
  `www.youtube.com/iframe_api` is answered by `support/fake-youtube.js`, the oEmbed title lookup
  returns `"Fake Video Title"`, `/e2e-fixtures/*` serves `fixtures/`, and every other off-origin
  request is aborted. Every page in the context (popups included) is watched.
- **A test fails** on any console error, uncaught exception or CSP violation (ADR-0026's standing
  check), on a `confirm`/`prompt` it didn't queue, and on one it queued that never appeared.
  Queue answers with `dialogs.confirm(true)` / `dialogs.prompt("text")` *before* the action.
  Alerts are accepted and kept; `await dialogs.alert(/pattern/)` waits for the next new one.
  A test that expects an error says so with `app.allow.push(/pattern/)`.
- **The fake player** has a clock the test drives. Time advances only while playing, at
  `window.__ytRate` seconds per second (`ytRate(page, 200)` to fast-forward), and `ytJump(page, t)`
  moves it without a seek. A segment loaded with `endSeconds` fires ENDED when it gets there; a
  `seekTo` drops the old end, so the player's own backstop owns the boundary. It is a *model* of
  YouTube's API. Passing against it shows the routing logic is right given the model, not that
  YouTube agrees, which is why real playback is on the manual list below.
- Two-device tests (`two-devices.e2e.ts`) use one browser context per device, each with its own
  IndexedDB, and move bundles between them with Export All / Import All.

| File | Covers |
|---|---|
| `pages.e2e.ts` | Every page loads clean under its CSP; the harness itself catches a violation |
| `player.e2e.ts` | Play-through of the real ukulele file (ADR-0022), choices + countdown + pause, mid-segment cues, asides (back-to-branch, auto-resume, skip), end screens, chapter menu, back/forward, deep links, a missing config |
| `home.e2e.ts` | Import All of a config / legacy backup / junk / multi-file, update-or-add both ways, Export All → fresh browser, the Studio/Editor/Play links |
| `studio.e2e.ts` | Marking against the playing video, transport + keyboard, import update-or-add, legacy-file refusal, sidebar history, resume, hand-off to Editor/Player |
| `editor.e2e.ts` | Edit-burst coalescing and history on every field kind, id restore cascading, autosave + reload, a pending edit surviving a draft switch, `focusout` flush (fake clock), an edit surviving the tab closing mid-write (ADR-0028), add/delete + validation, Export As (download and save-picker paths), Open…, Copy JSON, New… from a URL |
| `mobile.e2e.ts` | Pixel 7 emulation: the Editor drawer, history in the drawer, My Drafts by number, no sideways scroll on any page |
| `two-devices.e2e.ts` | Same-field conflict (later wins, loser recoverable), different fields both survive, delete-vs-edit collision both answers (ADR-0024) |

## What stays manual

These need a person or the real thing, and the suite can't stand in for them. Run through them
before telling anyone the site is ready, and after anything touching the player, the YouTube shim
or page layout.

1. **Real YouTube playback feel.** On the live site or `pnpm dev`, play `live/big-buck-bunny.json`
   and the ukulele show. Check: segment transitions don't flash black or hitch; choices appear at
   the right moment; the countdown bar drains smoothly and pauses when you pause; asides return
   where they should; no ads or consent screens break the flow.
2. **Studio against a real video.** Mark a few nodes while it plays and check the times match
   what you saw.
3. **A real phone.** Open the home page, Editor and player on an actual phone: the drawer, the
   ⟲ history panels, choice buttons big enough to tap, the player filling the screen.
   Also: type in the Editor, switch straight to another app, swipe the browser away, and reopen.
   The edit should be there (ADR-0028's backstop; the suite can't kill a real mobile tab).
4. **The native save dialog.** In desktop Chrome, Editor → Export As… should open the OS
   "Save As" dialog (the suite stubs it), and Export after that writes the same file.
5. **`create.html` as a newcomer.** Read it top to bottom as someone following the steps, on
   the live site.
