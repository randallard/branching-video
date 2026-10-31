# ADR-1000: Template standards ADRs are inherited, numbered 1000 and up
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
The template's standards (provability tier, CI gates, supply-chain posture) used to live only as
prose in `project-conventions`. When that prose changed, nothing told a project built from the
template that a standard had moved, or why. The standard's decisions had no immutable record,
and downstream projects had no changelog to walk.

Every project copies `docs/adr/` when it's scaffolded, and numbers its own ADRs from 0001.
Downstream repos already have used numbers up to about 0030, so template ADRs numbered from 0001
would collide.

## Decision
The template records each change to its standards as an ADR in its own `docs/adr/`, numbered
**1000 and up** (the "1NNN" range). New projects inherit them by copying. A project's own ADRs
stay in **0001–0999**.

Inside a downstream repo, an inherited 1NNN ADR belongs to the template. Don't edit it, and don't
flip its Status there. Only the template supersedes it, with a new 1NNN. **A project that deviates
records the deviation in its own 0NNN ADR, citing the 1NNN it departs from.** An ADR-recorded
deviation counts as compliant.

## Alternatives considered
- **A separate template-only record outside `docs/adr/`.** Rejected because new projects would
  start without the reasoning behind their standards, and propagation would need its own
  changelog.
- **Template ADRs numbered from 0001.** Rejected because of collisions with every existing
  downstream repo.

## Consequences
- The same number means the same decision in every repo, so "which template ADRs does this repo
  have?" is a directory listing. That gives propagation a changelog for free.
- The baseline is the conventions as they stood before this batch. Earlier rules (functional
  core / imperative shell, `forbid(unsafe_code)`, SHA-pinned actions, the two-scanner rule) are
  not retro-recorded. They live in `project-conventions` and change only through new 1NNN ADRs.
- Promotion condition: if the 1NNN range starts crowding project ADR indexes, give it its own
  index file.
