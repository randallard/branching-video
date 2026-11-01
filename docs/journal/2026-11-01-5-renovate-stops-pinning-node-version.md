# 2026-11-01 (5): Renovate stops pinning CI's node-version

After ADR-1020 merged (#49), Renovate's #2 came back as "pin node `26` → `26.13.0`" (manager
`github-actions`, dependency `node`, type `uses-with`). It's a pin only because the repo-wide
`rangeStrategy: "pin"` (ADR-0013) treats `node-version: 26` as a range. CI's Node is meant to be
the LTS line: `setup-node` resolves `26` to the newest 26.x on each run, and that's how security
patches arrive. A patch pin would freeze them, and every patch would then wait on a PR.

Ryan's call: close #2 and stop the pinning. `2329f13` adds a `packageRules` entry for that one dependency
with `rangeStrategy: "replace"`. Renovate then leaves `26` alone and still opens a PR when a new
major is out (Node 28, around 2027-10). That PR is the signal for ADR-1020's next move, as #42 was
for 1020 itself. Checked as valid JSON. The Renovate app validates the config on the PR.

## Next

Merge the PR, and check that Renovate doesn't reopen a node pin. Then, as in (3): Ryan's
real-YouTube aside check and the five manual checks; stance review 2026-11-30.
