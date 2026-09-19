// Editor: form-based editing of a whole show config, with live validation.
import { isRecord, normalizeConfig } from "../core/config.ts";
import type { Choice, EndLink, ShowConfig, ShowNode } from "../core/config.ts";
import { serialize as serializeConfig, toFileText } from "../core/serialize.ts";
import { extractVideoId, slugify, uniqueId } from "../core/text.ts";
import { validate } from "../core/validate.ts";
import type { ValidationResult } from "../core/validate.ts";
import { getTransfer, setTransfer } from "../shell/drafts.ts";
import { adoptExternalConfig, DraftSession } from "../shell/draft-session.ts";
import type { DraftStore } from "../shell/draft-store.ts";
import { openDraftStore } from "../shell/draft-store.ts";
import { errorMessage, readFileText } from "../shell/files.ts";
import { SHOWS_DIR, fetchShows, fetchVideoTitle } from "../shell/shows.ts";
import { notifyCollisions } from "../ui/collisions.ts";
import { button, byId, checkedOf, el, input, valueOf } from "../ui/dom.ts";

// ---- File System Access API (Chromium) — not in TypeScript's DOM lib ------------------------
interface FsaPickerOptions {
  suggestedName?: string;
  types: { description: string; accept: Record<string, string[]> }[];
}
interface FsaWindow {
  showSaveFilePicker?: (o: FsaPickerOptions) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (o: FsaPickerOptions) => Promise<FileSystemFileHandle[]>;
}
interface UaDataNavigator {
  userAgentData?: { brands?: { brand: string }[] };
}
const fsa = window as unknown as FsaWindow;
const JSON_PICKER_TYPES = [{ description: "JSON config", accept: { "application/json": [".json"] } }];

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

// ---- model ----------------------------------------------------------------------------------
let config: ShowConfig = blankConfig();
let selectedId: string | null = null;
let fileName = "config.json";
let fileHandle: FileSystemFileHandle | null = null; // when the browser supports FSA
let draftStore: DraftStore;
let session: DraftSession;

function blankConfig(): ShowConfig {
  return { title: "Untitled Show", startNode: "", choiceDisplaySeconds: 8, masterVideoId: "", nodes: [] };
}

/** A file without a nodes array still opens (as a config with no nodes), as it always has —
 * the Editor's established, permissive "load whatever JSON was given" behaviour. */
function normalizeLoose(obj: unknown): ShowConfig {
  const cfg =
    normalizeConfig(obj) ??
    normalizeConfig({ ...blankConfig(), ...(isRecord(obj) ? obj : {}), nodes: [] }) ??
    blankConfig();
  if (typeof cfg.choiceDisplaySeconds !== "number") cfg.choiceDisplaySeconds = 8;
  return cfg;
}

function nodeIds(): string[] {
  return config.nodes.map((n) => n.id);
}
function getNode(id: string | null): ShowNode | null {
  return config.nodes.find((n) => n.id === id) ?? null;
}

// Cascade an id rename through every reference so the graph stays intact.
function renameNode(oldId: string, newId: string): boolean {
  if (!newId || oldId === newId) return true;
  if (nodeIds().includes(newId)) {
    alert('Node id "' + newId + '" is already in use.');
    return false;
  }
  for (const n of config.nodes) {
    if (n.id === oldId) n.id = newId;
    for (const c of n.choices) if (c.target === oldId) c.target = newId;
    if (n.returnTo === oldId) n.returnTo = newId;
    for (const l of n.endScreen?.links ?? []) if (l.target === oldId) l.target = newId;
  }
  if (config.startNode === oldId) config.startNode = newId;
  if (selectedId === oldId) selectedId = newId;
  return true;
}

const serialize = (): ShowConfig => serializeConfig(config);

function field(labelText: string, control: HTMLElement, hint?: string): HTMLElement {
  return el("div", { class: "field" }, [
    el("label", { text: labelText }),
    control,
    hint ? el("div", { class: "hint", text: hint }) : null,
  ]);
}
function numOrUndefined(v: string): number | undefined {
  if (v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

// ---- render: lightweight (edit) vs structural, plus persisting the edit ----------------------
/** Every real edit ends here — autosaves into the draft store, draft-first like Studio. Load
 * paths (loadConfig/adoptConfig/openDraft) render without calling this: opening a page, or a
 * config already saved by import, must not itself spawn a new draft. */
async function persistNow(): Promise<void> {
  await session.persist(config);
}

function renderAll(): void {
  renderShowSettings();
  renderNodeList();
  renderForm();
  runValidation();
}

function onEdit(): void {
  renderNodeList();
  runValidation();
  void persistNow();
}
function structural(): void {
  renderAll();
  void persistNow();
}

// ---- show settings --------------------------------------------------------------------------
function renderShowSettings(): void {
  for (const hostId of ["showSettings", "mobileShowSettings"]) {
    const host = byId(hostId);
    host.innerHTML = "";

    const startSel = el(
      "select",
      {
        onchange: (e) => {
          config.startNode = valueOf(e);
          onEdit();
        },
      },
      [
        el("option", { value: "", text: "— none —" }),
        ...nodeIds().map((id) =>
          el("option", { value: id, text: id, selected: id === config.startNode ? "selected" : false })
        ),
      ]
    );

    host.appendChild(
      field(
        "Title",
        el("input", {
          type: "text",
          value: config.title || "",
          oninput: (e) => {
            config.title = valueOf(e);
            void persistNow();
          },
        })
      )
    );
    host.appendChild(field("Start node", startSel));
    host.appendChild(
      el("div", { class: "row" }, [
        field(
          "Choice countdown (s)",
          el("input", {
            type: "number",
            min: "0",
            value: config.choiceDisplaySeconds ?? "",
            oninput: (e) => {
              config.choiceDisplaySeconds = numOrUndefined(valueOf(e));
              runValidation();
              void persistNow();
            },
          })
        ),
      ])
    );
    host.appendChild(
      field(
        "Master video ID",
        el("input", {
          type: "text",
          value: config.masterVideoId || "",
          placeholder: "YouTube ID (optional)",
          oninput: (e) => {
            config.masterVideoId = valueOf(e);
            runValidation();
            void persistNow();
          },
        }),
        "Default for nodes without their own videoId."
      )
    );
  }
}

// ---- node list ------------------------------------------------------------------------------
function renderNodeList(): void {
  const errIds = currentErrorNodeIds();
  for (const hostId of ["nodeList", "mobileNodeList"]) {
    const host = byId(hostId);
    host.innerHTML = "";
    if (config.nodes.length === 0) {
      host.appendChild(el("div", { class: "mini", style: "padding:10px", text: "No nodes yet. Click + Add." }));
    }
    for (const n of config.nodes) {
      const badges = el("div", { class: "badges" }, [
        n.id === config.startNode ? el("span", { class: "badge start", text: "start" }) : null,
        n.isAside ? el("span", { class: "badge aside", text: "aside" }) : null,
        errIds.has(n.id) ? el("span", { class: "badge err", text: "!" }) : null,
      ]);
      host.appendChild(
        el(
          "div",
          {
            class: "node-item" + (n.id === selectedId ? " active" : ""),
            onclick: () => {
              selectedId = n.id;
              closeMobileDrawer();
              renderNodeList();
              renderForm();
            },
          },
          [
            el("div", { class: "nm" }, [
              el("div", { class: "id", text: n.id || "(no id)" }),
              el("div", { class: "ttl", text: n.title || "" }),
            ]),
            badges,
          ]
        )
      );
    }
  }
}

function currentErrorNodeIds(): Set<string> {
  // best-effort: pull node ids out of validator error strings of the form node "id"
  const ids = new Set<string>();
  for (const e of validate(serialize()).errors) {
    const m = /node "([^"]+)"/.exec(e);
    if (m?.[1]) ids.add(m[1]);
  }
  return ids;
}

// ---- node form ------------------------------------------------------------------------------
function addNode(): void {
  const n: ShowNode = { id: uniqueId("node", nodeIds()), title: "", choices: [] };
  config.nodes.push(n);
  session.nodeKeys.push(null);
  selectedId = n.id;
  if (!config.startNode) config.startNode = n.id;
  structural();
}

function deleteNode(id: string): void {
  const idx = config.nodes.findIndex((n) => n.id === id);
  if (idx < 0) return;
  if (!confirm('Delete node "' + id + '"? References to it will become broken targets.')) return;
  config.nodes.splice(idx, 1);
  session.nodeKeys.splice(idx, 1);
  const first = config.nodes[0];
  if (config.startNode === id) config.startNode = first ? first.id : "";
  if (selectedId === id) selectedId = first ? first.id : null;
  structural();
}

function targetSelect(value: string, onchange: (v: string) => void): HTMLSelectElement {
  const ids = nodeIds();
  const opts = [
    el("option", { value: "", text: "— select —" }),
    ...ids.map((id) => el("option", { value: id, text: id, selected: id === value ? "selected" : false })),
  ];
  // preserve a dangling reference so it's visible (and flagged by validation)
  if (value && !ids.includes(value)) {
    opts.push(el("option", { value, text: value + " (missing!)", selected: "selected" }));
  }
  return el(
    "select",
    {
      onchange: (e) => {
        onchange(valueOf(e));
      },
    },
    opts
  );
}

function numberInput(value: number | undefined, set: (v: number | undefined) => void): HTMLInputElement {
  return el("input", {
    type: "number",
    min: "0",
    value: value ?? "",
    oninput: (e) => {
      set(numOrUndefined(valueOf(e)));
      runValidation();
      void persistNow();
    },
  });
}

function renderForm(): void {
  const host = byId("editor");
  host.innerHTML = "";
  const n = getNode(selectedId);
  if (!n) {
    host.appendChild(el("div", { class: "empty", text: "Select a node from the menu, or click + Add to create one." }));
    return;
  }

  // --- basics card ---
  const basics = el("div", { class: "card" }, [el("h2", {}, ["Node"])]);
  basics.appendChild(
    el("div", { class: "row" }, [
      field(
        "Node id",
        el("input", {
          type: "text",
          value: n.id,
          onchange: (e) => {
            if (renameNode(n.id, slugify(valueOf(e), "node"))) structural();
            else renderForm();
          },
        }),
        "Used in the URL hash. Renaming updates all references."
      ),
      field(
        "Title",
        el("input", {
          type: "text",
          value: n.title || "",
          oninput: (e) => {
            n.title = valueOf(e);
            onEdit();
          },
        })
      ),
    ])
  );
  basics.appendChild(
    field(
      "Video ID",
      el("input", {
        type: "text",
        value: n.videoId || "",
        placeholder: config.masterVideoId ? "inherits master: " + config.masterVideoId : "YouTube video ID",
        oninput: (e) => {
          n.videoId = valueOf(e);
          runValidation();
          void persistNow();
        },
      }),
      "Overrides the master video for this node. Leave blank to use the master."
    )
  );
  basics.appendChild(
    el("div", { class: "row" }, [
      field("Start (s)", numberInput(n.start, (v) => (n.start = v))),
      field("End (s)", numberInput(n.end, (v) => (n.end = v))),
      field("Show choices at (s)", numberInput(n.showChoicesAt, (v) => (n.showChoicesAt = v))),
    ])
  );
  host.appendChild(basics);

  // --- aside / routing card ---
  const routing = el("div", { class: "card" }, [el("h2", {}, ["Aside & routing"])]);
  routing.appendChild(
    checkbox("Is aside (deep dive)", !!n.isAside, (v) => {
      n.isAside = v;
      structural();
    })
  );
  routing.appendChild(
    checkbox("Default aside — show persistent “Skip → back to main” button", !!n.defaultAside, (v) => {
      n.defaultAside = v;
      runValidation();
      void persistNow();
    })
  );
  routing.appendChild(
    checkbox("Return at current time — resume the branch point on exit", !!n.returnAtCurrentTime, (v) => {
      n.returnAtCurrentTime = v;
      runValidation();
      void persistNow();
    })
  );
  routing.appendChild(
    field(
      "Return to",
      targetSelect(n.returnTo || "", (v) => {
        n.returnTo = v || undefined;
        onEdit();
      }),
      "Auto-route here when this segment ends. Required for default asides / used as fallback for resume."
    )
  );
  host.appendChild(routing);

  // --- choices card ---
  const choicesCard = el("div", { class: "card" }, [
    el("h2", {}, ["Choices ", el("span", { class: "pill", text: "(" + String(n.choices.length) + ")" })]),
  ]);
  n.choices.forEach((c, idx) => choicesCard.appendChild(renderChoice(n, c, idx)));
  choicesCard.appendChild(
    el(
      "button",
      {
        class: "add-btn",
        onclick: () => {
          n.choices.push({ label: "", target: "" });
          renderForm();
          runValidation();
          void persistNow();
        },
      },
      ["+ Add choice"]
    )
  );
  host.appendChild(choicesCard);

  // --- end screen card ---
  const esCard = el("div", { class: "card" }, [el("h2", {}, ["End screen"])]);
  esCard.appendChild(
    checkbox("Has end screen (terminal node)", !!n.endScreen, (v) => {
      n.endScreen = v ? { heading: "", body: "", links: [] } : undefined;
      renderForm();
      runValidation();
      void persistNow();
    })
  );
  const es = n.endScreen;
  if (es) {
    esCard.appendChild(
      field(
        "Heading",
        el("input", {
          type: "text",
          value: es.heading || "",
          oninput: (e) => {
            es.heading = valueOf(e);
            void persistNow();
          },
        })
      )
    );
    esCard.appendChild(
      field(
        "Body",
        el(
          "textarea",
          {
            oninput: (e) => {
              es.body = valueOf(e);
              void persistNow();
            },
          },
          [es.body || ""]
        )
      )
    );
    es.links.forEach((l, idx) => esCard.appendChild(renderLink(es.links, l, idx)));
    esCard.appendChild(
      el(
        "button",
        {
          class: "add-btn",
          onclick: () => {
            es.links.push({ label: "" });
            renderForm();
            runValidation();
            void persistNow();
          },
        },
        ["+ Add link"]
      )
    );
  }
  host.appendChild(esCard);

  // --- danger ---
  host.appendChild(
    el("div", { style: "margin-top:8px;display:flex;gap:8px;" }, [
      el("button", { onclick: addNode }, ["+ Add next node"]),
      el(
        "button",
        {
          class: "danger",
          onclick: () => {
            deleteNode(n.id);
          },
        },
        ["Delete node"]
      ),
    ])
  );
}

function checkbox(labelText: string, checked: boolean, onchange: (v: boolean) => void): HTMLElement {
  const box = el("input", {
    type: "checkbox",
    onchange: (e) => {
      onchange(checkedOf(e));
    },
  });
  if (checked) box.checked = true;
  return el("label", { class: "check" }, [box, el("span", { text: labelText })]);
}

function renderChoice(n: ShowNode, c: Choice, idx: number): HTMLElement {
  const moveBtn = (dir: -1 | 1, label: string): HTMLButtonElement =>
    el(
      "button",
      {
        class: "icon",
        title: "Move " + label,
        onclick: () => {
          const arr = n.choices;
          const j = idx + dir;
          const a = arr[idx];
          const b = arr[j];
          if (!a || !b) return;
          arr[idx] = b;
          arr[j] = a;
          renderForm();
          runValidation();
          void persistNow();
        },
      },
      [dir < 0 ? "▲" : "▼"]
    );

  const defInput = el("input", {
    type: "checkbox",
    onchange: (e) => {
      if (checkedOf(e)) n.choices.forEach((other, k) => (other.default = k === idx));
      else c.default = false;
      renderForm();
      runValidation();
      void persistNow();
    },
  });
  if (c.default) defInput.checked = true;

  const styleSel = el(
    "select",
    {
      onchange: (e) => {
        c.style = valueOf(e) || undefined;
        void persistNow();
      },
    },
    [
      el("option", { value: "", text: "default style", selected: !c.style ? "selected" : false }),
      el("option", { value: "primary", text: "primary", selected: c.style === "primary" ? "selected" : false }),
      el("option", { value: "secondary", text: "secondary", selected: c.style === "secondary" ? "selected" : false }),
    ]
  );

  return el("div", { class: "choice" }, [
    el("div", { class: "choice-head" }, [
      el("span", { class: "grip", text: "#" + String(idx + 1) }),
      el("span", { class: "spacer" }),
      moveBtn(-1, "up"),
      moveBtn(1, "down"),
      el(
        "button",
        {
          class: "icon danger",
          title: "Remove choice",
          onclick: () => {
            n.choices.splice(idx, 1);
            renderForm();
            runValidation();
            void persistNow();
          },
        },
        ["✕"]
      ),
    ]),
    el("div", { class: "row" }, [
      field(
        "Label",
        el("input", {
          type: "text",
          value: c.label || "",
          oninput: (e) => {
            c.label = valueOf(e);
            runValidation();
            void persistNow();
          },
        })
      ),
      field(
        "Target",
        targetSelect(c.target || "", (v) => {
          c.target = v;
          onEdit();
        })
      ),
    ]),
    el("div", { class: "row" }, [
      el("div", { class: "field" }, [el("label", { text: "Style" }), styleSel]),
      el("div", { class: "field" }, [
        el("label", { text: "Default" }),
        el("label", { class: "check" }, [defInput, el("span", { class: "mini", text: "auto-advance after countdown" })]),
      ]),
    ]),
  ]);
}

function renderLink(links: EndLink[], l: EndLink, idx: number): HTMLElement {
  return el("div", { class: "link-row" }, [
    el("div", { class: "link-head" }, [
      el("span", { class: "mini", text: "Link #" + String(idx + 1) }),
      el("span", { class: "spacer" }),
      el(
        "button",
        {
          class: "icon danger",
          title: "Remove link",
          onclick: () => {
            links.splice(idx, 1);
            renderForm();
            runValidation();
            void persistNow();
          },
        },
        ["✕"]
      ),
    ]),
    field(
      "Label",
      el("input", {
        type: "text",
        value: l.label || "",
        oninput: (e) => {
          l.label = valueOf(e);
          void persistNow();
        },
      })
    ),
    el("div", { class: "row" }, [
      field(
        "Target node",
        targetSelect(l.target || "", (v) => {
          l.target = v || undefined;
          if (v) l.url = undefined;
          onEdit();
        }),
        "Internal jump"
      ),
      field(
        "External URL",
        el("input", {
          type: "text",
          value: l.url || "",
          placeholder: "https://…",
          oninput: (e) => {
            const v = valueOf(e);
            l.url = v || undefined;
            if (v) l.target = undefined;
            runValidation();
            void persistNow();
          },
        }),
        "Use instead of target"
      ),
    ]),
  ]);
}

// ---- validation panel -----------------------------------------------------------------------
function runValidation(): void {
  const host = byId("validation");
  host.innerHTML = "";
  let res: ValidationResult;
  try {
    res = validate(serialize());
  } catch (e) {
    res = { errors: ["Validator crashed: " + errorMessage(e)], warnings: [], nodeCount: 0, uniqueIds: 0 };
  }
  const plural = (n: number, word: string): string => `${String(n)} ${word}${n === 1 ? "" : "s"}`;

  host.appendChild(
    el("div", { class: "vhead" }, [
      res.errors.length
        ? el("span", { class: "status-err", text: plural(res.errors.length, "error") })
        : el("span", { class: "status-ok", text: "✓ Valid" }),
      el("span", { class: "mini", text: plural(res.warnings.length, "warning") }),
      el("span", { class: "mini", text: "· " + String(config.nodes.length) + " nodes" }),
    ])
  );
  for (const e of res.errors) host.appendChild(el("div", { class: "v-item err", text: e }));
  for (const w of res.warnings) host.appendChild(el("div", { class: "v-item warn", text: w }));
}

// ---- load / save ----------------------------------------------------------------------------
/** A config with no identity yet in the draft store: a blank/example starting point, not
 * something the person has told the app to adopt. Renders but does not persist — persisting here
 * would spawn a fresh draft on every visit to the page. The first real edit creates it, via
 * `structural()`/`onEdit()`'s own `persistNow()` and `session`'s create-on-first-persist. */
function loadConfig(obj: unknown, name?: string): void {
  config = normalizeLoose(obj);
  selectedId = config.nodes[0]?.id ?? null;
  fileHandle = null; // loaded by value; openFile() reattaches a handle if it has one
  session.reset();
  if (name) {
    fileName = name;
    setFilename(name);
  }
  renderAll();
  updateSaveLabel();
}

function setFilename(label: string): void {
  byId("filename").textContent = label || "";
}

// Every edit already autosaves into the browser draft store (see persistNow); Export/Export As…
// is the separate, explicit action that writes a real file — the one publishing to
// public/live/ still needs.
function updateSaveLabel(): void {
  const label = fileHandle || fileName !== "config.json" ? "Export" : "Export As…";
  button("saveBtn").textContent = label;
  button("mobileSaveBtn").textContent = label;
}

async function writeHandle(handle: FileSystemFileHandle, text: string): Promise<void> {
  const w = await handle.createWritable();
  await w.write(text);
  await w.close();
}

// Export — writes back to the open file handle if we have one, otherwise Export As.
async function save(): Promise<void> {
  if (fileHandle) {
    try {
      await writeHandle(fileHandle, toFileText(serialize()));
      setFilename(fileName + " · exported");
      flash("saveBtn", "Exported!");
      return;
    } catch (e) {
      if (isAbort(e)) return;
      // handle gone (e.g. file deleted) — fall through to saveAs
      fileHandle = null;
      updateSaveLabel();
    }
  }
  await saveAs();
}

// Export As… — name the file in-app (works identically in every browser), then save it. Where it
// lands is up to the browser's download setting: enable "ask where to save each file" to get a
// folder chooser; otherwise it goes to Downloads. (A native folder+name "Save As" dialog from a
// web page requires the File System Access API, which not every browser implements well.)
function fsaSaveWorks(): boolean {
  const uad = (navigator as UaDataNavigator).userAgentData;
  return !!(
    fsa.showSaveFilePicker &&
    uad &&
    (uad.brands ?? []).some((b) => /Chromium|Google Chrome|Microsoft Edge/i.test(b.brand))
  );
}

async function saveAs(): Promise<void> {
  const text = toFileText(serialize());
  const entered = prompt("Export as — file name:", fileName || "config.json");
  if (entered === null) return; // cancelled
  let name = entered.trim() || "config.json";
  if (!/\.json$/i.test(name)) name += ".json";

  // Use the File System Access API only on Chromium-based desktop browsers, where its save
  // picker is a genuine folder+name "Save As" dialog. Other engines expose an open-only picker
  // (or none), so they take the download path below. navigator.userAgentData is Chromium-only.
  if (fsaSaveWorks() && fsa.showSaveFilePicker) {
    try {
      const handle = await fsa.showSaveFilePicker({ suggestedName: name, types: JSON_PICKER_TYPES });
      await writeHandle(handle, text);
      fileHandle = handle;
      fileName = handle.name;
      setFilename(fileName + " · exported");
      updateSaveLabel();
      flash("saveBtn", "Exported!");
      return;
    } catch (e) {
      if (isAbort(e)) return; // user cancelled the picker
      // anything else (incl. browsers whose picker is unusable): fall through
    }
  }

  fileName = name;
  setFilename(name);
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = el("a", { href: url, download: name });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  updateSaveLabel();
  flash("saveBtn", "Exported ↓");
}

// Open… — prefer the FSA open picker (keeps a handle for save-back), else the classic hidden
// file input.
async function openFile(): Promise<void> {
  if (fsa.showOpenFilePicker) {
    try {
      const [handle] = await fsa.showOpenFilePicker({ types: JSON_PICKER_TYPES });
      if (!handle) return;
      const file = await handle.getFile();
      await adoptConfig(JSON.parse(await file.text()), file.name);
      fileHandle = handle;
      updateSaveLabel();
      return;
    } catch (e) {
      if (isAbort(e)) return;
      alert("Could not open file: " + errorMessage(e));
      return;
    }
  }
  input("fileInput").click();
}

// ---- adopt a config from outside (file open / #transfer / "Import config JSON…") ------------
// Goes through the store's update-or-add question (ADR-0011) instead of just loading it into
// memory, since the config is already persisted (importConfig) by the time this returns.
async function adoptConfig(raw: unknown, name?: string): Promise<void> {
  const cfg = normalizeLoose(raw);
  const outcome = await adoptExternalConfig(draftStore, cfg);
  if (!outcome.ok) {
    alert(outcome.reason);
    return;
  }
  session.attach(outcome.showId, outcome.nodeKeys);
  config = outcome.config;
  selectedId = config.nodes[0]?.id ?? null;
  fileHandle = null;
  if (name) {
    fileName = name;
    setFilename(name);
  }
  renderAll();
  updateSaveLabel();
}

// ---- My Drafts menu (drafts in the browser's event-log store) -------------------------------
function closeMyDraftsMenu(): void {
  byId("myDraftsMenu").hidden = true;
}

function openMyDraftsMenu(): void {
  const menu = byId("myDraftsMenu");
  menu.hidden = false;
  menu.innerHTML = "";
  menu.appendChild(
    el("div", { class: "dd-head" }, [el("span", { class: "mini", text: "Open a draft you've been editing" })])
  );
  const list = draftStore.list();
  if (!list.length) {
    menu.appendChild(el("div", { class: "dd-empty", text: "No drafts yet — start editing to create one." }));
    return;
  }
  for (const s of list) {
    menu.appendChild(
      el(
        "button",
        {
          class: "dd-item",
          title: "Open " + s.title,
          onclick: () => {
            openDraft(s.showId);
            closeMyDraftsMenu();
          },
        },
        [s.title || "(untitled)"]
      )
    );
  }
}

function openDraft(showId: string): void {
  const working = draftStore.open(showId);
  if (!working) return;
  session.attach(showId, working.nodeKeys);
  config = working.config;
  selectedId = config.nodes[0]?.id ?? null;
  fileHandle = null;
  fileName = slugify(config.title || "config", "untitled") + ".json";
  setFilename(config.title || "Untitled draft");
  renderAll();
  updateSaveLabel();
}

// ---- Configs menu (published shows, from live/manifest.json) --------------------------------
function closeConfigsMenu(): void {
  byId("configsMenu").hidden = true;
}

async function openConfigsMenu(): Promise<void> {
  const menu = byId("configsMenu");
  menu.hidden = false;
  menu.innerHTML = "";
  menu.appendChild(
    el("div", { class: "dd-head" }, [
      el("span", { class: "mini", text: "Play a config from /" + SHOWS_DIR }),
      el(
        "button",
        {
          class: "icon",
          title: "Refresh",
          onclick: (e) => {
            e.stopPropagation();
            void openConfigsMenu();
          },
        },
        ["⟳"]
      ),
    ])
  );
  let files: string[];
  try {
    files = (await fetchShows()).map((s) => s.file);
  } catch (e) {
    menu.appendChild(
      el("div", { class: "dd-empty" }, [
        "Could not read /" + SHOWS_DIR + " (" + errorMessage(e) + "). ",
        "Run the dev server (pnpm dev) and put .json show files in public/live/.",
      ])
    );
    return;
  }
  if (!files.length) {
    menu.appendChild(el("div", { class: "dd-empty", text: "No .json files in /" + SHOWS_DIR + " yet." }));
    return;
  }
  for (const name of files) {
    menu.appendChild(
      el(
        "button",
        {
          class: "dd-item",
          title: "Open " + name + " in the player",
          onclick: () => {
            window.open("player.html?config=" + encodeURIComponent(SHOWS_DIR + name), "_blank");
            closeConfigsMenu();
          },
        },
        ["▶  " + name]
      )
    );
  }
}

async function copyJson(): Promise<void> {
  const text = JSON.stringify(serialize(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    flash("copyBtn", "Copied!");
  } catch {
    window.prompt("Copy the JSON:", text);
  }
}

function flash(btnId: string, msg: string): void {
  const b = button(btnId);
  const old = b.textContent;
  b.textContent = msg;
  setTimeout(() => {
    b.textContent = old;
  }, 1200);
}

// ---- new config from a video URL ------------------------------------------------------------
async function newConfig(): Promise<void> {
  const entered = prompt("Paste a YouTube video URL or ID to start from\n(or leave blank for an empty config):", "");
  if (entered === null) return; // cancelled
  const fresh = blankConfig();
  const id = extractVideoId(entered);
  if (entered.trim() && !id) alert("Could not find a YouTube video ID in that input — starting empty.");
  if (id) {
    fresh.masterVideoId = id;
    fresh.startNode = "intro";
    fresh.nodes = [{ id: "intro", title: "Intro", start: 0, choices: [] }];
  }
  loadConfig(fresh, "config.json");
  // "New…" is a deliberate create action, like Studio's startBtn — persist right away rather than
  // waiting for a first edit, so the show is browsable from the home page immediately.
  void persistNow();
  if (id) {
    const title = await fetchVideoTitle(id);
    // Guard against the user having moved on (a different draft, another New…) while this awaited.
    if (title && config === fresh) {
      config.title = title;
      renderShowSettings();
      void persistNow();
    }
  }
}

// ---- mobile drawer --------------------------------------------------------------------------
function openMobileDrawer(): void {
  byId("mobile-drawer").classList.add("open");
}
function closeMobileDrawer(): void {
  byId("mobile-drawer").classList.remove("open");
}

// ---- wire up --------------------------------------------------------------------------------
const run = (f: () => Promise<void>) => () => {
  void f();
};
function openInPlayer(): void {
  const hash = selectedId ? "#" + selectedId : "";
  window.open("player.html" + hash, "_blank");
}

button("addNodeBtn").addEventListener("click", addNode);
button("saveBtn").addEventListener("click", run(save));
button("copyBtn").addEventListener("click", run(copyJson));
button("newBtn").addEventListener("click", run(newConfig));
button("loadBtn").addEventListener("click", run(openFile));
button("configsBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  if (byId("configsMenu").hidden) void openConfigsMenu();
  else closeConfigsMenu();
});
button("myDraftsBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  if (byId("myDraftsMenu").hidden) openMyDraftsMenu();
  else closeMyDraftsMenu();
});
document.addEventListener("click", (e) => {
  if (!(e.target instanceof Element && e.target.closest(".menu-wrap"))) {
    closeConfigsMenu();
    closeMyDraftsMenu();
  }
});

// mobile drawer
button("mobile-menu-btn").addEventListener("click", openMobileDrawer);
button("mobile-drawer-close").addEventListener("click", closeMobileDrawer);
button("mobileAddNodeBtn").addEventListener("click", () => {
  closeMobileDrawer();
  addNode();
});
button("mobileSaveBtn").addEventListener("click", run(save));
button("mobileLoadBtn").addEventListener("click", run(openFile));
button("mobileNewBtn").addEventListener("click", run(newConfig));
button("mobileMyDraftsBtn").addEventListener("click", () => {
  closeMobileDrawer();
  const list = draftStore.list();
  if (!list.length) {
    alert("No drafts yet — start editing to create one.");
    return;
  }
  const opts = list.map((s, i) => `${String(i + 1)}: ${s.title || "(untitled)"}`).join("\n");
  const ans = prompt("Choose a draft (enter number):\n" + opts);
  if (ans === null) return;
  const i = parseInt(ans, 10) - 1;
  const entry = list[i];
  if (Number.isNaN(i) || !entry) {
    alert("Invalid choice.");
    return;
  }
  openDraft(entry.showId);
});
button("mobilePlayerBtn").addEventListener("click", openInPlayer);
input("fileInput").addEventListener("change", () => {
  const fileEl = input("fileInput");
  const file = fileEl.files?.[0];
  if (!file) return;
  void readFileText(file).then(async (text) => {
    try {
      await adoptConfig(JSON.parse(text), file.name);
    } catch (err) {
      alert("Could not parse JSON: " + errorMessage(err));
    }
  });
  fileEl.value = "";
});
button("playerBtn").addEventListener("click", openInPlayer);
button("studioBtn").addEventListener("click", () => {
  if (!config.masterVideoId) {
    alert('Studio works from a single master video. Set "Master video ID" in show settings first.');
    return;
  }
  setTransfer(serialize());
  window.open("studio.html#transfer", "_blank");
});

// The store opens asynchronously (IndexedDB), so every action that touches it — including the
// very first config load, which renders through the same path as an edit — is disabled
// synchronously here, before the first `await`, so a click can't land while `draftStore`/`session`
// are still unset.
const bootGatedButtons = [
  "addNodeBtn",
  "mobileAddNodeBtn",
  "newBtn",
  "mobileNewBtn",
  "loadBtn",
  "mobileLoadBtn",
  "myDraftsBtn",
  "mobileMyDraftsBtn",
].map(button);
for (const b of bootGatedButtons) b.disabled = true;

// If opened via Studio "Open in Editor", consume the transfer key from localStorage; otherwise
// preload the config.json next to this page.
async function boot(): Promise<void> {
  draftStore = await openDraftStore();
  session = new DraftSession(draftStore);
  await notifyCollisions(draftStore);
  for (const b of bootGatedButtons) b.disabled = false;

  if (location.hash === "#transfer") {
    history.replaceState(null, "", location.pathname + location.search);
    const raw = getTransfer();
    if (raw !== null) {
      await adoptConfig(raw, "transfer.json");
      return;
    }
  }
  try {
    const r = await fetch("config.json");
    const obj: unknown = r.ok ? await r.json() : await Promise.reject(new Error(String(r.status)));
    loadConfig(obj, "config.json");
  } catch {
    loadConfig(blankConfig(), "config.json");
  }
}
void boot();
