# `any` / `as` registry

Every `any`, and every type assertion other than `as const`, in `src/` (tests included), with
why it's sound ([ADR-0032](adr/0032-every-cast-is-registered.md)). Each also carries its reason
inline, as a `// cast (any-registry): …` comment directly above it, which is where the full
reason lives. A new cast without both doesn't merge.

`pnpm casts` (`tools/any-registry-check.ts`) checks the counts below against the code and that
every cast has its comment; CI runs it. It reads the TypeScript syntax tree, so text in comments
and strings doesn't count, and `x as unknown as T` counts once. `node tools/any-registry-check.ts
--list` prints every cast with its line.

## Counts (checked by CI)

| File | Casts |
|---|---|
| `src/core/bundle.test.ts` | 2 |
| `src/core/bundle.ts` | 2 |
| `src/core/canonical.test.ts` | 1 |
| `src/core/events.ts` | 1 |
| `src/core/reduce.test.ts` | 1 |
| `src/core/reduce.ts` | 1 |
| `src/core/validate.test.ts` | 2 |
| `src/pages/editor.ts` | 5 |
| `src/pages/studio.ts` | 1 |
| `src/shell/draft-session.ts` | 2 |
| `src/shell/draft-store.test.ts` | 4 |
| `src/shell/drafts.ts` | 1 |
| `src/ui/history.ts` | 2 |

There are no `any`s.

## The kinds, and why each is sound

| Kind | Where | Why it's sound |
|---|---|---|
| Guarded narrowing | `bundle.ts` (2), `events.ts`, `canonical.test.ts` | Each follows an `typeof … === "object" && … !== null` check, and every field is type-checked before it's trusted. |
| Unreachable default | `reduce.ts` (unknown kinds) | Statically `never`; at runtime an event from a newer build whose `kind` `isShowEvent` already checked. |
| History values | `editor.ts` (`endScreen`, `choices`), `studio.ts`, `ui/history.ts` (2) | The reducer records history from the node *after* normalizing it (`reduce.ts`, `put(…, entry.node[field], …)`; choices via `cloneChoices`), so the stored `unknown` is a normalized `EndScreen` / `Choice[]`. |
| JSON deep copies | `editor.ts` `copyOf`, `draft-session.ts` (backstop) | A JSON round-trip of JSON-shaped show data returns the same shape. |
| Browser APIs missing from the DOM lib | `editor.ts` (`FsaWindow`, `UaDataNavigator`) | Declared optional; every use checks for the method first. |
| Filled by the loop above | `draft-session.ts` `identify` | The loop replaces every `undefined` with `newId()` before the cast. |
| `JSON.parse(…) as unknown` | `drafts.ts`, `draft-store.test.ts` (4), `bundle.test.ts` | Widens `any` to `unknown`: claims nothing, and callers must narrow. |
| Test fixtures | `reduce.test.ts` (a deliberately unknown event kind), `validate.test.ts` (2), `bundle.test.ts` | Raw or deliberately invalid input to the code under test; a wrong shape fails the test. |

## Removed rather than registered (2026-10-31)

Writing the reasons removed 14 of the original 39:

- **12 in `reduce.test.ts`**: the event fixtures were cast `as ShowEvent[]`, but every one was a
  valid event, so they're `satisfies ShowEvent[]` now and a typo'd field fails to compile. One
  helper took `field: string`; it takes `ShowField` now.
- **`reduce.ts` `cloneNode`**: `(node ?? {}) as JsonRecord` claimed an `unknown` was a record.
  Now `isRecord(node) ? node : {}`, which normalizes to the same node.
- **`ui/dom.ts` `byId`**: its default constructor was `HTMLElement as unknown as new () => T`, which
  would have let `byId<HTMLInputElement>("x")` return an unchecked element. Overloads now tie the
  element type to a constructor that's actually checked.
