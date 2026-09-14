# Stance reviews

A dated record of **deliberately re-examining our own standing decisions** against current
reality — tooling, advisories, the ecosystem, and the codebase as it now is.

## Why this exists

ADRs are immutable, which is right: the record of what you believed at the time is the
valuable part. But immutable is not the same as *correct forever*. A decision can quietly
stop being true without anyone editing a line:

> A real case: an ADR recorded "no tool exists for X yet — revisit later." The package manager
> shipped four native controls for X **ten days after** that ADR was written. Nothing in CI
> could catch it, because nothing was broken. The stance was simply stale, and the only reason
> it surfaced was someone asking an offhand question months later.

Tooling moves in weeks. This directory is the habit that catches it on purpose instead of by
luck.

## The cadence, and how deferral works

- The review is due **every 30 days**.
- `stance-review.yml` checks the newest entry here. If it's older than 30 days, it opens (or
  reuses) an issue labelled `stance-review`.
- If that issue sits open for **7+ days**, the workflow adds a nudge comment. It keeps nudging
  weekly.
- **It never fails a build and never blocks a merge.** A review that blocks CI gets disabled
  the first busy week, and then you have neither the gate nor the habit.

Deferring is legitimate and expected. Record the deferral — write an entry that says "reviewed
the list, nothing to change, next look after <thing> lands." That resets the clock honestly and
leaves a trail of *why* it was deferred, which is itself worth having.

## Running one

Locally, with Claude Code: `/stance-review` (see `.claude/skills/stance-review/`). It reads the
ADRs, checks each one's stated assumptions against current sources, and drafts an entry.

By hand, the checklist is:

1. **Every ADR with a promotion condition** — has the condition been met? (This is why
   `TEMPLATE.md` asks for one.)
2. **Every "no tool exists / not available yet / revisit later"** claim — is it still true?
   Check the tool's *current* docs, not memory.
3. **Supply chain** — has the package manager or ecosystem added controls we don't use? Are
   pinned versions still supported? New advisories in our dependency classes?
4. **Rigor tier** — has the core grown an invariant that deserves promotion from property
   tests to proofs?
5. **The template itself** — has `cr-ci-cd-rust-typescript-template` moved on since we
   scaffolded? (`git fetch template && git log --oneline HEAD..template/main -- docs/ .github/`)
6. **Anything the last review deferred** — did the thing it was waiting on land?

## Outcome

Every finding becomes **a new ADR**, never an edit to an old one. That's what makes this
compatible with immutability rather than in tension with it: the review supersedes, it doesn't
rewrite.

## Entry format

`YYYY-MM-DD-stance-review.md`:

```markdown
# Stance review — YYYY-MM-DD
- Reviewer: <name>
- Previous: <link to previous entry, or "first">

## Checked
<what you actually looked at, with sources — the checklist above, item by item.
"Checked, unchanged" is a real result and worth one line.>

## Findings
<what's stale, with evidence. Empty is a fine outcome; say so explicitly.>

## Actions
<new ADRs written (link them), issues opened, or an explicit deferral with the
condition that should trigger the next look.>
```
