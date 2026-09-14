# ADR-0003: Retrofit the cr-ci-cd-rust-typescript-template conventions onto this repo
- Status: Accepted
- Date: 2026-09-14
- Deciders: Ryan

## Context
branching-video predates [cr-ci-cd-rust-typescript-template](https://github.com/randallard/cr-ci-cd-rust-typescript-template)
(first commit 2026-05-28). New projects are to start from that template, and this one had
drifted from it everywhere except the docs shape: five HTML files with ~3,400 lines of inline,
untyped JavaScript; no tests; no CI; no supply-chain posture; no licence; no `CLAUDE.md` or
conventions skill; one journal filename that fails `docs-hygiene`.

The prompt was a concrete feature — loading previously exported single-show configs from the
home page — whose core is a merge rule. That is exactly the kind of logic the template wants in
a pure, property-tested core, and exactly the kind the current code keeps inline in the DOM.
Studio's existing import already bypasses the merge rules ADR-0002 set, which is the drift in
miniature.

Ryan was offered three levels (cheap conventions only; conventions plus a first TS slice; full
migration) and chose the full migration.

## Decision
Bring branching-video fully onto the template's conventions — conventions skill, `CLAUDE.md`,
CI workflows, CODEOWNERS, `docs-hygiene`, stance review, licence, supply-chain posture, and a
TypeScript functional-core/imperative-shell codebase — **in place**, keeping this repo's git
history, remotes, published URL and existing ADRs/journal. The template is wired as a
`template` remote so drift stays checkable.

The work lands on a branch in reviewable slices, none merged to `main` (and so none deployed)
until Ryan has verified it locally:

1. Conventions, CI, licence, supply-chain config, and the ADRs that decide the rest.
2. Vite + strict TypeScript build; pages ported behaviour-for-behaviour.
3. Pure core (config model, event log, reducer, import) with `fast-check` properties.
4. The feature that started this: single-show config import through the merge path.

## Alternatives considered
- **Regenerate from the template and copy the code across** — rejected: loses history and the
  `data`/`data-lan` fleet remotes, and the template's `new-project` bootstrap is written for an
  empty project, not a working one with users' drafts in their browsers.
- **Conventions only, code stays JavaScript** — rejected by Ryan in favour of the full move.
- **Conventions plus TS only for new code** — rejected by Ryan; leaves two codebases to reason
  about indefinitely.

## Consequences
- The `new-project` skill is not copied: its interview was replaced by this session's
  deliberation, recorded as ADRs 0003–0019.
- Existing ADRs 0000–0002 and the 2026-07-08 journal entries are kept as history. Their form
  predates the template's; they are not rewritten to match.
- The "no build step, fork and enable Pages" promise in `README.md`/`create.html` ends
  ([ADR-0006](0006-pages-deploy-from-ci-build-artifact.md)).
- Until slice 4 lands, the feature that prompted this waits behind the migration.
