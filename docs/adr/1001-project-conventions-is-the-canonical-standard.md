# ADR-1001: project-conventions is the canonical provable-code standard
- Status: Accepted
- Date: 2026-10-20
- Deciders: Ryan

## Context
The provable-code standard had been written down in four places that drifted apart: this
template's `project-conventions`, `git-redundancy`'s ADR-0001 (the tier ladder), `home-fleet`'s
ADR-0001 (the assurance table), and the Judicial Institute's `Engineering-Strategy.md`. They
agreed on the core and disagreed on Verus, on Kani everywhere, on TS strictness and on cargo
tooling. A 2026-10-20 review reconciled them.

## Decision
`.claude/skills/project-conventions/SKILL.md` is **the** statement of the standard. The other
documents are instances of it. They cite it and record their own deviations, in new ADRs or
notes, never by editing their accepted ADRs. Changes to the standard happen here, as 1NNN ADRs
(ADR-1000).

## Consequences
- One text to keep current. Compliance reviews grade against it.
- Instance repos need a one-time note pointing here.
