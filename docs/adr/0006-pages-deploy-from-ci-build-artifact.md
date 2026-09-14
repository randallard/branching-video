# ADR-0006: GitHub Pages deploys the CI build artifact, not the branch root
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
Pages currently serves `main` at the repo root ("legacy" build type), and `README.md` and
`create.html` tell forkers exactly that: fork, enable Pages from the branch, done. After
[ADR-0005](0005-vite-multi-page-build-replaces-no-build-html.md) the deployable site is `dist/`,
which is not committed.

## Decision
Deploy through the template's `ci.yml`: the `ts-gates` job uploads `dist/` as the Pages
artifact and the `deploy` job publishes it, gated on `vars.DEPLOY_PAGES == 'true'` and `main`.
Pages source switches from "Deploy from a branch" to "GitHub Actions". Forkers get the same
instructions: set `DEPLOY_PAGES=true` and the Pages source, and every push to `main` deploys.
`README.md` and `create.html` are rewritten to say so.

## Alternatives considered
- **Commit `dist/`** so branch-root Pages keeps working — rejected by Ryan: generated files in
  git go stale and bury real diffs.

## Consequences
- **The cutover is a manual, ordered step on the live site**: merge to `main`, set
  `DEPLOY_PAGES`, and switch the Pages source together. Merging first leaves the branch-root
  deploy serving un-built source (TypeScript module references that don't resolve) — the live
  player breaks for anyone following a YouTube-card link until the source is switched.
- Deploys only happen after lint, tests, build and the supply-chain checks pass.
