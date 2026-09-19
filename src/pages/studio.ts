// Studio: mark node timestamps against one master video while watching it.
import { isLegacyBackup, normalizeConfig } from "../core/config.ts";
import type { Choice, ShowConfig, ShowNode } from "../core/config.ts";
import { serialize, toFileText } from "../core/serialize.ts";
import { escapeHtml, extractVideoId, fmtTime, slugify, uniqueId } from "../core/text.ts";
import { getTransfer, setTransfer, takeResume } from "../shell/drafts.ts";
import { adoptExternalConfig, DraftSession } from "../shell/draft-session.ts";
import type { DraftStore } from "../shell/draft-store.ts";
import { openDraftStore } from "../shell/draft-store.ts";
import { downloadText, errorMessage, readFileText } from "../shell/files.ts";
import { notifyCollisions } from "../ui/collisions.ts";
import { fetchVideoTitle } from "../shell/shows.ts";
import { YT_STATE, loadYouTubeApi } from "../shell/youtube.ts";
import type { YTPlayer } from "../shell/youtube.ts";
import { button, byId, input, valueOf, checkedOf } from "../ui/dom.ts";
import { FieldHistoryUi } from "../ui/history.ts";
import type { MountedHistory } from "../ui/history.ts";
import type { FieldRef } from "../core/history.ts";
import type { HistoryField } from "../core/reduce.ts";

// ── State ────────────────────────────────────────────────────────────────────
let config: ShowConfig | null = null; // the working config object
let selectedId: string | null = null;
let ytPlayer: YTPlayer | null = null;
let ytReady = false;
let tcInterval: ReturnType<typeof setInterval> | null = null;
let draftStore: DraftStore;
let session: DraftSession;
let histories: FieldHistoryUi;

// ── Setup screen ─────────────────────────────────────────────────────────────
const $setup = byId("setup");
const $workspace = byId("workspace");
const $setupErr = byId("setup-err");
const headerButtons = ["saveBtn", "editBtn", "playBtn", "exportBtn"].map(button);

button("startBtn").addEventListener("click", () => {
  const id = extractVideoId(input("videoInput").value);
  if (!id) {
    showSetupError("Could not find a YouTube video ID in that input.");
    return;
  }
  $setupErr.style.display = "none";
  const title = input("titleInput").value.trim();
  const countdown = parseInt(input("countdownInput").value, 10) || 8;
  const fresh: ShowConfig = {
    title: title || "Untitled Show",
    masterVideoId: id,
    startNode: "",
    choiceDisplaySeconds: countdown,
    nodes: [],
  };
  session.reset();
  config = fresh;
  // async title fetch — update if field was blank
  if (!title) {
    void fetchVideoTitle(id).then((t) => {
      if (t && config === fresh) {
        fresh.title = t;
        void autoSave();
        setStatusLabel();
      }
    });
  }
  enterWorkspace();
});

// Take an existing config object (import / transfer / "Import config JSON…") into the workspace.
// Goes through the same update-or-add path as the home page's Import All (ADR-0011) instead of
// autosaving straight over a same-titled draft.
async function adoptConfig(raw: unknown): Promise<boolean> {
  if (isLegacyBackup(raw)) {
    showSetupError(
      'That is a full backup file — import it from the home page ("Import All"), then use Resume draft… here.'
    );
    return false;
  }
  const cfg = normalizeConfig(raw);
  if (!cfg) {
    showSetupError("That does not look like a show config (no nodes array).");
    return false;
  }
  if (!cfg.masterVideoId) {
    showSetupError(
      "Studio needs a config with a masterVideoId (one master video). Use the editor for configs with per-node videos."
    );
    return false;
  }
  const outcome = await adoptExternalConfig(draftStore, cfg);
  if (!outcome.ok) {
    showSetupError(outcome.reason);
    return false;
  }
  $setupErr.style.display = "none";
  session.attach(outcome.showId, outcome.nodeKeys);
  config = outcome.config;
  enterWorkspace();
  return true;
}

function showSetupError(msg: string): void {
  $setupErr.textContent = msg;
  $setupErr.style.display = "block";
}

button("importBtn").addEventListener("click", () => {
  input("importFile").click();
});
input("importFile").addEventListener("change", () => {
  const el = input("importFile");
  const file = el.files?.[0];
  if (!file) return;
  void readFileText(file).then(async (text) => {
    try {
      await adoptConfig(JSON.parse(text));
    } catch (err) {
      showSetupError("Could not parse JSON: " + errorMessage(err));
    }
  });
  el.value = "";
});

button("newBtn").addEventListener("click", () => {
  if (config && !confirm("Start a new show? Unsaved changes will be lost.")) return;
  resetToSetup();
});

button("resumeBtn").addEventListener("click", () => {
  const list = draftStore.list();
  if (!list.length) {
    alert("No saved drafts found.");
    return;
  }
  const opts = list
    .map((s, i) => `${String(i + 1)}: ${s.title} (${new Date(s.updatedAt).toLocaleDateString()})`)
    .join("\n");
  const ans = prompt("Choose a draft (enter number):\n" + opts);
  if (ans === null) return;
  const i = parseInt(ans, 10) - 1;
  const entry = list[i];
  if (Number.isNaN(i) || !entry) {
    alert("Invalid choice.");
    return;
  }
  const working = draftStore.open(entry.showId);
  if (!working) {
    alert("Could not load draft.");
    return;
  }
  session.attach(entry.showId, working.nodeKeys);
  config = working.config;
  enterWorkspace();
});

function resetToSetup(): void {
  session.reset();
  config = null;
  selectedId = null;
  stopTcInterval();
  $workspace.classList.remove("visible");
  $setup.style.display = "";
  input("videoInput").value = "";
  input("titleInput").value = "";
  for (const b of headerButtons) b.disabled = true;
}

// ── Workspace ─────────────────────────────────────────────────────────────────
function enterWorkspace(): void {
  $setup.style.display = "none";
  $workspace.classList.add("visible");
  for (const b of headerButtons) b.disabled = false;
  void autoSave();
  loadYouTubeApi(onYTReady);
  renderTable();
  renderSidebar();
}

async function autoSave(): Promise<void> {
  if (!config) return;
  await session.persist(config);
  setStatusLabel("Saved");
}

function setStatusLabel(msg?: string): void {
  byId("status-label").textContent = msg || (config ? config.title || "Untitled" : "");
}

// ── YouTube ───────────────────────────────────────────────────────────────────
function onYTReady(yt: NonNullable<Window["YT"]>): void {
  const videoId = config?.masterVideoId;
  if (!videoId) return;
  if (ytPlayer) {
    ytPlayer.loadVideoById?.({ videoId });
    ytPlayer.pauseVideo?.();
    return;
  }
  ytPlayer = new yt.Player("yt-player", {
    width: "100%",
    height: "100%",
    videoId,
    playerVars: { autoplay: 0, controls: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, enablejsapi: 1 },
    events: {
      onReady: () => {
        ytReady = true;
        startTcInterval();
      },
      onStateChange: (e) => {
        button("playPauseBtn").textContent = e.data === YT_STATE.PLAYING ? "⏸" : "▶";
      },
    },
  });
}

function currentTime(): number {
  if (!ytReady || !ytPlayer?.getCurrentTime) return 0;
  return ytPlayer.getCurrentTime();
}

function startTcInterval(): void {
  if (tcInterval) return;
  tcInterval = setInterval(() => {
    byId("timecode").textContent = fmtTime(currentTime());
  }, 100);
}
function stopTcInterval(): void {
  if (tcInterval) clearInterval(tcInterval);
  tcInterval = null;
}

// ── Transport controls ────────────────────────────────────────────────────────
button("playPauseBtn").addEventListener("click", togglePlay);
button("back5").addEventListener("click", () => {
  seek(-5);
});
button("back1").addEventListener("click", () => {
  seek(-1);
});
button("fwd1").addEventListener("click", () => {
  seek(1);
});
button("fwd5").addEventListener("click", () => {
  seek(5);
});
document.addEventListener("keydown", (e) => {
  if (!$workspace.classList.contains("visible")) return;
  const t = e.target;
  if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
  if (e.code === "Space") {
    e.preventDefault();
    togglePlay();
  }
  if (e.code === "ArrowLeft" && e.shiftKey) seek(-5);
  else if (e.code === "ArrowLeft") seek(-1);
  if (e.code === "ArrowRight" && e.shiftKey) seek(5);
  else if (e.code === "ArrowRight") seek(1);
});

function togglePlay(): void {
  if (!ytReady || !ytPlayer) return;
  if (ytPlayer.getPlayerState?.() === YT_STATE.PLAYING) ytPlayer.pauseVideo?.();
  else ytPlayer.playVideo?.();
}
function seek(delta: number): void {
  if (!ytReady) return;
  ytPlayer?.seekTo?.(Math.max(0, currentTime() + delta), true);
}

// ── Mark node start ───────────────────────────────────────────────────────────
button("markStartBtn").addEventListener("click", markStart);
button("setEndBtn").addEventListener("click", setEndNow);

function selectedNode(): ShowNode | undefined {
  return config?.nodes.find((n) => n.id === selectedId);
}

function markStart(): void {
  if (!config) return;
  const t = parseFloat(currentTime().toFixed(1));
  const ids = config.nodes.map((n) => n.id);

  // auto-close previous node's end if open
  const last = config.nodes[config.nodes.length - 1];
  if (last && last.end == null) last.end = t;

  const rawTitle = prompt("Node title (leave blank to use a generated id):", "");
  if (rawTitle === null) return; // cancelled
  const id = uniqueId(slugify(rawTitle || "node", "untitled"), ids);
  config.nodes.push({ id, title: rawTitle || id, start: t, choices: [] });
  session.nodeKeys.push(null);
  if (!config.startNode) config.startNode = id;
  selectedId = id;
  void autoSave();
  renderTable();
  renderSidebar();
  button("setEndBtn").disabled = false;
}

function setEndNow(): void {
  const node = selectedNode();
  if (!node) return;
  node.end = parseFloat(currentTime().toFixed(1));
  void autoSave();
  renderTable();
  renderSidebar();
}

// ── Node table ────────────────────────────────────────────────────────────────
function renderTable(): void {
  if (!config) return;
  const cfg = config;
  const tbody = byId("nodeTableBody");
  tbody.innerHTML = "";
  for (const n of cfg.nodes) {
    const unresolved = n.choices.filter((c) => c.target && !cfg.nodes.some((x) => x.id === c.target)).length;
    const tr = document.createElement("tr");
    if (n.id === selectedId) tr.classList.add("selected");
    const choicesCell = n.choices.length
      ? String(n.choices.length) +
        (unresolved ? ` <span class="unresolved" title="${String(unresolved)} unresolved">⚠</span>` : "")
      : '<span style="color:var(--muted)">—</span>';
    tr.innerHTML =
      `<td class="td-id">${escapeHtml(n.id)}</td>` +
      `<td>${escapeHtml(n.title || "")}</td>` +
      `<td class="td-time">${fmtTime(n.start)}</td>` +
      `<td class="td-time">${fmtTime(n.end)}</td>` +
      `<td class="td-choices">${choicesCell}</td>` +
      `<td><button class="icon" data-seek="${String(n.start)}">⏩</button></td>`;
    tr.addEventListener("click", (e) => {
      const seekEl = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-seek]") : null;
      if (seekEl) {
        const t = parseFloat(seekEl.dataset["seek"] ?? "");
        if (ytReady && !Number.isNaN(t)) ytPlayer?.seekTo?.(t, true);
        return;
      }
      selectedId = n.id;
      button("setEndBtn").disabled = false;
      renderTable();
      renderSidebar();
    });
    tbody.appendChild(tr);
  }
}

// ── Sidebar (node form) ───────────────────────────────────────────────────────
function renderSidebar(): void {
  if (!config) return;
  const cfg = config;
  const node = selectedNode();
  const $empty = byId("sidebar-empty");
  const $body = byId("sidebar-body");
  const $dz = byId("danger-zone");
  const $title = byId("sidebar-title");

  // clear dynamic children except empty placeholder
  for (const c of Array.from($body.children)) if (c !== $empty) c.remove();
  if (!node) {
    $empty.style.display = "";
    $dz.style.display = "none";
    $title.textContent = "Node details";
    return;
  }
  $empty.style.display = "none";
  $dz.style.display = "";
  $title.textContent = node.id;

  // ID
  $body.appendChild(
    mkField(
      "Node ID",
      mkInput("text", node.id, (v) => {
        if (!renameNode(cfg, node, v)) return;
        void autoSave();
        renderTable();
        renderSidebar();
      }),
      "Rename updates all references.",
      nodeHist(node, "id")
    )
  );

  // Title
  $body.appendChild(
    mkField(
      "Title",
      mkInput("text", node.title || "", (v) => {
        node.title = v;
        void autoSave();
        renderTable();
      }),
      undefined,
      nodeHist(node, "title")
    )
  );

  // Start / End row
  const row = document.createElement("div");
  row.className = "row2";
  row.appendChild(
    mkField(
      "Start (s)",
      mkInput("number", node.start ?? "", (v) => {
        node.start = v === "" ? undefined : parseFloat(v);
        void autoSave();
        renderTable();
      }),
      undefined,
      nodeHist(node, "start")
    )
  );
  row.appendChild(
    mkField(
      "End (s)",
      mkInput("number", node.end ?? "", (v) => {
        node.end = v === "" ? undefined : parseFloat(v);
        void autoSave();
        renderTable();
      }),
      undefined,
      nodeHist(node, "end")
    )
  );
  $body.appendChild(row);

  // Return to
  $body.appendChild(
    mkField(
      "Return to",
      mkSelect(
        [["", "— none —"], ...cfg.nodes.filter((x) => x.id !== node.id).map((x): [string, string] => [x.id, x.id])],
        node.returnTo || "",
        (v) => {
          node.returnTo = v || undefined;
          void autoSave();
        }
      ),
      "Auto-route here when segment ends.",
      nodeHist(node, "returnTo")
    )
  );

  // Choices heading
  const choicesHist = nodeHist(node, "choices");
  const ch = document.createElement("div");
  ch.style.cssText = "font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.6px;margin-top:4px;";
  ch.append("Choices", choicesHist.badge);
  $body.appendChild(ch);
  $body.appendChild(choicesHist.panel);

  node.choices.forEach((c, idx) => $body.appendChild(mkChoiceItem(cfg, node, c, idx)));

  const addChoiceBtn = document.createElement("button");
  addChoiceBtn.className = "add-btn";
  addChoiceBtn.textContent = "+ Add choice";
  addChoiceBtn.addEventListener("click", () => {
    node.choices.push({ label: "", target: "", default: false });
    void autoSave();
    renderSidebar();
  });
  $body.appendChild(addChoiceBtn);
}

function mkChoiceItem(cfg: ShowConfig, node: ShowNode, c: Choice, idx: number): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "choice-item";

  const headRow = document.createElement("div");
  headRow.style.cssText = "display:flex;justify-content:space-between;align-items:center;";
  const lbl = document.createElement("span");
  lbl.style.cssText = "font-size:11px;color:var(--muted);";
  lbl.textContent = "Choice " + String(idx + 1);
  const del = document.createElement("button");
  del.className = "icon danger";
  del.textContent = "✕";
  del.addEventListener("click", () => {
    node.choices.splice(idx, 1);
    void autoSave();
    renderTable();
    renderSidebar();
  });
  headRow.appendChild(lbl);
  headRow.appendChild(del);
  wrap.appendChild(headRow);

  const cr = document.createElement("div");
  cr.className = "choice-row";
  cr.appendChild(
    mkField(
      "Label",
      mkInput("text", c.label || "", (v) => {
        c.label = v;
        void autoSave();
      })
    )
  );

  // target with unresolved warning
  const targetIds = cfg.nodes.filter((x) => x.id !== node.id).map((x): [string, string] => [x.id, x.id]);
  const targetSel = mkSelect([["", "— select —"], ...targetIds], c.target || "", (v) => {
    c.target = v;
    void autoSave();
    renderTable();
    renderSidebar();
  });
  const tf = mkField("Target", targetSel);
  if (c.target && !cfg.nodes.some((x) => x.id === c.target)) {
    const w = document.createElement("span");
    w.className = "badge badge-warn";
    w.textContent = "Missing";
    tf.appendChild(w);
  }
  cr.appendChild(tf);
  wrap.appendChild(cr);

  const defRow = document.createElement("div");
  defRow.style.cssText = "display:flex;gap:16px;align-items:center;";
  const defCheck = document.createElement("label");
  defCheck.className = "check";
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = !!c.default;
  cb.addEventListener("change", (e) => {
    if (checkedOf(e)) node.choices.forEach((x, k) => (x.default = k === idx));
    else c.default = false;
    void autoSave();
    renderSidebar();
  });
  defCheck.appendChild(cb);
  const defText = document.createElement("span");
  defText.textContent = "Default (auto-advance)";
  defCheck.appendChild(defText);
  defRow.appendChild(defCheck);

  const styleSel = mkSelect(
    [
      ["", "default"],
      ["primary", "primary"],
      ["secondary", "secondary"],
    ],
    c.style || "",
    (v) => {
      c.style = v || undefined;
      void autoSave();
    }
  );
  defRow.appendChild(mkField("Style", styleSel));
  wrap.appendChild(defRow);

  return wrap;
}

function mkField(labelText: string, control: HTMLElement, hint?: string, history?: MountedHistory): HTMLElement {
  const f = document.createElement("div");
  f.className = "field";
  const l = document.createElement("label");
  l.textContent = labelText;
  if (history) l.appendChild(history.badge);
  f.appendChild(l);
  f.appendChild(control);
  if (hint) {
    const h = document.createElement("div");
    h.className = "hint";
    h.textContent = hint;
    f.appendChild(h);
  }
  if (history) f.appendChild(history.panel);
  return f;
}

/** Rename a node and every reference to it. False when the new id is blank, unchanged or taken. */
function renameNode(cfg: ShowConfig, node: ShowNode, v: string): boolean {
  if (!v || v === node.id) return false;
  if (cfg.nodes.some((x) => x.id === v)) {
    alert("ID already in use.");
    return false;
  }
  for (const x of cfg.nodes) {
    for (const c of x.choices) if (c.target === node.id) c.target = v;
    if (x.returnTo === node.id) x.returnTo = v;
  }
  if (cfg.startNode === node.id) cfg.startNode = v;
  node.id = v;
  selectedId = v;
  return true;
}

// ── Per-field history (ADR-0023) ──────────────────────────────────────────────
function nodeHist(node: ShowNode, field: HistoryField): MountedHistory {
  const ref = (): FieldRef | null => {
    const nodeKey = config ? session.nodeKeys[config.nodes.indexOf(node)] : undefined;
    return session.showId === null || !nodeKey ? null : { showId: session.showId, nodeKey, field };
  };
  return histories.mount({
    ref,
    restore: (value) => {
      restoreNodeField(node, field, value);
    },
  });
}

/** A recovered value is applied like any other edit, so it goes through the same autosave. */
function restoreNodeField(node: ShowNode, field: HistoryField, value: unknown): void {
  if (!config) return;
  switch (field) {
    case "id":
      if (typeof value !== "string" || !renameNode(config, node, value)) return;
      break;
    case "title":
    case "returnTo":
      if (typeof value === "string") node[field] = value;
      break;
    case "start":
    case "end":
      if (typeof value === "number") node[field] = value;
      break;
    case "choices":
      node.choices = JSON.parse(JSON.stringify(value)) as Choice[];
      break;
    // Studio doesn't edit these, so it never mounts a history for them.
    case "videoId":
    case "showChoicesAt":
    case "isAside":
    case "defaultAside":
    case "returnAtCurrentTime":
    case "endScreen":
    case "startNode":
    case "masterVideoId":
    case "choiceDisplaySeconds":
      return;
  }
  void autoSave();
  renderTable();
  renderSidebar();
}

function mkInput(type: string, value: string | number, onchange: (v: string) => void): HTMLInputElement {
  const i = document.createElement("input");
  i.type = type;
  i.value = String(value);
  i.addEventListener("change", (e) => {
    onchange(valueOf(e));
  });
  return i;
}

function mkSelect(options: [string, string][], value: string, onchange: (v: string) => void): HTMLSelectElement {
  const s = document.createElement("select");
  for (const [v, t] of options) {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    if (v === value) o.selected = true;
    s.appendChild(o);
  }
  s.addEventListener("change", (e) => {
    onchange(valueOf(e));
  });
  return s;
}

// ── Header actions ────────────────────────────────────────────────────────────
button("saveBtn").addEventListener("click", () => {
  void autoSave().then(() => {
    alert("Saved to browser storage.");
  });
});

button("editBtn").addEventListener("click", () => {
  if (!config) return;
  setTransfer(serialize(config));
  window.open("editor.html#transfer", "_blank");
});

button("playBtn").addEventListener("click", () => {
  if (!config) return;
  setTransfer(serialize(config));
  const hash = config.startNode ? "#" + config.startNode : "";
  window.open("player.html?config=transfer" + hash, "_blank");
});

button("exportBtn").addEventListener("click", () => {
  if (!config) return;
  downloadText(slugify(config.title || "config", "untitled") + ".json", toFileText(serialize(config)));
});

button("deleteNodeBtn").addEventListener("click", () => {
  if (!config) return;
  const node = selectedNode();
  if (!node) return;
  if (!confirm('Delete node "' + node.id + '"?')) return;
  const idx = config.nodes.findIndex((n) => n.id === selectedId);
  config.nodes = config.nodes.filter((n) => n.id !== selectedId);
  if (idx >= 0) session.nodeKeys.splice(idx, 1);
  if (config.startNode === selectedId) config.startNode = config.nodes[0]?.id || "";
  selectedId = config.nodes[0]?.id || null;
  void autoSave();
  renderTable();
  renderSidebar();
});

// ── Boot: check for a previous session ───────────────────────────────────────
// The store opens asynchronously (IndexedDB), so the setup screen's buttons — enabled by default
// in the HTML — are disabled synchronously here, before the first `await`, so a click can't land
// while `draftStore`/`session` are still unset.
const setupButtons = ["newBtn", "resumeBtn", "startBtn", "importBtn"].map(button);
for (const b of setupButtons) b.disabled = true;

async function boot(): Promise<void> {
  draftStore = await openDraftStore();
  session = new DraftSession(draftStore);
  histories = new FieldHistoryUi(draftStore);
  session.onSaved = () => {
    histories.refresh();
  };
  await notifyCollisions(draftStore);

  for (const b of setupButtons) b.disabled = false;
  if (!draftStore.list().length) button("resumeBtn").disabled = true;

  // If another page handed us a config (e.g. editor "Open in Studio"), consume the transfer
  // key from localStorage — same convention as the editor.
  if (location.hash === "#transfer") {
    history.replaceState(null, "", location.pathname + location.search);
    const raw = getTransfer();
    if (raw !== null && (await adoptConfig(raw))) return;
  }

  // If the home page sent us a specific draft to resume, load it immediately.
  const resumeId = takeResume();
  if (resumeId) {
    const working = draftStore.open(resumeId);
    if (working) {
      session.attach(resumeId, working.nodeKeys);
      config = working.config;
      enterWorkspace();
    }
  }
}

void boot();
