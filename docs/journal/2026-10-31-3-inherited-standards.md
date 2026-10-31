# 2026-10-31 (3) — inheriting the template's standards ADRs, and conforming to them

Documents `2264d9b` and `47e7d92` (branch `inherit-standards-1000-1018`).

## Why now

The template gained its inherited-standards ADRs (1000–1017) on 2026-10-20, and 1018 today.
This repo had none, though it has had a `template` remote since its migration. Ryan asked to
bring it up to date after cycle-in went through the same thing in its first compliance review.

## Inheriting (`2264d9b`)

`docs/adr/1000`–`1018` copied from `template/main` (`dcb2924`) and checked byte-identical, plus
the template's current `project-conventions` and `stance-review` skills. cycle-in's skill held
real project content and had to be merged by hand; this repo's was the template's older text
with nothing project-specific (that lives in `CLAUDE.md`), so a straight copy was right. The
ADR index gained the "two number ranges" convention and 19 rows.

## Conforming (`47e7d92`)

Adopting a standard means meeting it or recording a deviation, so the repo was checked against
each one first:

- **Already met:** 1010 (TypeScript 6.0.3), 1011 (the five tsconfig flags), the lint rules,
  1016's explicit gates except one, and 1018 (Renovate had already moved OSV to v2.7.0, before
  the ADR existed: a repo can satisfy a new 1NNN before it holds the file).
- **Fixed:** no job had `timeout-minutes` (1005); CI ran Node 22 (1013, already accepted here as
  T4); there was no secret scan (the template's job, run locally first over all 99 commits: no
  leaks); three Rust jobs existed with no Rust (1004; ADR-0004 rejects a Rust core, which is the
  opt-out record); `strictDepBuilds` wasn't stated (1016). Lint, 145 unit and 72 e2e tests pass
  on Node 24; the lockfile didn't change.
- **Not decided here:** ADR-1012's two extras are Ryan's call (T3). ADR-1017 asks whether a
  screen with many managed values has one pure reducer with property tests; the event-log core
  does, but the Editor and Studio pages are large and haven't been looked at against it.

## Side effect

Renovate's #2 pins CI's Node to `22.23.4`. With CI on 24 it's superseded; Renovate should
re-plan or close it once this merges.

## Next

Merge this PR. Then Ryan answers ADR-1012's extras (T3); an ADR-1017 look at Editor and
Studio; and a first stance review, which docs-hygiene keeps warning about.
