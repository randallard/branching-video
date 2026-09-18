# ADR-0026: Constrain what a page may load with a Content-Security-Policy meta tag
- Status: Accepted
- Date: 2026-09-17
- Deciders: Ryan

## Context
ADRs [0012](0012-block-install-time-scripts.md)–[0018](0018-pin-actions-to-commit-shas.md) built a
thorough supply-chain regime around the build: install scripts blocked, exact versions, a 14-day
age gate, two vulnerability scanners, signature verification, a licence allowlist, an SBOM, and
SHA-pinned actions. A 2026-09-17 audit found all eight implemented and green.

It also found that **none of them covers anything that executes in a viewer's browser.**

`package.json` has no runtime `dependencies` — all 285 packages in the lockfile are
devDependencies, and none of them ship. What a viewer actually runs is first-party bundled code
plus one third-party script: `https://www.youtube.com/iframe_api`, injected into `document.head`
at runtime by `loadYouTubeApi` in `src/shell/youtube.ts` and bundled into `dist/assets/youtube-*.js`.
That script is not in `package.json`, not in the lockfile, not in the SBOM, not seen by `pnpm audit`
or OSV-Scanner, and not subject to the age gate. It is fetched fresh from Google on every page load
of the player, the Studio and the Editor.

Subresource Integrity is not available here: the YouTube loader is a moving target by design, and
pinning a hash of it would break playback the next time Google ships a change. So the control has to
constrain *what the page is allowed to load and run* rather than *which bytes it loads*.

This matters more than it would on a typical static site for two reasons. The player's published
URLs are pasted into YouTube cards (see `CLAUDE.md`), so the audience arrives from outside and the
page paths are effectively permanent. And after [ADR-0006](0006-pages-deploy-from-ci-build-artifact.md)
a push to `main` publishes, so the blast radius of anything that lands in `dist/` is immediate.

## Decision
Ship a `Content-Security-Policy` `<meta http-equiv>` tag on every page, allowing exactly the
origins the app is known to use and nothing else:

- `default-src 'self'`
- `script-src 'self' https://www.youtube.com` — the IFrame API and nothing else
- `frame-src https://www.youtube.com` — the embed the IFrame API creates
- `img-src 'self'`
- `style-src 'self' 'unsafe-inline'` — the pages carry inline `<style>` blocks today
- `connect-src 'self' https://www.youtube.com` — the oEmbed title lookup in `src/shell/shows.ts`
- `object-src 'none'`, `base-uri 'self'`, `form-action 'none'`

This list was derived by reading the code, not assumed: the only external origin any page
contacts is `www.youtube.com`, for the IFrame API script, the embed it frames, and the oEmbed
title lookup. There are no external stylesheets, fonts, images or `data:` URIs anywhere in the
pages. `www.youtube-nocookie.com` appears in `src/core/text.ts` only as a host the URL parser
*accepts* when extracting a video id — nothing is ever embedded from it — so it is deliberately
not in `frame-src`.

A meta tag rather than a response header because GitHub Pages serves no configurable headers, and
a control that only works on a hypothetical future host is not a control.

## Alternatives considered
- **Subresource Integrity on the YouTube script.** Rejected above: the loader changes without
  notice and an SRI hash would turn every Google-side change into an outage.
- **Vendor the IFrame API into the repo** so it comes under the lockfile and the age gate.
  Rejected: it is not distributed for that, YouTube's terms expect the hosted loader, and a stale
  copy would break playback for everyone rather than for one person.
- **Response headers via a different host.** Rejected for now: it would reopen
  [ADR-0006](0006-pages-deploy-from-ci-build-artifact.md) and the hosting-cost comparison in the
  README, to gain header-based delivery of the same policy. The promotion condition below covers
  it if the host ever changes.
- **Do nothing and note it in the README.** Rejected: the whole point of 0012–0018 is that the
  build's dependencies are governed. Leaving the one dependency that reaches a viewer ungoverned
  is the gap, not the baseline.

## Consequences
- A script injected by anything other than the app itself — a compromised dependency that survived
  every other gate, a malicious PR, a bad paste into an HTML file — cannot reach an origin that
  isn't on this list. It does not stop a compromise of `www.youtube.com` itself, which no control
  available here would.
- **`style-src` keeps `'unsafe-inline'`**, because the pages have inline `<style>` blocks and the
  Editor and Studio set inline styles from JavaScript. This is an honest weakening: it blocks
  script injection but not style-based exfiltration tricks. Removing it means moving those styles
  into files and is worth its own decision later, not a silent expansion of this one.
- Every new external resource now needs a deliberate edit to the policy. That is the intended
  cost, and a forgotten one shows up as a blocked request in the console rather than silently
  working — so the policy must be re-checked when playback or the oEmbed lookup changes.
- The 16-check headless smoke test should gain a check that the console reports no CSP violation
  on the player, or the policy will drift from the app without anyone noticing.
- **Promotion condition:** if this project ever moves off GitHub Pages to a host with configurable
  headers, revisit via a new ADR — the same policy delivered as a response header also covers
  documents a meta tag cannot, and `frame-ancestors` (which a meta tag cannot express at all)
  becomes available.
