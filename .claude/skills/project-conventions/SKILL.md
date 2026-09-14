---
name: project-conventions
description: House conventions for this project — ADR and journal discipline, functional core / imperative shell, provability tier, supply-chain rules. Load before writing an ADR, a journal entry, or any code in the core.
---

# House conventions

This project was scaffolded from `cr-ci-cd-rust-typescript-template`. These rules are
opinionated on purpose. They're here so a cold start — new machine, cleared context — lands
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

## Provability tier

Pick the strongest tier the language supports; don't pretend to a tier you're not at.

**Rust** — `#![forbid(unsafe_code)]` at every crate root. Note `forbid`, not `deny`: it cannot
be overridden by an inner `#[allow]`, so the only way to introduce unsafe is to edit the crate
root, where it shows in the diff and can't be buried. If unsafe is genuinely necessary, it
requires **a dedicated ADR** explaining why, and the crate-root change is the visible marker.

- `proptest` on the core, always.
- `kani` for bounded proofs on the core. Kani earns its place because it's incremental —
  **zero annotations already gives you panic-freedom checks**. Run it as its own CI job so a
  slow proof never delays fast-gate feedback.
- Deductive verifiers (Verus, Creusot, Prusti) express richer invariants at much higher
  annotation cost. Don't reach for them without a specific invariant that justifies it.

**TypeScript** — `strict` plus `noUncheckedIndexedAccess`, ESLint `strictTypeChecked`, zero
warnings.

- `fast-check` property tests on the pure core — the `proptest` analogue. Write real
  invariants, not smoke tests: "totals across categories always sum to the ungrouped total"
  beats "the function returns a number."
- No formal proof. TypeScript's type system is *unsound* by design, and that's an accepted
  trade for ecosystem and speed — but it means the compiler is a first check, not a guarantee.
  If a genuinely safety-critical invariant emerges, that's an ADR, not a retrofit.

## ADRs

Full conventions: `docs/adr/README.md`. The two that get violated most:

1. **One decision per file.** If you're writing a numbered list of decisions, split it. The
   test: *if you can't supersede one part of it, it's too big.*
2. **Immutable in substance.** To change a decision, write a new ADR and flip the old one's
   Status. The Status line and the index are mutable metadata; everything from `## Context`
   down is frozen. **Never add an "amended" block to an accepted ADR** — that's a new decision
   wearing a hat, and it destroys the supersession trail.

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
docker run --rm -v "$PWD:/src" -w /src ghcr.io/google/osv-scanner:v2.3.8 -r ./
```

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

## Supply chain

- Lockfile committed; CI installs frozen.
- Install scripts blocked by default; exceptions individually reviewed, never blanket-allowed.
- Age-gate new releases at the **package manager** level, not just the update bot — a bot
  setting paces the bot's PRs and does nothing for a manual add.
- Third-party CI actions pinned to full-length commit SHAs, not tags. Tags are mutable.
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
