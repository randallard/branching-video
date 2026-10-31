# ADR-1012: Engineering-Strategy's TS extras are offered as an opt-in at every project start
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
`Engineering-Strategy.md` adds an `any` registry (every `any`/`as` justified inline and listed
in `docs/any-registry.md`) and jsx-a11y accessibility lint. These are valuable for UI-heavy and
court-facing apps, and overhead for small tools. Ryan wants the choice made deliberately, not
missed.

## Decision
They are **not** part of the baseline (ADR-1011). The `new-project` interview **always asks**
whether to adopt each one, and records the answer in a project ADR either way.

## Consequences
- Every project has a recorded answer, and existing projects get the question during compliance
  review.
