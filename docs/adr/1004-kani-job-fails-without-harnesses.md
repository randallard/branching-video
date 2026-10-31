# ADR-1004: The Kani CI job fails when there are no proof harnesses
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
The `rust-proofs` job ran `cargo kani --workspace`. With no `#[kani::proof]` harnesses, Kani
prints "No proof harnesses … found to verify" and **exits 0** (Kani 0.67.0, reproduced
2026-10-20). So the job passed while proving nothing. One downstream repo was in that state.
The conventions also claimed "zero annotations already gives you panic-freedom", which is only
true of the experimental `cargo kani autoharness -Z autoharness`.

## Decision
A step before Kani fails the job when no tracked `.rs` file contains `kani::proof`. A project
that doesn't use Kani records that in a project ADR and deletes the `rust-proofs` job. That ADR
may name Verus (ADR-1003) for specific invariants instead. The wrong "zero annotations" claim is
corrected.

## Alternatives considered
- **Replace the job with autoharness.** Rejected because it's experimental and its interface can
  change.
- **A repository variable to opt out.** Rejected because it's invisible in the diff. Deleting the
  job, with an ADR, is explicit.

## Consequences
- A fresh Rust project's proofs job is red until the first harness is written. That's
  deliberate: the template now means what it says.
- Promotion condition: if autoharness stabilises, revisit using it as a free baseline.
