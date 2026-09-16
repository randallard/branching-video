# 2026-09-15 (2) — Browser pass: the last node wraps, and the video keeps going

Ryan did a partial browser pass on the ukulele show. ADR-0022 works: the eleven no-choice nodes
played through one after another instead of stopping on "Watch again" at every segment, which is
what the whole ADR was for. Then the last node ended and the show posted "That's a wrap."

His read was that it should just keep playing. Mine, at first, was that this was ADR-0022 working
as designed — the ADR says in as many words, *"Only the last such node falls back to the 'Watch
again' screen,"* and `segmentEndAction` implements exactly that, with no off-by-one: the last node
does play, and wraps at its `end`.

## The fact that made it interesting

The master video (`Jvu5VZVe3MI`) is **1190 seconds**. The last node,
`chords-of-a-key-concise`, ends at **806.5**. So the wrap screen wasn't just a screen Ryan didn't
like — it was cutting off **6 minutes 24 seconds** of real video.

Two things pointed at how it happened:

- `public/live/cards-hummingbird-and-flutter.json`'s last node (`06-second-flip`) leaves `end`
  **unset**, so it already runs to the video's natural end. The hand-authored show has the shape
  you want; the exported one doesn't.
- The ukulele file is a **Studio export**, and Studio writes an `end` on every node it marks —
  including the last. Ryan marked eleven chapters and stopped marking. The `end: 806.5` is an
  artifact of where he stopped, not an instruction to end the show there.

## The decision

I put it to Ryan as a fork, since reversing ADR-0022 would need a new ADR superseding it and that
is his call, not mine. I'd been leaning toward changing the rule — the objection I expected to
block it dissolves, because an author who genuinely wants to stop early can put an `endScreen` on
the last node, which still outranks continue/wrap (that's exactly what `big-buck-bunny.json`'s
`outro` does). So nothing would have been lost.

**Ryan chose to leave the behaviour alone and document the authoring rule instead.** ADR-0022
stands, unamended, and no code changed. The last node wraps; it's on the author to give the show
a final node that reaches the end of the video.

Worth saying plainly: this is a documentation fix for a real content loss, so it leans on the docs
being read. The alternative — making the player paper over an under-chaptered show — would have
hidden the same mistake instead of naming it.

## What was written

- **README** — a warning block under *config.json schema*, right after the master-video slicing
  bullets, with the concrete 19:50-vs-13:26 numbers, the two ways to finish a show (leave the last
  `end` unset, or set it to the full duration), the `endScreen` escape hatch for stopping early,
  and the Studio-writes-`end`-on-every-node trap that causes it.
- **README schema table** — the `end` row now says to leave it unset on the last node; the
  `choices` row names the "That's a wrap" screen and what to do about it.
- **README "Adding new content"** — step 3 gained the last-node case, since that checklist is what
  people actually follow when appending a segment.
- **`create.html`** — a note on the "Build a show in the editor" step, the page someone reads
  *before* they make this mistake.

Deliberately not done: a validator warning for a last node ending short of the video duration. It
was on the table and Ryan didn't pick it. It would need the video's real duration, which the
validator doesn't have and can't get without a network call.

## Verified

`pnpm lint` clean, `pnpm build` green, `python3 scripts/docs-hygiene.py` clean (one pre-existing
warning: no stance review yet). Docs-only change — no `src/` file touched.

## Still owed

The rest of the browser pass. Ryan's was partial: the play-through is confirmed, but YouTube
playback quirks, segment transitions, the choice countdown, asides/back-to-branch, Studio marking
against a playing video, the Editor's mobile drawer and Chromium Save As are all still unchecked.
