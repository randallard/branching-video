# 2026-10-14 (2) — the age gate moves to one day, and the quarantined ignore disappears

Documents `8e7d774`. Corrects [the entry above](2026-10-14-transitive-advisories-and-one-quarantined.md):
that entry ignored `http-cache-semantics` until 2026-10-18 because of the 14-day gate. Ryan
remembered the 14 days had been judged overkill elsewhere; `the-lot` and `square-one` both run
1 day (pnpm's documented recommendation and v11 default), and `the-lot`'s PROGRESS records that
waiting out a "quarantine" had been wrong there too. Not something the template sets (it only says
"age-gate at the package manager"), so the 14 was cycle-in's 2026-07-18 number carried over.

[ADR-0030](../adr/0030-one-day-age-gate.md) supersedes ADR-0014 on the number. With a 1-day gate
`http-cache-semantics` 4.3.0 installs, so it is an ordinary override, `osv-scanner.toml` is
deleted, and the PR carries no dated ignore. Verified: lint, 135 tests, build, `pnpm audit`
("No known vulnerabilities"), OSV scanner ("No issues found"). ADR numbering skips 0029 here
because that is the transfer-handoff ADR on its own branch (PR #21).

Follow-up: cycle-in carries the same 14-day number and a seven-entry dated ignore list.
