# 2026-11-21 (2): template ADR-1023, Renovate automerge

The afternoon's backlog (journal 1) took hours, and most of that was waiting on rebases. Ryan:
*"I do want to add the automerge ADR but I think it is the type of update we should consider for
the template as well"*. It went into the template as **ADR-1023**, synced to GitHub as
`04a73e3`, and this repo inherits it here.

- `docs/adr/1023-…`, copied byte-identical, plus its index row.
- `renovate.json` gets the template's two rules. Minor and patch updates of 1.0+ packages
  automerge once every check passes and the age gate clears. So do digest, pin and
  lockfile-maintenance updates. Majors and 0.x minors stay manual. The rules already here are
  unchanged. `renovate-config-validator` passes.

`main` already requires seven checks, strict, so the precondition holds. **To watch:** branching-video requires PRs to be up to date, so each automerge sends the next PR back for a rebase. ADR-1023 expects `rebaseWhen: "auto"` to clear that queue without anyone stepping in. This repo is the first place that gets tested.

Not tested yet: the first automerged PR shows it working. The open lockfile PR should be the
first one after its age gate clears.
