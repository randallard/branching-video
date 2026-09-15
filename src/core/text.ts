/** Small pure helpers shared by Studio, Editor and the home page. */

/** Lowercase, runs of non-alphanumerics to "-", trimmed of "-". Falls back when nothing is
 * left (Studio falls back to "untitled", Editor node ids to "node"). */
export function slugify(s: string, fallback: string): string {
  return (
    (s || fallback)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || fallback
  );
}

/** `base`, or `base-2`, `base-3`, … — the first not in `taken`. */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const set = new Set(taken);
  let id = base;
  let i = 2;
  while (set.has(id)) {
    id = `${base}-${String(i)}`;
    i++;
  }
  return id;
}

/** `m:ss.s`, or an em dash when there is no time. */
export function fmtTime(s: number | undefined | null): string {
  if (s == null || Number.isNaN(s)) return "—";
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, "0");
  return `${String(m)}:${sec}`;
}

const BARE_ID = /^[A-Za-z0-9_-]{11}$/;

/** Accepts a YouTube URL (watch / youtu.be / embed / shorts / v / live), a bare 11-character
 * id, or free text containing one. Returns "" when none is found. */
export function extractVideoId(input: string): string {
  if (!input) return "";
  const s = input.trim();
  if (BARE_ID.test(s)) return s;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    // Not a URL — fall through to a loose match on free text.
    const m = /[A-Za-z0-9_-]{11}/.exec(s);
    return m ? m[0] : "";
  }
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] ?? "";
  if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
    const v = u.searchParams.get("v");
    if (v) return v;
    const parts = u.pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => ["embed", "shorts", "v", "live"].includes(p));
    const next = i >= 0 ? parts[i + 1] : undefined;
    if (next) return next;
  }
  return ""; // a valid URL, but not a recognizable YouTube video link
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
