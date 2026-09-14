---
name: stance-review
description: Run the monthly stance review — re-examine this project's standing decisions against current reality (tool docs, advisories, the codebase) and record the result. Use when the stance-review issue is open, when asked to review our decisions/stance, or monthly.
---

# Stance review

Re-examine what this project has decided, against how the world is *now*. Output is a dated
record in `docs/reviews/` and, where something has gone stale, **new ADRs**.

## The rule that makes this work

**Findings become new ADRs. You never edit an existing one.** ADRs are immutable in substance
(`docs/adr/README.md`); a review that rewrites them destroys the record of what was believed
and when. Superseding is the mechanism — use it.

The only edits permitted are the superseded ADR's `- Status:` line and the index row.

## Why this exists

A decision can stop being true without anything breaking. The motivating case:

> An ADR recorded "no tool exists for this yet — revisit later." The package manager shipped
> four native controls **ten days after** that ADR was written. CI was green throughout; there
> was nothing to fail. It surfaced months later only because someone asked a passing question.

So the failure mode is silence, and the countermeasure is a scheduled, deliberate look.

## Do not trust your own memory

The whole point is catching drift between what we recorded and what's now true. Your training
data has a cutoff and this project's ADRs may postdate it — or predate a release that changed
everything. **Every "is this still true?" check needs a current source**: fetch the tool's own
docs, the advisory database, the changelog. An answer from memory is exactly the failure this
review exists to catch.

## The pass

Work `docs/reviews/README.md`'s checklist. Concretely:

1. **Read every ADR.** For each, extract: its promotion condition (if any), and any claim of
   the form "X doesn't exist / isn't available / not supported yet / revisit later."
2. **Check each such claim against a current source.** Prefer the tool's own documentation
   over blog posts. Cite what you checked.
3. **Compare our config against the tool's current recommended baseline.** This is where the
   motivating case would have been caught — the package manager published a recommended set
   and we'd adopted a subset without noticing the rest existed.
4. **Advisories** — anything new in our dependency classes since the last review.
5. **Rigor tier** — has the core grown an invariant that deserves promotion? In a TS project,
   is there now something that genuinely wants a proof rather than a property test?
6. **Template drift** —
   `git fetch template && git log --oneline HEAD..template/main -- docs/ .github/`
   (if no `template` remote: `git remote add template <template-url>`).
7. **Last review's deferrals** — did the thing they were waiting on land?

## Recording it

Write `docs/reviews/<today>-stance-review.md` in the format in `docs/reviews/README.md`.

**"Checked, unchanged" is a real and valuable result** — record it explicitly with what you
checked, so the next review knows the ground was covered and can look at the date rather than
redo the work.

**Deferral is legitimate.** If now isn't the time, say so, and name the condition that should
trigger the next look. That resets the clock honestly and leaves the reason on the record.
What's not acceptable is silence — an unrecorded review is indistinguishable from a skipped one.

## Finishing

Report to the user: what you checked, what's stale (with evidence), what ADRs you propose
writing. **Get agreement before writing new ADRs** — a stance change is the user's call, not
yours. Then close the `stance-review` issue by committing the review record.
