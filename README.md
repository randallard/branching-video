# Branching Video Player

A lightweight, self-hosted interactive video player that supports non-linear storytelling — deep dives, asides, and viewer-controlled paths — built on YouTube's free infrastructure.

No monthly platform fees. No vendor lock-in. Just a JSON config, a single HTML file, and free static hosting.

---

## How it works

Each video segment is a **node**. Nodes connect to other nodes via **choices** (buttons the viewer clicks) or **defaults** (automatic progression). The structure lives in `config.json`. The player reads it, embeds the right YouTube video, shows choices at the right moment, and routes accordingly.

Deep links work out of the box — every node has its own URL (`/player.html#node-id`), so a YouTube card, TikTok description, or any external link can drop a viewer directly into any point in the story.

---

## The two aside patterns

This player is built around two specific branching patterns:

**Pattern A — Optional aside (viewer chooses to dive in)**
```
Main line: [...topic A...] → choice appears
  • "Tell me more about X"  → aside node → auto-returns to main line resume point
  • "Keep going" (default)  → next main line node (auto-advances if viewer ignores choice)
```

**Pattern B — Default aside (everyone sees it, but can skip)**
```
Main line: [...topic A...] → aside plays automatically
  • "Skip this / back to main" button visible throughout aside
  → aside ends → continues to next main line node
```

Both patterns are declared in `config.json`. The player handles the routing.

---

## Repository structure

```
/
├── index.html              # Landing page — lists the shows in live/ (GitHub Pages entry point)
├── create.html             # "Make your own" — fork + build instructions
├── player.html             # The entire player (HTML, CSS, JS inline — no build step)
├── editor.html             # Visual config editor — edit nodes/choices via forms, no hand-written JSON
├── config.json             # Default config the player loads when no ?config= is given
├── config.example.json     # Reference config — copy and edit
├── live/                   # Your show configs; index.html + the editor's Configs menu list this folder
│   └── manifest.json       # Generated list of shows (so the landing page works on GitHub Pages)
├── tools/
│   ├── validate-core.js    # Shared validation rules (used by both the CLI and the editor)
│   ├── validate-config.js  # `node tools/validate-config.js <file>` — catches broken graphs
│   └── gen-manifest.js     # `pnpm manifest` — rebuilds live/manifest.json
└── README.md
```

---

## Setup

### 1. Prepare your videos

Upload each segment to YouTube as **Unlisted**. Copy the video ID from the URL — it's the part after `v=`, e.g. `https://youtube.com/watch?v=`**`dQw4w9WgXcQ`**.

Unlisted means the videos won't appear in search or your channel, but anyone with the link (or your embedded player) can watch them.

### 2. Edit config.json

Two ways:

- **Visual editor (recommended)** — run the dev server and open `editor.html`. It loads the existing `config.json`, gives you a form for every field, dropdowns for `target`/`returnTo` (no typos), and live validation as you type.
  - **New…** starts a fresh config — paste a YouTube URL (or video ID) and it scaffolds `masterVideoId`, a starter `intro` node, and auto-fills the show title from YouTube; leave it blank for an empty config.
  - **Open…** loads any config file from your machine; **Save As…** asks for a file name and saves it. On Chromium desktop it writes straight to a folder you pick; in other browsers it saves to your Downloads folder (enable "ask where to save each file" in your browser settings if you want to choose the location each time).
  - **Configs** lists every `.json` in the `live/` folder and opens the selected one in the player (`player.html?config=…`). After adding shows, run `pnpm manifest` so they also appear on the landing page.
  - Same zero-build, static-hostable file as the player.
- **By hand** — see `config.example.json` for the full schema with comments. Minimum viable node:

```json
{
  "id": "intro",
  "videoId": "dQw4w9WgXcQ",
  "choices": [
    { "label": "Continue", "target": "chapter-1", "default": true }
  ]
}
```

### 3. Deploy

Push to GitHub and enable **GitHub Pages**: Settings → Pages → "Deploy from a branch" → `main` / root. Free, auto-redeploys on every push.

Your player URL will be `https://<user>.github.io/<repo>/player.html#intro`.

(Netlify also works if you want a custom domain with less DNS hassle — same idea, point it at the repo.)

### 4. Link from YouTube

In YouTube Studio, add a **Card** to your main video at the moment you want to offer the branch. Set the link to the specific node URL, e.g.:

```
https://your-project.netlify.app/player.html#deep-dive-surveillance
```

When the viewer clicks it, they land exactly at that node. When the aside ends, they're routed back to wherever you've set `returnTo`.

---

## config.json schema

Two ways to attach video to nodes:

- **One master video, sliced by time** — set top-level `masterVideoId` and give each node `start`/`end` seconds. One upload, many segments. This is the recommended workflow when you've recorded a single long video.
- **Separate uploads per segment** — set `videoId` per node (overrides `masterVideoId`). Use this for deep-dive asides that live as their own uploads.

You can mix the two freely: main-line nodes pull from the master video; deep dives point at separate uploads.

```json
{
  "title": "Your show title",
  "startNode": "intro",
  "choiceDisplaySeconds": 8,
  "masterVideoId": "MASTER_VIDEO_ID",
  "nodes": [
    {
      "id": "intro",
      "title": "Introduction",
      "start": 0,
      "end": 45,
      "choices": [
        { "label": "Continue", "target": "chapter-1", "default": true }
      ]
    },
    {
      "id": "chapter-1",
      "title": "Chapter 1",
      "start": 45,
      "end": 180,
      "showChoicesAt": 165,
      "choices": [
        { "label": "Deep dive on X", "target": "aside-x", "style": "secondary" },
        { "label": "Continue", "target": "chapter-2", "default": true, "style": "primary" }
      ]
    },
    {
      "id": "aside-x",
      "title": "Deep Dive: X",
      "videoId": "SEPARATE_DEEP_DIVE_UPLOAD",
      "isAside": true,
      "returnTo": "chapter-2",
      "choices": []
    }
  ]
}
```

### Top-level fields

| Field | Required | Description |
|---|---|---|
| `title` | ✅ | Shown in browser tab |
| `startNode` | ✅ | Node id loaded when no `#hash` is present |
| `nodes` | ✅ | Array of node objects |
| `choiceDisplaySeconds` | — | Countdown for end-of-segment choices (default 8). Ignored when `showChoicesAt` + `end` are set; that countdown runs until `end`. |
| `masterVideoId` | — | Default YouTube videoId used by any node that doesn't set its own |

### Node fields

| Field | Required | Description |
|---|---|---|
| `id` | ✅ | Unique identifier, used in URLs (`#id`) |
| `title` | ✅ | Human-readable label (browser tab, analytics) |
| `videoId` | — | YouTube video ID. Required unless `masterVideoId` is set. |
| `start` | — | Seconds into the source video to begin this segment |
| `end` | — | Seconds into the source video to end this segment. YouTube stops here and fires the choice flow. |
| `showChoicesAt` | — | Seconds into the source video at which to reveal choices *mid-segment*. Video keeps playing; countdown runs until `end`. |
| `choices` | ✅ | Array of choice objects (can be empty if `returnTo` or `endScreen` handles routing) |
| `isAside` | — | Marks this node as an aside (affects badge/styling) |
| `returnTo` | — | Node to auto-route to when this segment ends (no choice needed) |
| `defaultAside` | — | If `true`, shows a persistent "Skip → back to main" button (requires `returnTo`) |
| `returnAtCurrentTime` | — | If `true`, shows a "← Back to where I was" button throughout this node and auto-resumes the branching node at the exact moment the viewer branched away. `returnTo` is used as the fallback when there is no captured branch point (e.g. someone deep-linked directly here). |
| `endScreen` | — | Object with `heading`, `body`, `links` — shown for terminal nodes |

### Choice fields

| Field | Required | Description |
|---|---|---|
| `label` | ✅ | Button text shown to viewer |
| `target` | ✅ | `id` of the node to navigate to |
| `default` | — | If `true`, player auto-navigates here when the countdown expires |
| `style` | — | `"primary"` or `"secondary"` — affects button appearance |

Any field whose name starts with `_` is ignored by the player and validator — use it for inline notes (`"_note": "this is a midpoint cliffhanger"`).

### Validating your config

Before deploying, run:

```bash
node tools/validate-config.js config.json
```

It checks: JSON parses, all `target`s and `returnTo`s resolve, exactly one default per choice set, `start < end`, `showChoicesAt` falls inside the segment, no duplicate ids, no unreachable nodes. Exits non-zero on errors so you can wire it into CI.

---

## Deep linking from external platforms

Every node is directly linkable. The URL hash is the node ID.

| Platform | How to link |
|---|---|
| **YouTube** | Card → external link → `https://yoursite.com/player.html#node-id` |
| **TikTok** | Link in bio or video overlay (business account) → same URL |
| **Nebula / anywhere** | Description link → same URL |
| **Your own site** | `<a href="/player.html#node-id">` |

The player reads the hash on load and starts at that node. If no hash is present, it starts at `startNode`.

---

## Adding new content

For a slice of the master video:

1. Find the `start`/`end` timestamps in the existing upload (YouTube's scrubber shows seconds)
2. Add a new node to `config.json` with those `start`/`end` values
3. Wire it into the existing graph via another node's `choices`
4. `node tools/validate-config.js config.json` to catch typos
5. Push to GitHub → Pages redeploys automatically

For a brand-new deep dive (separate upload):

1. Upload it to YouTube as Unlisted
2. Add a node with its own `videoId` (no `start`/`end` needed — plays in full)
3. Set `isAside: true` and `returnTo` so it auto-routes back to the main line
4. Wire it as a `target` in the main-line node where you want the off-ramp

No rebuilding. No compile step. No platform dashboard to navigate.

---

## Analytics

The player fires `history.pushState` events on every node navigation, so standard analytics tools (Plausible, Fathom, Google Analytics) track the path each viewer took. Add your analytics snippet to `player.html` and every node visit shows up as a pageview at `/#node-id`.

For richer data, node transitions can be instrumented with custom events — see the analytics hook comments inside the `<script>` block in `player.html`.

---

## Hosting cost comparison

| Option | Monthly cost | Video hosting | Deep links |
|---|---|---|---|
| Stornaway (Hosting plan) | ~$83 | Included | ✅ Per island |
| **This setup** | **$0** | YouTube (free) | ✅ Per node |
| Cinema8 (branching) | Contact sales | Included | Unclear |

---

## Local development

```bash
pnpm install
pnpm dev          # serve . on 0.0.0.0:8080
pnpm validate     # node tools/validate-config.js config.json
pnpm manifest     # rebuild live/manifest.json after adding/removing shows
```

The site entry point is `index.html` (the landing page); `editor.html` is the authoring tool. Both list shows from the `live/` folder.

Then visit `http://localhost:8080/player.html#intro`.

To browse on another device on your LAN or tailnet, use the machine's hostname/IP instead of `localhost`. On Tailscale with MagicDNS, that's `http://<machine>.<tailnet>.ts.net:8080/player.html`.

> **Note:** YouTube's IFrame API requires HTTP/HTTPS, not `file://`. Always go through the dev server.

---

## Extending

This is intentionally minimal. Some natural next steps:

- **Password protection** — Netlify supports basic auth on the whole site, or use a simple query-param token check in `player.js`
- **Progress memory** — `localStorage` can remember which nodes a viewer has seen across sessions
- **Chapter menu** — a sidebar nav built from `config.json` titles
- **Viewer-path analytics** — log node sequences to a free [Supabase](https://supabase.com) table
- **Multiple shows** — drop config files in `live/` and the player loads any of them via `player.html?config=live/show2.json`; the landing page (`index.html`) and the editor's **Configs** menu both list that folder

---

## License

MIT — use it, fork it, build on it.
