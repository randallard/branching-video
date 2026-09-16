# 2026-09-15 (3) — Slice 3a: the event-log core

Slice 3 is the biggest of the four and the one with the most ways to go wrong: it replaces the
storage model under three pages that are already live and only partly browser-verified. So I cut
it in half. **3a is the pure core plus the store — additive, importing nothing and imported by
nothing.** The built page hashes came out identical to the previous build, which is the proof:
the running app is byte-for-byte what it was. 3b does the wiring, where the risk actually is.

## What got built

- **`core/order.ts`** — fractional order keys (ADR-0008). A node carries a sortable `order`
  string instead of an index, so two devices that each insert a node keep both. Keys are base-62
  fractions compared as plain strings, which is why the alphabet is in ASCII order.
- **`core/canonical.ts`** — key-sorted JSON and a 64-bit FNV-1a hash.
- **`core/events.ts`** — the envelope and the ADR-0008 kinds.
- **`core/reduce.ts`** — dedupe by id, sort by `(at, id)`, fold.
- **`core/bundle.ts`** — the event bundle for Export/Import All.
- **`core/migrate.ts`** — legacy drafts, `bvp-backup` bundles and single-show files as snapshots.
- **`shell/event-store.ts`** — IndexedDB append/read-all, idempotent by event id.

## Things that only became clear while writing it

**Per-field last-writer-wins needs no machinery.** ADR-0008 reads like it wants per-field conflict
resolution. It doesn't: if you fold in `(at, id)` order and each `*-field-set` touches exactly one
field, last-writer-wins is what already happens. The test that two devices editing *different*
fields both survive passes without a line of code aimed at it. Writing that test first would have
saved me sketching a resolution table I then deleted.

**Snapshots need deterministic node keys, and the ADRs don't say where they come from.** A
snapshot arrives as a plain config whose nodes have no `nodeKey`, but later per-field edits have
to target those nodes, and two devices importing the same file must agree on the keys or the edits
land on nothing. The rule I settled on is `n:<node.id>`, disambiguated by position when ids repeat
or are blank — node ids are unique in any config that validates (ADR-0009 rules them out as
*identity*, not as a derivation), and renaming one later is a `node-field-set` that leaves the key
alone. It's in `snapshotNodeKeys`, property-tested for determinism. Worth an ADR if 3b makes me
lean on it harder.

**`node-removed` is the one kind that isn't last-writer-wins.** ADR-0008 says removal wins over
later field sets, so the reducer carries a `removed` set per show and drops edits to those keys.
Two cases the ADR doesn't cover, decided here and written down: a later `node-added` on the same
key re-creates the node (a re-add is a deliberate act), and a `show-snapshot` clears the whole
removal record (it's the whole show). Both are tested.

**The event id must not include the clock.** ADR-0011 says the snapshot id is a hash of
`(showId, config)`, and it's worth being explicit about why `at` is excluded: the same draft
migrated on two devices is migrated at two different times, and if the time were in the id you'd
get two snapshots of identical content and a pointless "last writer" between them. Excluding it
makes re-import genuinely a no-op. There's a property test asserting the id is the same for two
different timestamps.

## Verified

`pnpm lint` clean, `tsc` clean, `pnpm build` green, `pnpm test` **71 passing (was 30)**, both live
shows still validate, docs hygiene clean (one pre-existing warning: no stance review yet).

The 41 new tests are property-based per ADR-0004. The flagship is permutation-invariance — `reduce`
is a function of the event set, so `reduce(events) === reduce(reversed)` — because that is the
property the whole "merging is just union" claim rests on. Also: migration idempotence, bundle
round-trip and determinism, two-device union commutativity, order keys under 500 repeated
insertions at the same spot (the pathological edit pattern), and an old `bvp-backup` landing on the
same shows as the drafts it came from.

The lint gates bit four times — dynamic `delete node[field]`, template literals over numbers, an
`??` the type checker could prove unnecessary. All real, all fixed rather than silenced; the
`delete` one pushed `applyNodeField` into one explicit case per field, which reads better anyway
under `exactOptionalPropertyTypes`.

## Next: slice 3b

The wiring, and it is the part that can break things people can see:

1. Emit diffs, not snapshots, from Studio and the Editor — compare the edited config against the
   reduced one and append one event per changed field. ADR-0008 requires this, and it's also what
   gives ADR-0007 the coalescing it asks for (one event per field per edit burst, not per
   keystroke).
2. Run the one-time `localStorage` migration on first load. `migrateLocalDrafts` is written and
   tested; nothing calls it. The `bvp:*` keys stay put so a rollback loses nothing.
3. Point Export All / Import All at event bundles, and take the ADR-0011 update-or-add prompt for
   single-show files — the feature that started this whole migration.
4. Unify the Studio and Editor serializers, which slice 2 deliberately left divergent.
5. Reducer-level tests for the diff emitter, the one piece of provability slice 3a doesn't cover
   because the emitter doesn't exist yet.

Ryan's slice-2 browser pass is still owed and is now more valuable, not less: 3b changes what
those same pages do with their data, so a clean read of current behaviour is the baseline to
change against.
