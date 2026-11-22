# ADR-1024: The template ships an explicit `deny.toml`, and unmaintained crates are checked across the whole graph
- Status: Accepted
- Date: 2026-11-22
- Deciders: Ryan

## Context
The `rust supply chain` CI job runs `cargo-deny check licenses bans sources advisories`, but the
template shipped no `deny.toml`. Each Rust project wrote its own (six so far, git-redundancy among
them), and anything a project left out fell back to cargo-deny's
defaults. [ADR-1008](1008-build-scripts-are-the-rust-attack-surface.md) already tells projects to
put known-bad crates in `[bans]`, but there was no file to put them in.

Defaults change. cargo-deny 0.22.0 (2026-11-19; the action moves to it at v2.1.3) changed
`advisories.unmaintained` from `all` to `workspace`, so an unmaintained crate is reported only
when it's a direct dependency. This was checked on 2026-11-22 against git-redundancy, whose
`deny.toml` ignores RUSTSEC-2024-0370 (`proc-macro-error`, unmaintained, pulled in through
`tabled_derive`). Without that ignore, cargo-deny 0.22 with the defaults says `advisories ok`.
With `unmaintained = "all"` it fails on RUSTSEC-2024-0370. So under the new default, the gate
that caught that crate would have passed without anyone changing a line.

[ADR-1023](1023-routine-renovate-updates-merge-themselves.md) makes this sharper. The action
update is a *patch* (v2.1.1 → v2.1.3), so it automerges, while the tool inside it moves two 0.x
minors. If the gate's behaviour rests on defaults, a routine automerge can loosen it.
[ADR-1016](1016-pnpm-supply-chain-settings-stay-explicit.md) made the same call for pnpm: the
supply-chain settings are written out, not inherited.

## Decision
- **The template ships `deny.toml` at the repo root**, which the `rust supply chain` job reads.
  Every setting the gate depends on is written there:
  - `[advisories]`: `version = 2`, `yanked = "deny"`, **`unmaintained = "all"`**. Each `ignore`
    carries a reason and a revisit point.
  - `[licenses]`: permissive licenses only (MIT, Apache-2.0, Apache-2.0 WITH LLVM-exception,
    BSD-2-Clause, BSD-3-Clause, ISC, Zlib, Unicode-3.0) at confidence 0.9. Adding a license is a
    reviewed change to this file.
  - `[bans]`: `wildcards = "deny"` (with `allow-wildcard-paths` for workspace path
    dependencies), `multiple-versions = "warn"`, and an empty `deny` list for ADR-1008's
    known-bad crates.
  - `[sources]`: crates.io only. Unknown registries and git sources are denied.
- **cargo-deny-action moves to v2.1.3** (cargo-deny 0.22.0) in the same change, so the pin and
  the config that makes it safe land together.

## Alternatives considered
- **Bump the pin and accept the new default.** That's the least work, and nothing breaks today,
  since no repo here runs the Rust job yet. But the gate would get weaker exactly where it caught
  something real, and nobody would see it happen.
- **Hold the pin at v2.1.1.** It keeps the old behaviour by not updating, which leaves the gate
  without the 0.21 and 0.22 fixes, and the rest of the template's pins stay current.
- **Keep Renovate from automerging tool-wrapping actions.** That covers this one case, but it
  doesn't fix the underlying problem, which is that the gate's behaviour comes from defaults. With
  the settings written down, an automerged bump can only change what the gate checks by adding
  checks.

## Consequences
- A project takes this by copying `deny.toml` and this ADR, or by merging its sections into an
  existing `deny.toml` (keeping the project's own ignores, bans and licenses), and by bumping the
  action pin. A project with an existing `deny.toml` should set `unmaintained = "all"` before it
  takes cargo-deny-action v2.1.3, or record why `workspace` is enough for it.
- With `all`, unmaintained transitive crates fail the job. Each one needs either an upgrade that
  drops it or an `ignore` entry with a reason. That's the work the default would have skipped.
- cargo-deny prints `license-not-encountered` warnings for allowed licenses the graph doesn't
  use. They're warnings, not failures.
- Promotion condition: if cargo-deny later adds a setting the gate depends on, or changes another
  default, write it into `deny.toml` in the same change that takes that release.
