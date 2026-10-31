# ADR-1002: "Provable" means a four-rung ladder, and a project claims only the rungs CI enforces
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
"Provable" was used everywhere and defined nowhere in this template. The definition lived in
`git-redundancy`'s ADR-0001 (the ladder), `Engineering-Strategy.md` (the thesis) and
`home-fleet`'s ADR-0001 (the caveat that it isn't a compliance status). Without a definition,
the word is a slogan, and a compliance review has nothing to grade against.

## Decision
`project-conventions` defines it. Provable is a ladder of four rungs, each checked by a machine:
(1) memory safety by construction; (2) illegal states unrepresentable; (3) properties hold across
generated inputs (`proptest` / `fast-check`); (4) properties proven (Kani bounded, Verus
unbounded). The tiers are **provable-lite** (rungs 1–3, TS), **provable** (1–4 with Kani, Rust)
and **provable+** (adds Verus, ADR-1003). A project claims the highest rung its CI actually
enforces, and no higher. "Provable" is a claim about code, never a compliance status.

## Alternatives considered
- **Link out to the older docs instead.** Rejected because the definition should live with the
  standard it defines.
- **Carry the essays and the FISMA control mapping too.** Rejected because they would bloat the
  conventions. They stay in their source documents.

## Consequences
- The definition is about 12 lines in the conventions.
