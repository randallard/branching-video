# ADR-0020: Vite multi-page build with a relative asset base
- Status: Proposed
- Date: 2026-09-14
- Deciders: Ryan (pending — implemented in slice 2 for review)

## Context
Supersedes [ADR-0005](0005-vite-multi-page-build-replaces-no-build-html.md), written the same
day before any build existed. Its multi-page shape held up in slice 2; its
`base: "/branching-video/"` did not:

- Vite applies `base` in dev too, so every local URL Ryan uses
  (`http://<machine>:8080/player.html#…`, bookmarked and opened from other devices) would move
  under `/branching-video/`.
- A fork published under a different repository name 404s on every asset until the fork edits
  `vite.config.ts` — the exact failure the template warns about, reintroduced for every forker.

Every page sits at the site root and references its assets relatively, so neither problem needs
an absolute base at all. Slice 2 also found that Vite's default single-page-app fallback serves
`index.html` (HTTP 200) for a missing file, so `player.html?config=live/missing.json` failed with a
JSON parse error locally while GitHub Pages returns a 404 — dev and production disagreed.

## Decision
Build with **Vite** in multi-page mode: each HTML page stays at its published path and loads a
TypeScript entry from `src/pages/`. Files fetched at runtime rather than imported
(`live/*.json`, `config.json`, `config.example.json`) live in `public/`. `vite.config.ts` sets:

- `base: "./"` — relative asset URLs, correct at the dev root and under any Pages repo name;
- `appType: "mpa"` — an unknown path is a 404 in dev and preview, as on Pages;
- `server`/`preview` on `0.0.0.0:8080`, the port and binding the old `serve` script used.

## Alternatives considered
- **`base: "/branching-video/"`** (ADR-0005) — rejected for the dev-URL and fork reasons above.
- **Base from an environment variable per deploy** — rejected: configuration a forker has to know
  about, for no gain over a relative base while every page is at the root.

## Consequences
- Page URLs are unchanged from the pre-build site, locally and on Pages.
- **Promotion condition:** if a page ever moves into a subdirectory, a relative base breaks its
  asset URLs; revisit with an absolute base then.
