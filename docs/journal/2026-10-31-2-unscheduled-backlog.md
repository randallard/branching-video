# 2026-10-31 (2) — the unscheduled backlog: favicon, auto-advance, overlaps, a grouped menu

Documents `8b652b4`, `fe60967`, `a52e2ff` and `c19df34` (branch `backlog-unscheduled`). Ryan
asked for the "not scheduled" list in PROGRESS, in its order, and dropped the last item
(Mermaid chapter maps).

## Favicon (`8b652b4`)

`public/favicon.svg`, a branching mark in `--accent` on `--panel`, linked from all five pages.
Vite rewrites `/favicon.svg` to `./favicon.svg` under `base: "./"`, so it resolves under
`/branching-video/` on Pages. The e2e harness's one tolerated console error (the favicon.ico
404) is gone, so the suite now fails if a page loses its icon.

## A lone default choice advances without choice UI (`fe60967`, ADR-0031)

The note from before slice 2 said this "decides how the ukulele show plays". It no longer does:
ADR-0022 made no-choice nodes play on in September, and said this fix wouldn't have helped them.
What's left is a node with **one** choice marked default, which showed a single "Continue" and
an 8 s countdown that could only do what the button does. Big Buck Bunny has two (`intro`,
`chapter-2`).

It is a separate route (`auto-advance`) rather than ADR-0022's `continue`, because the lone
choice's target needn't be the next node in order; a property test pins `continue` to the next
node, and that test would have caught conflating them. The e2e records every `.choice-btn` ever
inserted (a `MutationObserver` in an init script), so a button that flashed up and vanished
would fail too.

Two things got in the way, both mine. The first draft asserted `#countdown-wrap` hidden, but
the countdown bar is only ever hidden by its parent `#choices` fading to opacity 0, and
Playwright doesn't treat opacity as hidden; the right assertion is that `#choices` never gets
`.visible`. Then a `sed` meant for that line also rewrote the same assertion in the existing
mid-segment test (the replacement count said 2), and that test failed on the next run. Restored
by matching on the test's text, not a line number that had already moved.

Mutation check: disabling the rule fails both the unit and the e2e tests.

## Overlapping node times (`a52e2ff`)

`playOnOverlaps` in the routing core: every unconditional segment-end hop (`continue` or
`auto-advance`) whose target starts inside the source's range on the same video. Starting
inside, not merely earlier: a jump back to before the source's start is a cut, not an overlap,
and a choice to elsewhere isn't a play-on hop at all. The validator turns each one into a
warning (only on a config with no errors, since it reads the normalized model), and Studio puts
a ⚠ on the target's start time with the same explanation. `pnpm validate` on the ukulele
fixture reports exactly the case the note named; both live shows are clean.

fast-check earned its keep twice, though both times on the test, not the code: with **duplicate
node ids**, the test looked nodes up differently from the core. The player fills its node map in
order (`player.ts`, so the last duplicate wins) and the core matched it; the test was the odd one
out. Since the validator errors on duplicates and the overlap check only runs on error-free
configs, the property now skips them with `fc.pre`. A probe showed overlaps in only ~17 of 2000
generated configs (1094 with unique ids), so that property runs 2000 times instead of 100.

## The chapter menu, grouped (`c19df34`)

The note: split into "Main chapters" / "Deep dives" "if cluttered on mobile — let me know how it
reads on the phone." `menuSections` (pure, `src/core/menu.ts`) groups a show that has both kinds
and leaves a single-kind show flat; the player renders an uppercase muted heading per group.
Screenshot at Pixel 7 width against Big Buck Bunny reads cleanly: four main chapters, then the
two asides with their badges.

## Committing

The four features shared five files (`player.html`, `player.ts`, `player.e2e.ts`, `routing.ts`,
`routing.test.ts`). Each commit was staged from intermediate versions of those files and
checked on its own (`tsc -b`, lint, unit tests: 138 → 140 → 143 → 145), and the last commit was
compared byte for byte with the tested working tree.

## Next

Merge the PR; on the live site, watch Big Buck Bunny's `intro → chapter-1` and
`chapter-2 → aside-default` cut without a Continue button, and open the menu on a phone. Then
the five manual checks (PROGRESS, **Next** item 3) and the tooling trial.
