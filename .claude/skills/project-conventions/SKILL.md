---
name: project-conventions
description: House conventions for this project — ADR and journal discipline, functional core / imperative shell, provability tier, supply-chain rules. Load before writing an ADR, a journal entry, or any code in the core.
---

# House conventions

This project was scaffolded from `cr-ci-cd-rust-typescript-template`. **This file is the canonical
statement of the provable-code standard** ([ADR-1001](../../../docs/adr/1001-project-conventions-is-the-canonical-standard.md)).
Every rule that changed since the template's 2026-10 baseline points at the inherited `1NNN` ADR
that made the change. These rules are opinionated on purpose. They're here so a cold start — new machine, cleared context — lands
on the same path as the last session.

## The shape: functional core / imperative shell

**Non-negotiable, and it's what makes everything else possible.**

- **Core** — pure. No IO, no network, no filesystem, no clock reads, no randomness. The logic
  actually worth getting right lives here. This is the target of property tests and (in Rust)
  proofs.
- **Shell** — imperative. Git, HTTP, DOM, database, config loading. Covered by integration
  tests, not proofs.

If you can't property-test something, ask whether it's core logic tangled with shell concerns.
Usually it is, and untangling it is the fix.

## State: managed facts, managed position, derived values

Every piece of state is one of three kinds, and each has exactly one owner
([ADR-1017](../../../docs/adr/1017-state-is-managed-facts-managed-position-derived-values.md)):

1. **Managed facts**: what the user made or the program recorded. Stored once, in the form it
   was made: an append-only event log where history or merging matters, a plain document
   otherwise. Never copied.
2. **Managed position**: where the user is. The route, the screen, the step, the moment along a
   timeline, the selection. Always stored explicitly (in the URL when a link should reopen it,
   otherwise in the screen's reducer), **never derived from facts**, and never kept in two places.
3. **Derived values**: everything else, computed by pure functions of the two above. Never
   stored, so never stale.

A screen with more than a handful of managed values keeps them in **one pure reducer**
(`(state, action) → state`, with named actions, in its own module beside the screen). The
reducer is core, so it gets **property tests over arbitrary action sequences** (`fast-check` /
`proptest`) that assert the screen's invariants, for example "the round never exceeds the round
count" or "position has exactly one owner", not just example-based unit tests. A clock or canvas
the screen doesn't own is read into the reducer at defined moments (pause, seek), never mirrored
continuously. No state library until a genuinely graph-shaped flow earns one, recorded in an ADR.

Why: deriving *facts about the data* is safe. Deriving *where the user is* from the data, or
keeping a second copy of a fact, is where the bugs come from. If a reducer starts needing another
screen's state, the layers are wrong for that pair: decide a shared store in an ADR.

## What "provable" means here

A ladder, not a label ([ADR-1002](../../../docs/adr/1002-provable-is-a-four-rung-ladder.md)). Each rung is checked by a machine, not remembered by a reviewer:

1. **Memory safety by construction**: the compiler, and `#![forbid(unsafe_code)]`.
2. **Illegal states unrepresentable**: newtypes, enums and discriminated unions, no null, exhaustive matches.
3. **Properties hold across generated inputs**: `proptest` / `fast-check` on the pure core.
4. **Properties proven**: Kani (bounded) on the core; Verus (unbounded) for named invariants.

Tiers: **provable-lite** = rungs 1–3 (TS); **provable** = 1–4 with Kani (Rust); **provable+** =
adds Verus for named invariants ([ADR-1003](../../../docs/adr/1003-provable-plus-tier-verus-for-named-invariants.md)).

A project claims the highest rung its CI actually enforces, and no higher. Properties and proofs
cover the core; the shell gets integration tests. "Provable" is a claim about code, never a
compliance status (FISMA categorises systems, not code). The longer reasoning lives in the
documents this standard was reconciled from; this is the part a reviewer grades against.

## Provability tier

Pick the strongest tier the language supports; don't pretend to a tier you're not at.

**Rust**: `#![forbid(unsafe_code)]` at every crate root. Note `forbid`, not `deny`: it cannot
be overridden by an inner `#[allow]`, so the only way to introduce unsafe is to edit the crate
root, where it shows in the diff and can't be buried. If unsafe is genuinely necessary, it
requires **a dedicated ADR** explaining why, and the crate-root change is the visible marker.

- `proptest` on the core, always.
- `kani` for bounded proofs on the core, as its own CI job so a slow proof never delays
  fast-gate feedback. **A harness is required.** Plain `cargo kani` with no `#[kani::proof]`
  finds nothing, says so, and *exits 0*, so the CI job fails when there are no harnesses
  ([ADR-1004](../../../docs/adr/1004-kani-job-fails-without-harnesses.md)). A harness needs no
  spec annotations: `kani::any()` inputs plus the call already checks panics, overflow and
  UB within the bound. Kani struggles with heap-heavy code (String-building paths can fail to
  terminate), so harness the byte- and number-level logic and leave allocating entry points to
  `proptest`. Not using Kani? Record that in a project ADR and delete the job.
- **provable+**: Verus, a deductive verifier, proves `requires`/`ensures`/invariants for
  *all* inputs, with no bound. Adopt it only by a project ADR that **names the invariant**
  (eligibility, sealing, a permission boundary: something whose violation is a legal or safety
  harm). LLMs may write the proofs, but **a human reviews the spec line by line**, because a proof
  only shows the code meets the spec as written. Verus runs through its own driver, so it gets its
  own CI job ([ADR-1003](../../../docs/adr/1003-provable-plus-tier-verus-for-named-invariants.md)).
  Other deductive tools (Creusot, Prusti) need the same justification.
- **Miri**, if you add it, runs in a job with no secrets and no shared `target/` cache
  ([ADR-1009](../../../docs/adr/1009-miri-runs-without-secrets-or-shared-target-cache.md)).

**TypeScript**: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`noImplicitReturns`, `noFallthroughCasesInSwitch`. ESLint `strictTypeChecked`, with
`no-non-null-assertion`, `switch-exhaustiveness-check` and `no-floating-promises` as errors,
and zero warnings ([ADR-1011](../../../docs/adr/1011-typescript-strictness-bar.md)). Relaxing any of it takes a project ADR.

- **Pin `typescript` to 6.0.x** until the type-aware lint gate runs on TS 7: typescript-eslint
  supports 7.x, or an oxlint + tsgolint trial passes
  ([ADR-1010](../../../docs/adr/1010-typescript-stays-on-6-until-the-lint-gate-supports-7.md)).
- **Opt-in extras, decided at project start**: an `any` registry (every `any`/`as` justified
  inline and listed in `docs/any-registry.md`) and accessibility lint (jsx-a11y, or axe checks
  for non-JSX UIs). Not baseline, but every project records an ADR saying yes or no
  ([ADR-1012](../../../docs/adr/1012-strictness-extras-offered-at-project-start.md)).

- `fast-check` property tests on the pure core — the `proptest` analogue. Write real
  invariants, not smoke tests: "totals across categories always sum to the ungrouped total"
  beats "the function returns a number."
- No formal proof. TypeScript's type system is *unsound* by design, and that's an accepted
  trade for ecosystem and speed — but it means the compiler is a first check, not a guarantee.
  If a genuinely safety-critical invariant emerges, that's an ADR, not a retrofit, and the
  logic moves into a **Rust crate compiled to WASM** called from the TS shell, held to the Rust
  tier ([ADR-1015](../../../docs/adr/1015-logic-beyond-provable-lite-moves-to-a-rust-core.md)).
  Don't bolt rigor tooling onto TS instead.

## ADRs

Full conventions: `docs/adr/README.md`. The two that get violated most:

1. **One decision per file.** If you're writing a numbered list of decisions, split it. The
   test: *if you can't supersede one part of it, it's too big.*
2. **Immutable in substance.** To change a decision, write a new ADR and flip the old one's
   Status. The Status line and the index are mutable metadata; everything from `## Context`
   down is frozen. **Never add an "amended" block to an accepted ADR** — that's a new decision
   wearing a hat, and it destroys the supersession trail.

**Inherited standards ADRs (`1000`+) belong to the template** ([ADR-1000](../../../docs/adr/1000-template-standards-adrs-are-inherited.md)).
Don't edit them or flip their Status here. Copy in new ones when the template adds them. To
deviate, write your own `0NNN` ADR citing the `1NNN` you depart from. Project ADRs use
`0001`–`0999`.

Give every ADR a **promotion condition** where one exists ("no proofs today; revisit if X").
The monthly stance review reads those.

## Journal

`docs/journal/YYYY-MM-DD-kebab-title.md`, append-only. Correct mistakes in a later entry, never
by rewriting an old one. A journal entry references the commit it documents and lands in a
follow-up commit — a commit can't contain its own hash.

Write one when there's reasoning a future reader would have to reconstruct — especially
anything discovered by *running* the thing that tests didn't catch.

## Verification

Tests passing is not evidence the feature works. Before calling something done, run it and
watch it do the thing. Bugs that are green in every test and obvious in four seconds of
clicking are common enough that this is a standing rule, not a suggestion.

**Run what CI runs, not a hand-rolled approximation of it.** `pnpm build` is `tsc -b && vite
build`; typechecking by hand with `tsc --noEmit` is a different command that can pass while
the gate fails.

**And before accepting that a gate can't be run locally, try to run it.** A reusable workflow
can't be invoked from a checkout — but the *tool* it wraps usually can, and the tool is what
decides the job. `osv-scan` is `google/osv-scanner-action`, and its scanner is a public
container:

```
docker run --rm -v "$PWD:/src" -w /src ghcr.io/google/osv-scanner:v2.7.0 -r ./
```

Read the "found N packages" line, not just "No issues found": a scanner that parses less of a
lockfile than it should still says clean. Under pnpm 12 the lockfile is two YAML documents, and
v2.3.8 read only the first ([ADR-1018](../../../docs/adr/1018-osv-scanner-reads-the-whole-lockfile.md)).

Run it against a clean `git archive` export so a local `node_modules` can't change the answer.
An unrunnable gate is an untrustworthy one: a repo in this family had `osv-scan` failing on
*every run in its history* while every local check reported clean, because one sentence of
inherited belief said the job was unobservable.

## Reviewing changes to `.claude/` and `CLAUDE.md`

**These files are instructions, not documentation.** A change to `.claude/skills/*/SKILL.md` or
`CLAUDE.md` changes what a future Claude session *does* — which tools it reaches for, what it
treats as approved, what it skips. That's closer to changing CI configuration than to editing a
README.

The blind spot is that they *read* like documentation. A pull request touching a markdown file
full of prose invites lighter scrutiny than one touching a build script, and an instruction like
"the supply-chain checks are handled elsewhere, skip them" would sail through a skim. The same
property applies to any file the model reads as guidance — `CLAUDE.md`, docs, even code comments
— but `.claude/` is where it's most concentrated and most consequential.

So: **review changes to `.claude/`, `CLAUDE.md`, and `.github/workflows/` with the same
attention as executable code.** `.github/CODEOWNERS` marks those paths so a review is
automatically requested.

Two honest caveats:

- **CODEOWNERS alone has no teeth.** By itself it only *requests* a reviewer. It becomes a gate
  only with branch protection on `main` — "Require a pull request before merging" plus
  "Require review from Code Owners". Without that, it's a convention with a reminder attached.
- **None of this is live on a solo repo** with no external contributors, where you approve your
  own work anyway. It's cheap to set up before you need it, and awkward to remember on the day
  a first outside PR arrives.

## Secrets and configuration

- **Secrets come from the environment**, one variable per secret, or from the platform's secret
  store (a Kubernetes `Secret`, never a `ConfigMap`). Never from committed code, config,
  scripts, docs, ADRs, journals or test fixtures.
- **Config files describe structure.** They may name the variable that holds a secret
  (`password_env = "DB_PASSWORD"`) but never contain the secret. A connection string with
  credentials embedded counts as a secret.
- **Fail closed.** A missing required secret stops startup with an error naming the *variable*,
  not the value. No default, no generated stand-in.
- **`.env.example` is committed, `.env` is not.** `.gitignore` ships with the rule; confirm it
  before creating a `.env`. Test code uses obviously fake values.
- **Never log or echo a secret**, or pass one on a command line where it lands in shell history.
- **CI scans history for secrets** (`secret scan` in `ci.yml`, a pinned gitleaks release with its
  checksum verified). A finding fails the build. Bump the version and checksum together,
  deliberately. A secret that was ever committed is exposed: rotate it, because deleting the line
  doesn't remove it from history.
- In a session, never ask for or accept a secret. Write the command so it reads the secret from
  the environment, and have the human run it.

## Supply chain

- Lockfile committed; CI installs frozen. Cargo runs `--locked` in CI ([ADR-1006](../../../docs/adr/1006-cargo-runs-locked-in-ci.md)).
- Install scripts blocked by default; exceptions individually reviewed, never blanket-allowed.
- Age-gate new releases at the **package manager** level, not just the update bot. A bot
  setting paces the bot's PRs and does nothing for a manual add. One day on both sides: pnpm
  `minimumReleaseAge: 1440`, and Cargo `[registry] global-min-publish-age = "1 day"` in
  `.cargo/config.toml`, which is native from Rust 1.100 and inert with a warning before that
  ([ADR-1007](../../../docs/adr/1007-one-day-crate-cooldown-via-cargo-min-publish-age.md)).
- pnpm's supply-chain settings (`minimumReleaseAge`, `trustPolicy: no-downgrade`,
  `blockExoticSubdeps`, the build allowlist) are **set explicitly** even where they match the
  defaults, and a new pnpm *major* is evaluated in a stance review before `packageManager` moves
  ([ADR-1016](../../../docs/adr/1016-pnpm-supply-chain-settings-stay-explicit.md)).
- **Rust's install-script equivalent is `build.rs` and proc-macros.** They run arbitrary code at
  build time with your permissions. That's where the 2026 `arrayref` payload ran. When adding or
  updating a dependency, do the first build in an ephemeral container or CI, not on a
  workstation with credentials. Read the `build.rs` and proc-macros of every new *direct*
  dependency, and put known-bad names in `cargo-deny`'s `[bans]`
  ([ADR-1008](../../../docs/adr/1008-build-scripts-are-the-rust-attack-surface.md)).
- Third-party CI actions pinned to full-length commit SHAs, not tags. Tags are mutable.
- Every CI job has `timeout-minutes`: 30 for proofs, 15 otherwise. The one exception is a job
  that calls a reusable workflow, where GitHub disallows it
  ([ADR-1005](../../../docs/adr/1005-every-ci-job-has-a-timeout.md)).
- Publishing to npm? Bind trusted publishing by repository ID, re-bind after any rename or
  transfer, and never publish from `issue_comment` or `pull_request_target` workflows
  ([ADR-1014](../../../docs/adr/1014-npm-trusted-publishing-hygiene.md)).
- Throwaway tooling installed *beside* the repo needs its own protection; the project's config
  does not reach it.
- **An advisory exception has to be written once per scanner, and that is not duplication.**
  `ci.yml` runs two: the package manager's own audit (`pnpm audit`, reading
  `auditConfig.ignoreGhsas` in `pnpm-workspace.yaml`) and **osv-scanner**, which reads
  `osv-scanner.toml` and a different database, with `fail-on-vuln: true`. Neither reads the
  other's config. Consolidating them looks like tidying and silently disarms one gate — put
  the same ignore and the same reason in both, and make each file name the other so they are
  dropped together. This has been gotten wrong twice, and both times the reasoning was right
  and only the location was wrong.
- An ignore records **why no patched version is usable**, never a quarantine wait or a
  severity opinion, and names the condition that retires it.

## Docs that must stay current

`README.md`, `docs/PROGRESS.md`, `docs/journal/`, `docs/adr/`. When you finish a chunk of work,
update whichever exist so the effort can be resumed from the docs alone after a cleared
context. `python3 scripts/docs-hygiene.py` checks the mechanical parts locally.
