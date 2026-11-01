# 2026-11-01 (1): the stack merged, and the first compliance review

Ryan asked for a compliance review of this repo and cycle-in before merging, after a `gr sync`
that brought the template up to ADR-1019 (HTTP APIs linted against a vendored `api-standards`
ruleset).

## The review

[compliance/2026-11-01.md](../compliance/2026-11-01.md), the first one here. It reviewed the tip of
the #40 → #41 → #44 stack, since that was about to become `main`. Three gaps, none serious and
none applied: ADR-1019 and the skill text that comes with it aren't inherited; there's no
`.env.example`; and Renovate's #43 proposes TypeScript 7 with nothing in `renovate.json` holding
it at 6 as ADR-1010 says. ADR-1019 asks nothing else of this repo: there's no OpenAPI document,
and the only `fetch` calls read the site's own static files.

## The merges

#40 merged first. #41 and #44 were based on the branch below them, and CI here runs only on pull
requests into `main`, so neither had any checks. Retargeting a PR's base isn't a CI trigger
either (the default `pull_request` types are opened, synchronize and reopened). Closing and
reopening each PR ran CI without force-pushing a rebased branch. Both went green and merged in
order: `cc49128`, `ddb659c`, `6da811e`. `main`'s CI is green (run 41316237993). #41's OSV scan
read 309 packages from the pnpm 12 lockfile, so ADR-1018's concern holds in CI as well as
locally.

## Next

The three gaps (Ryan's call), then Renovate triage, then the real-YouTube aside check and the five
manual checks. See PROGRESS.
