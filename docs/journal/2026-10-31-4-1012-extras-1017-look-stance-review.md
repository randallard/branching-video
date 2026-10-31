# 2026-10-31 (4) — ADR-1012's extras, an ADR-1017 look, and the first stance review

Documents `51bb425` (ADR-0032, ADR-0033) and the stance-review commit (branch
`adopt-1012-extras`). Ryan asked to work through the three items the inheritance PR left open.

## 1. The extras (`51bb425`)

Asked with the numbers (0 `any`, 39 casts by the AST counter, an existing Playwright suite),
Ryan chose yes to both.

**Registry (ADR-0032).** Reading each cast in context is what decided it. The ones that looked
riskiest, the Editor's and Studio's "Use" of a history value for `endScreen` and `choices`
(cast where every other field is `typeof`-checked), turned out to be sound: the reducer records
history from the node *after* normalizing it (`reduce.ts`, `put(…, entry.node[field], …)`). That
reason is now in each comment and the registry, so a change to the reducer knows what depends on
it. What came out instead: 12 test fixtures cast `as ShowEvent[]` that were all valid (now
`satisfies`, so a typo fails to compile; one helper's `field: string` became `ShowField`),
`cloneNode`'s `as JsonRecord` (now an `isRecord` check, same output), and `byId`'s
default-constructor cast, which would have let `byId<HTMLInputElement>("x")` return an
unchecked element (now overloads). 39 → 25. The check is cycle-in's script, in `tools/` here.

**axe (ADR-0033).** Three of five pages failed on the first run. Contrast: primary buttons at
3.88:1 and their hover (the link accent) at 2.66:1; hints at 3.73:1; and an empty-state link
nobody had styled, at the browser default blue, 1.85:1 on the dark panel. Labels: the Editor's
`field()` and Studio's `mkField()` render a visible `<label>` that was never tied to its control,
so nearly every field was unnamed to a screen reader. The fix uses `aria-labelledby` on the
label's text alone, because the history badge sits inside the label and `for`/`id` would have
read "Title ⟲ 2". A hand-built "Style" field and two Studio setup labels needed the same; the
scrolling node list needed `tabindex`. The pages have one colour scheme, so unlike cycle-in each
check runs once.

One flake on the way: the player check passed on the first run and failed on the second. The
choices fade in over 350 ms, and axe measured contrast mid-fade. The test now waits for full
opacity; three runs in a row pass. Reverting the home button colour fails the home check.

## 2. The ADR-1017 look

ADR-1017: a screen with more than a handful of managed values keeps them in one pure reducer
with property tests over action sequences; position is never derived from facts; facts aren't
copied. Counting module-level state:

- **The player** keeps its position (current node, the aside's return point, whether choices
  have shown this segment, whether the segment is ready, two timers) in six module variables,
  assigned in 16 places across its handlers, with no reducer. That is the case 1017 was written
  for, and the one that would benefit: its invariants (a return point only while in an aside;
  choices at most once per segment) are exactly what a property test over action sequences
  checks.
- **The Editor and Studio** hold few managed values, but each keeps a working `config` the page
  mutates directly (29 assignments in the Editor), which the diff emitter turns into events. The
  log stays the only stored fact, so it's 1017's spirit but not its letter, and nothing records
  the exception.

Both are Ryan's call, so they're proposals in the stance review, not changes.

## 3. The first stance review

[`docs/reviews/2026-10-31-stance-review.md`](../reviews/2026-10-31-stance-review.md). Most
promotion conditions are about use (bundle size, collision frequency, renamed ids) and can't be
checked from the repo; the record says which. ADR-0008's "history view not built" is stale
(ADR-0023 built it). pnpm 12 was trialled on a throwaway export the same way as cycle-in's: no
unrecognised settings, and OSV v2.7.0 reads the full two-document lockfile (308 packages), so
the scanner problem cycle-in hit doesn't apply here. The trial again left a store at
`/tmp/.pnpm-store`, checked as this run's (created 12:58) and removed. docs-hygiene now passes
with no warnings.

## Next

Merge the PR. Then Ryan decides the review's three proposals: a player reducer, an ADR for the
Editor/Studio working copy, and pnpm 12.
