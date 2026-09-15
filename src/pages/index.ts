// Home page: published shows from live/, local drafts, and Export All / Import All.
import { isRecord } from "../core/config.ts";
import {
  buildLegacyBackup,
  classifyImport,
  importedSlug,
  parseLegacyBackup,
} from "../core/legacy-backup.ts";
import type { Conflict, DraftEntry, LegacyBackup, Resolution } from "../core/legacy-backup.ts";
import {
  loadDraftConfig,
  loadDraftConfigText,
  loadDraftIndex,
  saveDraftConfig,
  saveDraftIndex,
  setResume,
  setTransferText,
} from "../shell/drafts.ts";
import type { ManifestEntry } from "../core/manifest.ts";
import { downloadText, readFileText } from "../shell/files.ts";
import { SHOWS_DIR, fetchShows } from "../shell/shows.ts";
import { byId, input } from "../ui/dom.ts";

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
  const idx = loadDraftIndex();
  if (!idx.length) {
    empty.style.display = "";
    return;
  }
  empty.style.display = "none";
  for (const e of [...idx].sort((a, b) => b.modified - a.modified)) {
    const div = document.createElement("div");
    div.className = "draft";
    const date = new Date(e.modified).toLocaleDateString();
    div.innerHTML =
      `<div class="meta"><div class="t"></div><div class="f">Local draft · ${date}</div></div>` +
      `<div class="actions">` +
      `<a href="studio.html" class="primary studio-link">Studio ✦</a>` +
      `<a href="editor.html" class="editor-link">Editor</a>` +
      `<a href="player.html?config=transfer" class="play-link">Play ▶</a>` +
      `</div>`;
    const t = div.querySelector(".t");
    if (t) t.textContent = e.title || e.slug;
    // Studio link — resume the specific draft
    div.querySelector(".studio-link")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      setResume(e.slug);
      location.href = "studio.html";
    });
    // Editor link — transfer the config
    div.querySelector(".editor-link")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const raw = loadDraftConfigText(e.slug);
      if (raw) setTransferText(raw);
      window.open("editor.html#transfer", "_blank");
    });
    // Play link — transfer the config
    div.querySelector(".play-link")?.addEventListener("click", (ev) => {
      ev.preventDefault();
      const raw = loadDraftConfigText(e.slug);
      if (raw) setTransferText(raw);
      const cfg = loadDraftConfig(e.slug);
      const hash =
        isRecord(cfg) && typeof cfg["startNode"] === "string" && cfg["startNode"]
          ? "#" + cfg["startNode"]
          : "";
      window.open("player.html?config=transfer" + hash, "_blank");
    });
    host.appendChild(div);
  }
}

renderLocalDrafts();

// ── Export / import all local drafts as one backup file ───────────────────
function exportAllDrafts(): void {
  const idx = loadDraftIndex();
  if (!idx.length) {
    alert("No local drafts to export.");
    return;
  }
  const configs: Record<string, unknown> = {};
  for (const e of idx) {
    const cfg = loadDraftConfig(e.slug);
    if (cfg !== null) configs[e.slug] = cfg;
  }
  const bundle = buildLegacyBackup(idx, configs, Date.now());
  downloadText(
    `branching-video-backup-${new Date().toISOString().slice(0, 10)}.json`,
    JSON.stringify(bundle, null, 2)
  );
}

interface Merge {
  bundle: LegacyBackup;
  fresh: DraftEntry[];
  identical: DraftEntry[];
  resolutions: { conflict: Conflict; action: Resolution }[];
}

// Applies a resolved merge: `fresh` entries are added outright, `identical` entries are left
// alone (already match), and each resolution (one per conflict) is applied per its chosen
// action: 'mine' (skip), 'theirs' (overwrite), or 'both' (add under a new slug). ADR-0002.
function applyMerge({ bundle, fresh, identical, resolutions }: Merge): void {
  const bySlug = new Map(loadDraftIndex().map((e) => [e.slug, e]));
  let added = 0;
  let updated = 0;
  let both = 0;

  for (const e of fresh) {
    bySlug.set(e.slug, e);
    saveDraftConfig(e.slug, bundle.configs[e.slug]);
    added++;
  }
  for (const r of resolutions) {
    const entry = r.conflict.entry;
    switch (r.action) {
      case "mine":
        break;
      case "theirs":
        bySlug.set(entry.slug, entry);
        saveDraftConfig(entry.slug, r.conflict.theirsConfig);
        updated++;
        break;
      case "both": {
        const newSlug = importedSlug(entry.slug, new Set(bySlug.keys()));
        bySlug.set(newSlug, {
          ...entry,
          slug: newSlug,
          title: (entry.title || entry.slug) + " (imported)",
        });
        saveDraftConfig(newSlug, r.conflict.theirsConfig);
        both++;
        break;
      }
    }
  }

  saveDraftIndex([...bySlug.values()]);
  renderLocalDrafts();
  const parts: string[] = [];
  if (added) parts.push(`${String(added)} new`);
  if (updated) parts.push(`${String(updated)} overwritten`);
  if (both) parts.push(`${String(both)} kept as separate copies`);
  if (identical.length) parts.push(`${String(identical.length)} already matched`);
  alert(parts.length ? `Merge complete: ${parts.join(", ")}.` : "Nothing to import.");
}

function openMergeModal(
  bundle: LegacyBackup,
  fresh: DraftEntry[],
  identical: DraftEntry[],
  conflicts: Conflict[]
): void {
  const overlay = document.createElement("div");
  overlay.className = "merge-overlay";
  const box = document.createElement("div");
  box.className = "merge-box";

  const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);
  const bits: string[] = [];
  if (fresh.length) {
    bits.push(`${String(fresh.length)} new ${plural(fresh.length, "draft", "drafts")} will be added`);
  }
  if (identical.length) bits.push(`${String(identical.length)} already match`);
  bits.push(
    `${String(conflicts.length)} ${plural(conflicts.length, "draft has", "drafts have")} edits on both sides`
  );

  box.innerHTML =
    "<h3>Merge backup</h3>" +
    `<p class="merge-summary">${bits.join(" · ")}. Choose what to do with each:</p>` +
    '<div class="merge-list"></div>' +
    '<div class="merge-actions">' +
    '<button type="button" class="btn" id="merge-cancel">Cancel</button>' +
    '<button type="button" class="btn primary" id="merge-apply">Apply merge</button>' +
    "</div>";

  const list = box.querySelector(".merge-list");
  const selects: HTMLSelectElement[] = [];
  for (const c of conflicts) {
    const row = document.createElement("div");
    row.className = "merge-row";
    const mineDate = new Date(c.mine.modified).toLocaleString();
    const theirsDate = new Date(c.entry.modified).toLocaleString();
    row.innerHTML =
      '<div class="merge-row-title"></div>' +
      `<div class="merge-row-sub">Mine: modified ${mineDate} · Backup: modified ${theirsDate}</div>` +
      "<select>" +
      '<option value="both" selected>Keep both (add backup copy alongside mine)</option>' +
      '<option value="mine">Keep mine (ignore backup version)</option>' +
      '<option value="theirs">Keep backup (overwrite mine)</option>' +
      "</select>";
    const title = row.querySelector(".merge-row-title");
    if (title) title.textContent = c.entry.title || c.entry.slug;
    const sel = row.querySelector("select");
    if (sel) selects.push(sel);
    list?.appendChild(row);
  }

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  function close(): void {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  }
  function onKey(ev: KeyboardEvent): void {
    if (ev.key === "Escape") close();
  }
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) close();
  });
  box.querySelector("#merge-cancel")?.addEventListener("click", close);
  box.querySelector("#merge-apply")?.addEventListener("click", () => {
    const resolutions = conflicts.map((conflict, i) => {
      const v = selects[i]?.value;
      const action: Resolution = v === "mine" || v === "theirs" ? v : "both";
      return { conflict, action };
    });
    close();
    applyMerge({ bundle, fresh, identical, resolutions });
  });
}

async function importAllDrafts(file: File): Promise<void> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFileText(file));
  } catch {
    alert("Invalid backup file.");
    return;
  }
  const bundle = parseLegacyBackup(raw);
  if (!bundle) {
    alert("This file does not look like a Branching Video backup.");
    return;
  }
  const { fresh, identical, conflicts } = classifyImport(bundle, loadDraftIndex(), loadDraftConfig);
  if (!conflicts.length) {
    applyMerge({ bundle, fresh, identical, resolutions: [] });
    return;
  }
  openMergeModal(bundle, fresh, identical, conflicts);
}

byId("export-all-btn").addEventListener("click", (ev) => {
  ev.preventDefault();
  exportAllDrafts();
});
byId("import-all-btn").addEventListener("click", (ev) => {
  ev.preventDefault();
  input("import-all-file").click();
});
input("import-all-file").addEventListener("change", (ev) => {
  const el = ev.target instanceof HTMLInputElement ? ev.target : null;
  const file = el?.files?.[0];
  if (file) void importAllDrafts(file);
  if (el) el.value = "";
});
