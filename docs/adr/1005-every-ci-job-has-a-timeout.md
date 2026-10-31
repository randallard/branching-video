# ADR-1005: Every CI job has a timeout: 30 minutes for proofs, 15 for the rest
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
No job set `timeout-minutes`, so every job inherited GitHub's 360-minute default. A downstream
repo found a Kani harness on String-heavy code that never terminated. Its first push would have
held a runner for six hours.

## Decision
`timeout-minutes` on every job: **30** for `rust-proofs`, **15** for all others. The exception is
`osv-scan`, because GitHub doesn't allow `timeout-minutes` on a job that calls a reusable
workflow. It gets a comment saying so.

## Consequences
- A runaway job fails within its bound and says which job it was.
- A project whose fast gates legitimately need longer raises its own bound, with a comment
  saying why.
