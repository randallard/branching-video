# ADR-1003: Opt-in provable+ tier: Verus for named invariants, with a human-reviewed spec
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
`Engineering-Strategy.md` names Verus, a deductive verifier for Rust, for critical paths. This
template said not to reach for deductive verifiers without a specific invariant. Verus proves
`requires` / `ensures` / invariants for **all** inputs, which avoids Kani's bound and its trouble
with heap-heavy code. Its cost was writing annotations by hand. In 2026, LLM systems write most
Verus proofs (AutoVerus; VeruSAGE above 80% on system-scale tasks; https://arxiv.org/html/2605.03822v2).
But a proof only shows that the code meets the spec as written (VerusEval,
https://arxiv.org/html/2610.26464).

## Decision
Add an opt-in **provable+** tier. A project adopts it with a project ADR that **names the
invariant**. The proofs may be LLM-written, but **a human reviews the spec line by line**. Verus
is used only for named invariants, never across the board.

## Alternatives considered
- **Keep "Kani only".** Rejected because it leaves critical invariants (eligibility, sealing,
  permission boundaries) with no path to an unbounded proof.
- **Verus across the whole core.** Rejected because it costs too much and the spec-review burden
  is unbounded.

## Consequences
- Verus runs through its own driver and toolchain, not plain `cargo`, so a provable+ project adds
  a CI job.
- Promotion condition: an invariant whose violation is a legal or safety harm.
