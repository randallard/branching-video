# ADR-0033: Accessibility is checked with axe against every page in CI
- Status: Accepted
- Date: 2026-10-31
- Deciders: Ryan

## Context
[ADR-1012](1012-strictness-extras-offered-at-project-start.md)'s second extra is accessibility
lint: jsx-a11y for JSX, or axe for non-JSX UIs. These pages are vanilla DOM, so it has to be axe
against the rendered page. The Playwright suite ([ADR-0027](0027-playwright-browser-tests-against-the-built-site.md))
already runs against the built site with YouTube faked, so axe joins it, not a new harness.

The first run failed three of five pages, with three kinds of problem:
- **Contrast.** Primary buttons, light text on `--accent-2` (`#3a6fd8`), at 3.88:1, and their
  hover colour `--accent` at 2.66:1; field hints (`#6b7585`) at 3.73:1; and the home page's
  empty-state link, left at the browser's default blue, at 1.85:1 on the dark panel. AA needs
  4.5:1.
- **Labels.** Nearly every Editor field and Studio's sidebar fields had a visible `<label>` that
  wasn't tied to its control, so a screen reader announced an unnamed input. The cause was one
  helper per page (`field()` in the Editor, `mkField()` in Studio), plus a hand-built "Style"
  field and two labels in Studio's setup form.
- **Keyboard.** The Editor's node list scrolls but couldn't be focused.

## Decision
- `e2e/a11y.e2e.ts` runs `@axe-core/playwright` (4.14.0, MPL-2.0, exact-pinned) with the WCAG 2.1
  A and AA tags against home, create, the player (playing, choices shown, menu open), Studio
  (empty and with a show) and the Editor (empty and with a show). Any violation fails, listed
  with axe's rule, impact and selectors. It runs in the existing `e2e` CI job, which deploy waits on.
- The fixes: `--accent-2` → `#3464c2` (4.61:1) and a separate `--accent-hover` (`#4267ae`, 4.56:1)
  for primary buttons; hints → `#818a98` (≥4.5:1 on all three dark backgrounds); the empty-state
  link takes `--accent`. `field()`/`mkField()` give the label's text an id and point the control at
  it with `aria-labelledby`, so the history badge beside it isn't read as part of the name; the
  Style field goes through `field()`; Studio's setup labels gain `for`; the node list gets
  `tabindex="0"` and a name.
- **One colour scheme.** No page has a `prefers-color-scheme` rule, so each check runs once.

## Alternatives considered
- **Say no.** Lost on the evidence: real failures on three of five pages.
- **`for`/`id` on every field label.** It works, but the history badge inside the label would then
  become part of each field's name ("Title ⟲ 2").

## Consequences
- Primary buttons are a shade darker, and their hover is no longer the link accent.
- The player's choices fade in, so the test waits for full opacity before measuring; contrast
  measured mid-fade is an artefact of the test, and it flaked once before that wait was added.
- axe finds what can be found automatically, roughly a third to a half of WCAG. It doesn't judge
  keyboard flow, focus order, or how the pages sound in a screen reader; the five manual checks
  in `e2e/README.md` stay manual.
- Promotion condition: run every check in both schemes if a light theme is added; add a
  keyboard-only walkthrough when the Editor or Studio next changes shape.
