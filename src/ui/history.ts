/**
 * The per-field history affordance (ADR-0023): a "⟲ n" badge beside a field that has held other
 * values, opening an inline list of them, each with a "Use" button.
 *
 * Inline rather than a popover so it needs no positioning and behaves the same in the Editor's
 * mobile drawer. Choosing a value hands it to the page, which applies it as an ordinary edit —
 * so the value it displaces joins the same history.
 */
import type { EndScreen, Choice } from "../core/config.ts";
import type { FieldRef, HistoryEntry } from "../core/history.ts";
import type { DraftStore } from "../shell/draft-store.ts";
import { el } from "./dom.ts";

export interface HistoryBinding {
  /** Evaluated on every refresh, so a node that gains its key on first save gains its history.
   * `null` when the field has no identity in the log yet (an unsaved show or node). */
  ref: () => FieldRef | null;
  restore: (value: unknown) => void;
}

export interface MountedHistory {
  /** Goes beside the field's label. */
  badge: HTMLButtonElement;
  /** Goes under the field's control. */
  panel: HTMLElement;
}

interface Mount extends MountedHistory {
  binding: HistoryBinding;
}

const SOURCE_TEXT: Record<HistoryEntry["source"], string> = {
  edit: "edited",
  import: "imported",
  added: "set when the node was added",
};

function clip(text: string, max = 80): string {
  return text.length > max ? text.slice(0, max - 1) + "…" : text;
}

export function formatValue(field: FieldRef["field"], value: unknown): string {
  if (field === "choices" && Array.isArray(value)) {
    const choices = value as Choice[];
    const list = choices.map((c) => `${c.label || "(no label)"} → ${c.target || "?"}`).join("; ");
    return clip(`${String(choices.length)} choice${choices.length === 1 ? "" : "s"}: ${list}`);
  }
  if (field === "endScreen" && typeof value === "object" && value !== null) {
    const es = value as EndScreen;
    const links = `${String(es.links.length)} link${es.links.length === 1 ? "" : "s"}`;
    return clip(`${es.heading ? `"${es.heading}"` : "(no heading)"}, ${links}`);
  }
  if (value === true) return "on";
  if (typeof value === "string") return clip(`"${value}"`);
  if (typeof value === "number") return String(value);
  return clip(JSON.stringify(value));
}

export class FieldHistoryUi {
  private mounts: Mount[] = [];
  private readonly store: DraftStore;

  constructor(store: DraftStore) {
    this.store = store;
  }

  mount(binding: HistoryBinding): MountedHistory {
    const panel = el("div", { class: "hist-panel" });
    panel.hidden = true;
    const badge = el("button", {
      type: "button",
      class: "hist-badge",
      title: "Earlier values of this field",
      onclick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        panel.hidden = !panel.hidden;
        this.render(m);
      },
    });
    const m: Mount = { binding, badge, panel };
    this.mounts.push(m);
    this.render(m);
    return { badge, panel };
  }

  /** Re-read every mounted field's history — call after each save lands. */
  refresh(): void {
    this.mounts = this.mounts.filter((m) => m.badge.isConnected);
    for (const m of this.mounts) this.render(m);
  }

  private render(m: Mount): void {
    const ref = m.binding.ref();
    const prior = ref === null ? [] : this.store.priorValues(ref);
    m.badge.hidden = prior.length === 0;
    m.badge.textContent = `⟲ ${String(prior.length)}`;
    if (prior.length === 0) m.panel.hidden = true;
    if (m.panel.hidden || ref === null) return;

    m.panel.replaceChildren(
      el("div", { class: "hist-head", text: "Earlier values — Use makes one current again" }),
      ...prior.map((entry) =>
        el("div", { class: "hist-row" }, [
          el("div", { class: "hist-value", text: formatValue(ref.field, entry.value) }),
          el("div", {
            class: "hist-meta",
            text: `${SOURCE_TEXT[entry.source]} ${new Date(entry.at).toLocaleString()}`,
          }),
          el(
            "button",
            {
              type: "button",
              class: "hist-use",
              onclick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                m.panel.hidden = true;
                m.binding.restore(entry.value);
              },
            },
            ["Use"]
          ),
        ])
      )
    );
  }
}
