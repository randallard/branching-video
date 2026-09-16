/**
 * Getting existing data into the log (ADR-0011).
 *
 * Three kinds of thing have to keep loading after the move to events: `localStorage` drafts, old
 * `bvp-backup` bundles, and single-show config files. All three become `show-snapshot` events.
 *
 * The event id is a content hash of `(showId, config)` and deliberately does **not** include the
 * timestamp, so importing the same content twice — on this device or another — produces the same
 * id and the second import dedupes away to nothing. That is what makes re-importing a backup, or
 * migrating the same draft on two machines, safe.
 */
import type { ShowConfig } from "./config.ts";
import { normalizeConfig } from "./config.ts";
import { contentHash } from "./canonical.ts";
import type { ShowEvent } from "./events.ts";
import type { DraftEntry, LegacyBackup } from "./legacy-backup.ts";

/** The deterministic show id for a draft carried over from `localStorage` (ADR-0009), so the same
 * legacy draft migrated on two devices lands on the same show rather than forking. */
export function legacyShowId(slug: string): string {
  return `slug:${slug}`;
}

/** A snapshot event for a config. Same `(showId, config)` always yields the same event id. */
export function snapshotEvent(showId: string, config: ShowConfig, at: string): ShowEvent {
  return {
    id: `snap-${contentHash({ showId, config })}`,
    at,
    v: 1,
    kind: "show-snapshot",
    showId,
    config,
  };
}

/** A draft as it sits in `localStorage` or inside an old backup. */
export interface LegacyDraft {
  slug: string;
  /** Milliseconds since the epoch, as the old index recorded it. */
  modified: number;
  config: unknown;
}

/** The draft's own recorded time where it has a usable one, else the caller's import time. */
function draftTime(modified: number, fallbackAt: string): string {
  if (!Number.isFinite(modified) || modified <= 0) return fallbackAt;
  const iso = new Date(modified).toISOString();
  return Number.isNaN(Date.parse(iso)) ? fallbackAt : iso;
}

/**
 * Snapshot events for a set of legacy drafts. Drafts whose config isn't recognisable are skipped
 * rather than failing the whole migration — one unreadable key must not cost someone the rest of
 * their work.
 */
export function snapshotEventsFromDrafts(
  drafts: readonly LegacyDraft[],
  fallbackAt: string
): ShowEvent[] {
  const events: ShowEvent[] = [];
  for (const draft of drafts) {
    if (draft.slug === "") continue;
    const config = normalizeConfig(draft.config);
    if (config === null) continue;
    events.push(
      snapshotEvent(legacyShowId(draft.slug), config, draftTime(draft.modified, fallbackAt))
    );
  }
  return events;
}

/** Pair an old backup's index with its configs, so a `bvp-backup` file imports exactly the way
 * the same drafts would have migrated from `localStorage` — onto the same shows. */
export function draftsFromLegacyBackup(backup: LegacyBackup): LegacyDraft[] {
  return backup.index.map((entry: DraftEntry) => ({
    slug: entry.slug,
    modified: entry.modified,
    config: backup.configs[entry.slug],
  }));
}

/** Every `localStorage` draft, as events. `read` hands back the stored config for a slug. */
export function migrateLocalDrafts(
  index: readonly DraftEntry[],
  read: (slug: string) => unknown,
  fallbackAt: string
): ShowEvent[] {
  return snapshotEventsFromDrafts(
    index.map((e) => ({ slug: e.slug, modified: e.modified, config: read(e.slug) })),
    fallbackAt
  );
}
