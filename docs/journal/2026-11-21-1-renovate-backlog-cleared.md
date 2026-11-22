# 2026-11-21: the Renovate backlog, cleared

Three weeks of Renovate PRs (10 open) merged at Ryan's ask: *"I do want you to go ahead with the
easy PR's"*.

## Merged (squash), `main` CI green after the last

#46 pnpm 12.21.0 (`packageManager` only; ADR-0035's pnpm 12), #54 vitest 5.1.1, #55
pnpm/action-setup 6.1.1, #56 vite 8.3.8, #57 @playwright/test 1.65.1, #58 typescript-eslint 8.73.0,
#59 osv-scanner-action 2.7.1 (ADR-1018's floor is 2.7.0), #60 eslint 10.15.0, #61 fast-check 4.10.3.

## Two things learned

- **#58's red CI was a withdrawn advisory.** GHSA-fc5q-39xc-vjpf (picomatch ReDoS, no patched
  version) failed `ts supply chain` and OSV on 11-18; GitHub withdrew it at 15:38 the same day. A
  re-run passed. When an advisory has no patched version, check `withdrawn_at` before writing an
  override or an ignore.
- **Branch protection is strict here** (a PR must be up to date with `main`), so the queue drained
  one merge per Renovate rebase: tick the rebase checkbox, wait for CI, merge, repeat. Nine PRs took
  most of an afternoon. Renovate automerge is built to walk this queue itself.

## Left

- #53 lockfile maintenance: every check green, held by `renovate/stability-days` (the one-day age
  gate, ADR-0030). Merge once it clears.
- Proposed to Ryan, not decided: an ADR for Renovate automerge of green non-major updates, grouped
  weekly, with majors and the ADR-pinned packages staying manual.
- The local branch `changes-for-playthrough-unverified` (`c2ec7e8`, 2026-06-02, "unverified
  changes"), on `data` only and never merged: Ryan to decide whether to keep it.
- Next: the cello epic (looping a section; check-ins as a link, a note, or just a time), once Ryan
  confirms the story list.
