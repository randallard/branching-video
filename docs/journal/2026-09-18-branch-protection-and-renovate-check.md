# Branch protection on `main`, and a look for Renovate

Follow-up to the two things the [2026-09-17 supply-chain audit](2026-09-17-supply-chain-audit.md)
couldn't settle: no branch protection, and Renovate's installation unverified.

## Branch protection

Ryan asked for it directly rather than walking through the GitHub UI, so it went in via
`gh api --method PUT repos/randallard/branching-video/branches/main/protection`. Confirmed via a
follow-up `GET` that it's live.

Settings, and why:

- **Required status checks** (strict — branch must be up to date): `detect languages`,
  `docs hygiene`, `ts fast gates`, `ts supply chain`, `SBOM`, `OSV scan / osv-scan`. Pulled the
  exact context names from the check-runs on the last pushed commit (`f086a4f`) rather than
  guessing — GitHub Actions check names are the job's `name:`, not its id, and `OSV scan` posts as
  `OSV scan / osv-scan` because it's a reusable workflow.
- **`deploy to Pages` deliberately left out** of the required list — it only runs on `push` to
  `main`, never on a `pull_request`, so requiring it would make every PR unmergeable.
- **Require a pull request before merging**, with `required_approving_review_count: 0` and
  `require_code_owner_reviews: false`. This is the real workflow change: every commit on this repo
  so far has gone straight to `main` by direct push, and that's no longer possible. Approvals
  aren't required because Ryan is the only person who can review, and GitHub won't count a PR
  author's own approval — requiring one would deadlock every PR including Renovate's.
- **`enforce_admins: false`** — Ryan (as admin) can still bypass and push directly to `main` in a
  pinch. This makes the protection advisory-strength for him and real for anyone/anything else
  (Renovate, a future collaborator). Flagged as a toggle he can flip if he wants it to bind him
  too.
- Force pushes and branch deletion blocked; conversation resolution required before merge.
  Straightforward, no tradeoff.

## Renovate: still can't confirm installed, and now leaning "not installed"

Same wall as 2026-09-17: `gh api repos/randallard/branching-video/installation` and
`gh api user/installations` both 401/403 — the CLI's token isn't a GitHub App JWT and isn't
authorized as a user-to-server OAuth token, so neither endpoint that would give a straight answer
is reachable from here.

What's checkable came back empty across the board, four days after `renovate.json` landed:

- No issues, ever (`gh issue list --state all` → none). `config:recommended` has the Dependency
  Dashboard issue on by default, and onboarding normally opens it within the first run.
- No PRs, ever (matches the 2026-09-17 finding, still true).
- No webhooks on the repo (`gh api .../hooks` → `[]`) — not conclusive by itself, since a GitHub
  App's webhook lives on the App, not as a per-repo hook, but it's one more empty result.
- No `renovate[bot]` (or any bot) in `collaborators` or in `gh api .../events`. Events go back to
  2026-09-15 and show nothing but Ryan's own pushes and one discussion.

None of these individually prove absence — Renovate stays quiet if it finds nothing to update, and
`minimumReleaseAge: 14 days` in the config could suppress everything found so far anyway — but the
missing Dependency Dashboard issue is the strongest signal, since `config:recommended` turns that
on unconditionally regardless of whether there's anything to update. Four data points at zero,
with no way to query the one endpoint that would settle it directly. Leaning **not installed**.

**Update, same day:** Ryan checked <https://github.com/settings/installations> and confirmed it —
Renovate is not among the installed GitHub Apps (just Claude, Railway App, Vercel). So the lean was
right: `renovate.json` has been correct but inert since it was added, and ADR-0014 (age-gate
dependency admission) and ADR-0018's SHA-pin maintenance have had nothing proposing bumps for them
to gate.

**Update, later the same day: installed.** Ryan installed the app; the onboarding flow defaulted
to a paid tier first, which he caught and switched to free before confirming. `gh api
repos/randallard/branching-video/installation` still 401s from here (same token limitation as
above — it needs a GitHub App JWT, not a user token), and no Dependency Dashboard issue or PR had
appeared yet as of this check, which is expected — the first run isn't instant. Its onboarding and
update PRs will land through the same required-PR path branch protection now enforces on `main`.
Worth a look in a day or two to confirm the first PR actually shows up.
