# ADR-0027: a committed Playwright suite, and the three bugs it found on its first day

After ADR-0023 I offered Ryan a manual testing doc for everything still marked "needs a real
browser". He asked whether Playwright was the better answer. It was, and he said go.
[ADR-0027](../adr/0027-playwright-browser-tests-against-the-built-site.md) records the decision
and why Vitest browser mode, Cypress and "keep the CDP scripts" lost. Committed as `060f897` on
branch `adr-0023-history-and-e2e-suite`, with the ADR-0023 work, and opened as a PR.

## Shape

- `@playwright/test` **1.63.0**, exact pin, 15 days old on the day (ADR-0014's gate is 14). Three
  packages, all Apache-2.0 (or MIT for the optional `fsevents`); `pnpm audit` clean,
  288/288 signatures, licence allowlist passes. Chromium comes from an explicit
  `playwright install chromium`, not an install script.
- Runs against `vite preview` of the **built** site on port 4299 (`pnpm e2e` builds first), so
  the dev server on 8080 is never touched.
- **Hermetic.** `support/app.ts` routes every request in each browser context:
  `www.youtube.com/iframe_api` → `support/fake-youtube.js`, `/oembed` → a canned title,
  `/e2e-fixtures/*` → `e2e/fixtures/`, everything else off-origin → aborted. The CSP already
  allows scripts from `www.youtube.com`, so the fake loads exactly as the real API would, with no
  test-only code path in the app.
- **The fake player** is ~90 lines and implements only what `src/shell/youtube.ts` types. Its
  clock advances only while "playing", at a rate the test sets. That's what made player routing
  testable at all. The ukulele play-through checks all 11 nodes in order and the wrap screen, at
  200× speed, in about 7 s.
- **Every test fails** on a console error, uncaught exception, CSP violation, unexpected
  `confirm`/`prompt`, or a queued dialog that never appeared. One test deliberately triggers a
  CSP violation to prove the catcher works (Chromium reports it twice: our
  `securitypolicyviolation` listener and its own console line). The favicon 404 is the single
  ignored error, pending the favicon backlog item.
- The real ukulele export is committed as `e2e/fixtures/ukulele.json`. Its content was already
  in the repo inline in `config.test.ts`, so nothing new is published.

60 tests: pages, player, home, Studio, Editor, mobile (Pixel 7 emulation), two devices. The
table in [`e2e/README.md`](../../e2e/README.md) says what each covers.

## Bugs it found

1. **Import All reported "updated" when you'd chosen "add as new".** The home page decided
   "updated" by whether a same-titled draft *existed*, not by what the person answered.
   `adoptExternalConfig` now returns `updated`, and the page counts from that. Unit-tested both
   ways as well.
2. **Import/Export All could run before the draft store opened.** Studio and the Editor disable
   their store-backed buttons until IndexedDB has opened; the home page's are `<a>` links and
   weren't gated. Now `boot()`'s promise is kept as `ready` and both handlers wait on it, so an
   early click runs late instead of failing. That change caused its own bug first: deferring the
   import meant `el.value = ""` emptied the live `FileList` before it was read. The files are now
   copied out first.
3. **Editor → New… from a video URL never got the video's title.** The guard
   `if (title && config === fresh)` compared against the object `loadConfig` had just replaced
   with a normalized copy, so it was always false. It now captures `config` after `loadConfig`.
   This dates from the slice-2 port. Nothing noticed because a fallback title looks plausible.

## Harness mistakes worth remembering

- `gotoHome` first waited on `#local-empty, .draft` → `.first()`, which picks the hidden
  placeholder when drafts exist. Now `#local-empty:visible, .draft`. The placeholder starts
  `display:none` and only shows after boot, which also makes it a boot marker.
- `dialogs.alert(/Import complete/)` originally matched *any* alert so far, so a second
  import's wait was satisfied by the first import's alert. Two-device tests returned before the
  merge ran and mostly passed anyway, because later assertions retried long enough. The
  delete-vs-edit test exposed it. `alert()` now consumes alerts in order.

## Verified

`pnpm e2e --repeat-each 3`: 180/180, ~20 s per pass locally with 10 workers. `pnpm test` 125,
lint/tsc/build, docs hygiene all clean.

## Not done

- **`e2e (playwright)` isn't a required status check on `main` yet.** Adding a check that has
  never run would block every PR, so it goes in after the first green CI run. The deploy
  already depends on it.
- CI runs with 2 workers on a slower machine. Nothing here is timing-tight (the tightest is the
  1 s edit-burst debounce against a 5 s expect timeout), but the first CI run is the real test
  of that.
- The manual residue is five items, listed in `e2e/README.md`. This corrects the "not verified"
  list in [journal 2026-09-19](2026-09-19-adr-0023-per-field-history.md): the two-device history
  check it said nobody had done by hand is now a test.
