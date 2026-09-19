// Home page: published shows from live/, local drafts (via the event-log DraftStore), and
// Export All / Import All.
import { isEventBundle } from "../core/bundle.ts";
import { normalizeConfig } from "../core/config.ts";
import { parseLegacyBackup } from "../core/legacy-backup.ts";
import type { ManifestEntry } from "../core/manifest.ts";
import { adoptExternalConfig } from "../shell/draft-session.ts";
import type { DraftStore } from "../shell/draft-store.ts";
import { openDraftStore } from "../shell/draft-store.ts";
import { setResume, setTransfer } from "../shell/drafts.ts";
import { downloadText, readFileText } from "../shell/files.ts";
import { SHOWS_DIR, fetchShows } from "../shell/shows.ts";
import { notifyCollisions } from "../ui/collisions.ts";
import { byId, input } from "../ui/dom.ts";

let draftStore: DraftStore;

// ── Published shows ───────────────────────────────────────────────────────
async function renderShows(): Promise<void> {
  const host = byId("shows");
  const shows = await fetchShows().catch((): ManifestEntry[] => []);
  if (!shows.length) {
    host.innerHTML =
      '<div class="empty">No shows yet. Build one in the <a href="editor.html">editor</a> and save it to the <code>public/live/</code> folder.</div>';
    return;
  }
  host.innerHTML = "";
  for (const s of shows) {
    const a = document.createElement("a");
    a.className = "show";
    a.href = "player.html?config=" + encodeURIComponent(SHOWS_DIR + s.file);
    a.innerHTML =
      '<span class="play">▶</span>' +
      '<span class="meta"><span class="t"></span><span class="f"></span></span>' +
      '<span class="go">Watch →</span>';
    const t = a.querySelector(".t");
    const f = a.querySelector(".f");
    if (t) t.textContent = s.title;
    if (f) f.textContent = SHOWS_DIR + s.file;
    host.appendChild(a);
  }
}

void renderShows();

// ── Local drafts ──────────────────────────────────────────────────────────
function renderLocalDrafts(): void {
  const host = byId("local-shows");
  const empty = byId("local-empty");
  // Re-rendering after an import: clear previous rows, keep the placeholder.
  for (const c of Array.from(host.children)) if (c !== empty) c.remove();
  const list = draftStore.list();
  if (!list.length) {
    empty.style.display = "";
    return;
  }
  empty.style.display = "none";
  for (const s of list) {
    const div = document.createElement("div");
    div.className = "draft";
    const date = new Date(s.updatedAt).toLocaleDateString();
    div.innerHTML =
      `<div class="meta"><div class="t"></div><div class="f">Local draft · ${date}</div></div>` +
      `<div class="actions">` +
      `<a href="studio.html" class="primary studio-link">Studio ✦</a>` +
      `<a href="editor.html" class="editor-link">Editor</a>` +
      `<a href="player.html?config=transfer" class="play-link">Play ▶</a>` +
      `</div>`;
    const t = div.querySelector(".t");
    if (t) t.textContent = s.title;
    // Studio link — resume the specific draft
    div.querySelector(".studio-link")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      setResume(s.showId);
      location.href = "studio.html";
    });
    // Editor link — transfer the config
    div.querySelector(".editor-link")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const cfg = draftStore.config(s.showId);
      if (cfg) setTransfer(cfg);
      window.open("editor.html#transfer", "_blank");
    });
    // Play link — transfer the config
    div.querySelector(".play-link")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const cfg = draftStore.config(s.showId);
      if (cfg) setTransfer(cfg);
      const hash = cfg?.startNode ? "#" + cfg.startNode : "";
      window.open("player.html?config=transfer" + hash, "_blank");
    });
    host.appendChild(div);
  }
}

// ── Export / import all local drafts as one event bundle ──────────────────
async function exportAllDrafts(): Promise<void> {
  if (!draftStore.list().length) {
    alert("No local drafts to export.");
    return;
  }
  const bundle = await draftStore.exportBundle();
  downloadText(`branching-video-events-${new Date().toISOString().slice(0, 10)}.json`, bundle);
}

interface ImportSummary {
  bundleEvents: number;
  legacyShows: number;
  configsAdded: number;
  configsUpdated: number;
  invalid: number;
}

function summarize(s: ImportSummary): string {
  const parts: string[] = [];
  if (s.bundleEvents) parts.push(`${String(s.bundleEvents)} event(s) merged`);
  if (s.legacyShows) parts.push(`${String(s.legacyShows)} legacy backup file(s) migrated`);
  if (s.configsAdded) parts.push(`${String(s.configsAdded)} config(s) added`);
  if (s.configsUpdated) parts.push(`${String(s.configsUpdated)} config(s) updated`);
  if (s.invalid) parts.push(`${String(s.invalid)} file(s) could not be read`);
  return parts.length ? `Import complete: ${parts.join(", ")}.` : "Nothing to import.";
}

// Each file is classified independently: an event bundle merges by union (ADR-0007), an old
// bvp-backup migrates onto its deterministic legacy show ids (ADR-0011), and a single-show config
// asks once per matching title — update that show, or add as a new one (ADR-0011). This is the
// feature the whole migration was for: Import All used to reject single-show config files
// outright, and Studio's own import silently overwrote a same-titled draft.
async function importAllDrafts(files: FileList): Promise<void> {
  const summary: ImportSummary = {
    bundleEvents: 0,
    legacyShows: 0,
    configsAdded: 0,
    configsUpdated: 0,
    invalid: 0,
  };
  let importedABundle = false;

  for (const file of Array.from(files)) {
    let raw: unknown;
    try {
      raw = JSON.parse(await readFileText(file));
    } catch {
      summary.invalid++;
      continue;
    }

    if (isEventBundle(raw)) {
      try {
        summary.bundleEvents += await draftStore.importBundle(raw);
        importedABundle = true;
      } catch {
        summary.invalid++;
      }
      continue;
    }

    const legacy = parseLegacyBackup(raw);
    if (legacy) {
      await draftStore.importLegacyBackup(legacy);
      summary.legacyShows++;
      continue;
    }

    const config = normalizeConfig(raw);
    if (config) {
      const existed = draftStore.matchingTitle(config.title).length > 0;
      const outcome = await adoptExternalConfig(draftStore, config);
      if (outcome.ok) {
        if (existed) summary.configsUpdated++;
        else summary.configsAdded++;
      } else {
        summary.invalid++;
      }
      continue;
    }

    summary.invalid++;
  }

  if (importedABundle) await notifyCollisions(draftStore);
  renderLocalDrafts();
  alert(summarize(summary));
}

byId("export-all-btn").addEventListener("click", (ev) => {
  ev.preventDefault();
  void exportAllDrafts();
});
byId("import-all-btn").addEventListener("click", (ev) => {
  ev.preventDefault();
  input("import-all-file").click();
});
input("import-all-file").addEventListener("change", (ev) => {
  const el = ev.target instanceof HTMLInputElement ? ev.target : null;
  const files = el?.files;
  if (files && files.length) void importAllDrafts(files);
  if (el) el.value = "";
});

async function boot(): Promise<void> {
  draftStore = await openDraftStore();
  await notifyCollisions(draftStore);
  renderLocalDrafts();
}

void boot();
