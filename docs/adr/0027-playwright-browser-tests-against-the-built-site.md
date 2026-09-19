# ADR-0027: Browser behaviour is tested by a committed Playwright suite against the built site
- Status: Accepted
- Date: 2026-09-19
- Deciders: Ryan

## Context
[ADR-0004](0004-provable-lite-strict-typescript-and-property-tests.md) puts the rigour in the pure
core: strict TypeScript and fast-check properties on `src/core/`. That tier is strong, and it
stops at the page. Studio, the Editor, the home page and the player are DOM wiring over the
core, and until now nothing checked that wiring on every change.

What stood in for it was a throwaway script: a hand-written Chrome DevTools Protocol client in the
scratchpad, rewritten for slice 2, 3b.3, ADR-0026 and ADR-0023, then deleted each time. Each
version caught real things, but none of them persisted. ADR-0026 asked for a standing CSP check in
"the 16-check headless smoke test", and the 3b.3 journal found there was no committed suite to put
it in. The list of things "not verified — needs Ryan in a real browser" in `PROGRESS.md` has grown
with every slice, and most of it doesn't need a person. It needs a browser that someone scripted
once and kept.

Two things make this more than a convenience now:

- **The event log made the pages stateful across sessions and devices.** A draft-first autosave,
  a debounced persist, update-or-add on import, and a two-device merge are behaviours of the
  page plus IndexedDB, and unit tests of the store can't see the page half. Building ADR-0023
  found the Editor writing one event per keystroke. The unit tests had passed throughout,
  because the store was correct; the page just called it wrong.
- **Two devices can't be tested by hand on one machine** without juggling browser profiles and
  files. A test runner with isolated browser contexts does it in a few lines.

## Decision
Browser behaviour is tested by a **committed Playwright suite** (`@playwright/test`, Chromium only)
in `e2e/`. It runs against the **built site** served by `vite preview`: the artifact Pages
publishes, not the dev server. It runs in CI as its own `e2e` job, and a red `e2e` job
blocks the Pages deploy.

The suite is **hermetic**. Every request that leaves the preview server is intercepted.
`www.youtube.com/iframe_api` is answered with a small fake of the IFrame Player API whose clock
the test controls, the oEmbed title lookup gets a canned answer, and everything else is aborted.
So playback routing (segment ends, choices, countdowns, asides, end screens) is tested
deterministically, and a YouTube outage or ad can't turn CI red.

Every test fails on any console error or CSP violation raised by our own pages, which is
ADR-0026's standing check.

## Alternatives considered
- **Keep the throwaway CDP scripts** — no dependency, and the reason it lasted this long. It
  lost because it never persisted: every slice paid to rebuild it and nothing guarded against
  regressions between slices. Committing it would mean maintaining our own waiting, isolation,
  download handling and reporting, which is Playwright rebuilt badly.
- **Vitest browser mode** — keeps one runner, but it is built for component tests mounted into
  a page it owns. These pages are whole-page scripts with their own HTML, CSP and storage, so
  they need to be loaded as a user loads them. (It uses Playwright underneath anyway.)
- **Cypress** — heavier, runs inside the page it tests, and handles multiple isolated browser
  contexts in one test poorly. That is exactly the two-device case.
- **Real YouTube in the tests** — tests the real embed, but headless YouTube is flaky (ads,
  autoplay policy, rate limits, consent pages), and it would make a third-party network the
  gate on deploying. The fake is only as good as its model of the API. That gap is covered by
  the manual checklist in `e2e/README.md`, which keeps real playback feel as a human check.

## Consequences
- **A new dependency and a downloaded browser.** `@playwright/test` (Apache-2.0, pulling
  `playwright` and `playwright-core`) is admitted under the existing gates: exact pin
  ([ADR-0013](0013-pin-exact-versions-restrict-registry.md)), 14-day age gate
  ([ADR-0014](0014-age-gate-dependency-admission.md), 1.63.0 was 15 days old when admitted), no
  install scripts ([ADR-0012](0012-block-install-time-scripts.md)): Playwright downloads nothing
  on install, and the browser is fetched by an explicit `playwright install chromium` step. That
  browser comes from Playwright's CDN, is pinned by the Playwright version, and isn't in the
  SBOM, which catalogs the lockfile. Accepted: it only ever runs tests and never ships.
- **Deploys wait on the browser tests.** A flaky suite would block publishing. The hermetic
  fake is what makes that acceptable. If flakes appear, fix the test or the fake, and never retry
  the job until it goes green.
- **The fake YouTube player is a model, and can be wrong.** It encodes our understanding of
  `loadVideoById`/`seekTo`/state events. A test passing against the fake shows the player logic
  is right *given* that model, not that YouTube behaves that way. Real playback stays on the
  manual list.
- **The "not verified in a browser" list mostly becomes tests.** What stays manual is listed in
  `e2e/README.md`: real YouTube playback feel, a real phone, and reading `create.html` as a
  newcomer.
- **Chromium only.** The audience's browsers are unknown, and Firefox/WebKit would triple the
  CI time and the browser downloads. **Promotion condition:** if a bug turns up that only
  reproduces in Firefox or Safari, add that engine as a Playwright project with a new ADR.
