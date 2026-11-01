# 2026-11-01 (4): ADR-1020 from the template, superseding ADR-0037

The template took this repo's Node 26 move as a standard. Template ADR-1020 (CI runs the Active
LTS, Node 26; the `engines` floor and `@types/node` stay one LTS behind, at 24) supersedes
ADR-1013. Ryan chose to keep the floor at 24, which is the same answer as this repo's ADR-0037.

`980c686`: ADRs 1013 (now superseded) and 1020 copied byte-identical, with their index rows.
[ADR-0037](../adr/0037-ci-runs-node-26-lts-ahead-of-the-template.md) is marked "Superseded by
ADR-1020", since the deviation it recorded is now the standard. `ci.yml`'s comments cite 1020, and
the Renovate `@types/node` 24.x rule now cites 1020 too. No code changed. Locally on Node 24: lint
and 159 tests pass. CI runs 26.

## Next

Merge the PR. Then, unchanged from (3): check that Renovate closes #36, #38, #39, #42 and #45
(close #2 if it isn't reworked); Ryan's real-YouTube aside check and the five manual checks; the
stance review on 2026-11-30.
