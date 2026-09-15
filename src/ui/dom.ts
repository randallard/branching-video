/** Typed DOM lookups. A missing element is a bug in the page's HTML, so it throws. */

export function byId<T extends HTMLElement = HTMLElement>(
  id: string,
  ctor: new () => T = HTMLElement as unknown as new () => T
): T {
  const e = document.getElementById(id);
  if (!(e instanceof ctor)) throw new Error(`#${id} is missing or not a ${ctor.name}`);
  return e;
}

export function input(id: string): HTMLInputElement {
  return byId(id, HTMLInputElement);
}

export function button(id: string): HTMLButtonElement {
  return byId(id, HTMLButtonElement);
}

/** The value of the form control an event fired on. */
export function valueOf(e: Event): string {
  const t = e.target;
  return t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement
    ? t.value
    : "";
}

export function checkedOf(e: Event): boolean {
  return e.target instanceof HTMLInputElement && e.target.checked;
}

type Child = Node | string | null | undefined | false;
type Props = Record<string, string | number | boolean | null | undefined | ((e: Event) => void)>;

/** `el('div', { class: 'x', text: 'hi', onclick: fn }, [children])`, as Editor used before. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props?: Props,
  children?: readonly Child[]
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k === "class") e.className = String(v);
    else if (k === "text") e.textContent = String(v);
    else if (typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (v != null && v !== false) e.setAttribute(k, String(v));
  }
  for (const c of children ?? []) {
    if (c === null || c === undefined || c === false) continue;
    e.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return e;
}
