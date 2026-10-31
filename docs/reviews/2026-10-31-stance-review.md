# Stance review — 2026-10-31
- Reviewer: Claude (Opus 5.5), for Ryan
- Previous: first

## Checked

Against `.claude/skills/stance-review/SKILL.md` (the template's current text, inherited today).

1. **Every active ADR's promotion conditions** (0001–0033; superseded ones skipped).
   - ADR-0004 (provable-lite): revisit "if the event model grows invariants that property tests
     keep missing (e.g. a merge bug found by use rather than by a test)". The journal records no
     such bug; the bugs found since were found by tests or by the e2e suite. **Unchanged.**
   - ADR-0007 (compaction deferred until a real bundle passes a few MB): **not checkable from the
     repo**; it depends on bundles in browsers. Ryan to say if one has grown.
   - ADR-0020 (relative base until a page moves into a subdirectory), ADR-0026 (CSP by meta tag
     until the site leaves GitHub Pages), ADR-0029 (show ids in links until drafts sync between
     devices): none of those has happened. **Unchanged.**
   - ADR-0023, 0024, 0025, 0031: conditions about how authors use the tool (history read as a
     narrative, collisions common, ids renamed routinely, pauses wanted back). No reports.
     **Unchanged.**
   - ADR-0030: revisit if a compromise slips through the one-day gate. None known. **Unchanged.**
   - ADR-0003's "until slice 4 lands" consequence was met on 2026-09-18 (slice 4 delivered in 3b.3).
2. **"Not yet / revisit later" claims.** ADR-0008: "a later history view could recover" losing
   writes, "not built". **Built since**, as ADR-0023's per-field history (2026-09-19). ADR-0026:
   Subresource Integrity isn't available for the YouTube loader, which is a moving target by
   design. Still true.
3. **Config against the package manager's baseline** (https://pnpm.io/supply-chain-security, read
   2026-10-31 for cycle-in's review): `minimumReleaseAge` 1440, `trustPolicy: no-downgrade`,
   `blockExoticSubdeps`, `strictDepBuilds` (stated today, ADR-1016), and a build allowlist. The
   allowlist here is `onlyBuiltDependencies: []`; the page now leads with `allowBuilds`. Both are
   accepted by pnpm 11 and 12 (see 8). **Unchanged; noted.**
4. **Advisories.** Cleared today (PR #20 and after). `pnpm audit`: none. OSV v2.7.0: no issues
   in 293 packages. **Unchanged.**
5. **Rigor tier.** The core has no new invariant that wants a proof over a property test. A
   separate finding under ADR-1017 is listed below: the player's position state.
6. **Template drift.** `template/main` at `dcb2924`; every inherited ADR (1000–1018) present as of
   today, and both skills identical. **None.**
7. **Last review's deferrals.** First review.
8. **Package-manager majors (ADR-1016).** pnpm 12 is out (12.17.0); this repo pins 11.28.10.
   Sources: the v12.0.0 release notes (read for cycle-in today) and a trial here, on a throwaway
   `git archive` export outside the repo with scripts off: pnpm 12.17.0 installed with **no
   unrecognised-setting error**, and lint, 145 tests and the build passed. Its lockfile is two
   YAML documents, which OSV v2.7.0 reads in full (308 packages: ours plus pnpm's 15). This repo
   is already on OSV v2.7.0 (ADR-1018), so the move is safe for the scanner. As with cycle-in, a
   frozen install fails when only `packageManager` moves, so it's a lockfile-regenerating change.

## Findings

1. **ADR-1017, the player.** Its position (current node, the aside's return point, whether this
   segment's choices have shown, whether the segment is ready, two timers) lives in six module
   variables in `src/pages/player.ts`, assigned in 16 places across its handlers, with no
   reducer and no property tests. This is the screen kind ADR-1017 was written for.
2. **ADR-1017, the Editor and Studio.** Each keeps a working `config` that the page mutates
   (29 assignments in the Editor) and the diff emitter turns into events, so the event log stays
   the only stored fact. That is ADR-1017's spirit but not its letter ("never copied"), and no
   project ADR records it.
3. **pnpm 12** is viable here, as in cycle-in.

## Actions

- **Proposed, waiting on Ryan** (stance changes are his call):
  - a project ADR and a change moving the player's position into one pure reducer with property
    tests (for example: the return point exists only while in an aside; choices show at most once
    per segment);
  - a project ADR recording the Editor/Studio working copy as a projection the diff emitter
    turns into events, the deliberate exception to ADR-1017's "never copied";
  - moving to pnpm 12, as its own change (cycle-in's ADR-0021 is the model).
- **Unchanged and recorded:** everything else above. Next look: 30 days, or sooner if a bundle
  grows past a few MB (ADR-0007).
