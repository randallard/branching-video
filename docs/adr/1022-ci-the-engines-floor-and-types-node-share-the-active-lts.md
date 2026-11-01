# ADR-1022: CI, the engines floor and `@types/node` all follow the Active LTS (Node 26)
- Status: Accepted
- Date: 2026-11-01
- Deciders: Ryan
- Supersedes: [ADR-1020](1020-ci-runs-the-active-lts-and-the-engines-floor-trails-it.md)

## Context
[ADR-1020](1020-ci-runs-the-active-lts-and-the-engines-floor-trails-it.md) moved CI to Node 26 and
kept the `engines` floor and `@types/node` one LTS behind, at 24, so local installs on Node 24 would
keep working. Ryan reversed that the same day: *"can we just move up to node 26?"*

Two things stopped holding:

- **The reason for the gap was temporary.** The projects have one developer and two machines, so
  moving the machines is an afternoon's job, not a coordination problem.
- **The gap has a standing cost.** CI no longer runs on the floor, so a Node 24 break passes CI
  unseen, as ADR-1020's Consequences say. The rule also needs its own Renovate hold
  ([ADR-1021](1021-projects-start-with-a-renovate-config.md)).

ADR-1020 also has a fact wrong: it names "Node 28, around 2027-10" as the next move. Starting with
Node 27, every release line is promoted to LTS (`nodejs/Release`, read 2026-11-01):

| Line | Active LTS from | Maintenance from | End of life |
|---|---|---|---|
| 26 (Lithium) | 2026-10-28 | 2027-10-20 | 2029-04-30 |
| 27 | 2027-10-20 | not read | 2030-04-30 |

## Decision
- **One line for all three:** `node-version: 26` in every `setup-node` step, `engines.node` at
  `>=26.0.0`, and `@types/node` on 26.x. `renovate.json` holds `@types/node` at that line.
- **The cadence:** when the Active LTS line enters maintenance, all three move to the next one
  together, by a new 1NNN ADR. The next move is to **Node 27, around 2027-10-20**.
- **Developer machines move first.** A project doesn't take the new floor until every machine that
  builds it is on that line, because pnpm refuses to install below the floor
  (`ERR_PNPM_UNSUPPORTED_ENGINE`).
- A repo's `node-version` stays a line, not a patch, as ADR-1021 explains.

## Alternatives considered
- **Keep ADR-1020's gap.** It protects a machine on the older line, and there's no longer one that
  has to stay there. It keeps the untested floor and the extra rule.
- **Test on both lines (a matrix).** It would test the floor, but it doubles every TS job's minutes
  to support a line nothing needs.
- **Jump to Node 27 now.** It's an alpha until 2027-04-22, and alpha lines take breaking changes.

## Consequences
- CI now tests the floor, and `@types/node` describes what runs.
- This is ADR-1013's coupling back, and it has the cost ADR-1020 named: a machine still on the older
  line can't install. The "machines move first" rule is what handles that, and it has to be followed
  by hand; nothing checks it.
- A consumer of a published package on Node 24 is cut off by the new floor. None is known today.
- Downstream repos adopt this by copying this ADR (and ADR-1020 with its flipped Status), and moving
  `engines` to `>=26.0.0` and `@types/node` to 26.x. A repo with a `renovate.json` moves its
  `@types/node` rule to 26.x in the same commit.
- `compliance-review`'s TypeScript checklist line changes to match.
- Promotion condition: if a project gains a consumer or machine that has to stay on an older line,
  reopen the floor for that project through a project ADR (ADR-1000).
