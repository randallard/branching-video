// ─────────────────────────────────────────────
// Branching Video Player
// Reads a show config, manages node routing, embeds YouTube via the IFrame API.
// ─────────────────────────────────────────────
import { normalizeConfig } from "../core/config.ts";
import type { EndScreen, ShowConfig, ShowNode } from "../core/config.ts";
import { segmentEndAction } from "../core/routing.ts";
import { escapeHtml } from "../core/text.ts";
import { getTransfer } from "../shell/drafts.ts";
import { errorMessage } from "../shell/files.ts";
import { YT_STATE, loadYouTubeApi } from "../shell/youtube.ts";
import type { YTPlayer } from "../shell/youtube.ts";
import { byId } from "../ui/dom.ts";

// Config source: `?config=relative/path.json` (same-origin relative paths only),
// `?config=transfer` (handed over from Studio/home in localStorage), otherwise config.json.
const cfgParam = new URLSearchParams(location.search).get("config");
const CONFIG_URL =
  cfgParam && !/^[a-z]+:/i.test(cfgParam) && !cfgParam.startsWith("//") ? cfgParam : "config.json";
const POLL_INTERVAL_MS = 250;
const COUNTDOWN_TICK_MS = 50;
const END_BACKSTOP_TOLERANCE = 0.25; // seconds past `end` before backstop fires

let config: ShowConfig | null = null;
const nodeMap = new Map<string, ShowNode>();
let ytPlayer: YTPlayer | null = null;
let currentNode: ShowNode | null = null;
let choiceTimer: ReturnType<typeof setInterval> | null = null; // countdown (advances only while playing/ended)
let pollHandle: ReturnType<typeof setInterval> | null = null; // mid-segment time cues
let segmentChoicesShown = false; // true once choices are visible for the current segment
// True once the current segment has reached PLAYING — guards against spurious ENDED events
// that YouTube fires during loadVideoById transitions.
let segmentReady = false;
// Captured when entering an aside that opts into resume-at-branch-point via
// returnAtCurrentTime; consumed on return.
let branchContext: { nodeId: string; currentTime: number } | null = null;

// ── DOM refs ──────────────────────────────────
const $showTitle = byId("show-title");
const $nodeTitle = byId("node-title");
const $asideBadge = byId("aside-badge");
const $skipBtn = byId("skip-btn", HTMLButtonElement);
const $backBtn = byId("back-btn", HTMLButtonElement);
const $choices = byId("choices");
const $cdBar = byId("countdown-bar");
const $cdWrap = byId("countdown-wrap");
const $endScreen = byId("end-screen");
const $endHeading = byId("end-heading");
const $endBody = byId("end-body");
const $endLinks = byId("end-links");
const $status = byId("status");
const $menu = byId("menu");
const $menuToggle = byId("menu-toggle");
const $menuClose = byId("menu-close");
const $menuList = byId("menu-list");
const $menuIndexLink = byId("menu-index-link");

function currentTime(): number | null {
  return ytPlayer?.getCurrentTime ? ytPlayer.getCurrentTime() : null;
}

function playerState(): number | null {
  return ytPlayer?.getPlayerState ? ytPlayer.getPlayerState() : null;
}

// ── Bootstrap ────────────────────────────────

async function init(): Promise<void> {
  showStatus("Loading…");
  let raw: unknown;
  try {
    if (cfgParam === "transfer") {
      raw = getTransfer();
      if (raw === null) throw new Error("No transfer config found in browser storage.");
    } else {
      const res = await fetch(CONFIG_URL);
      if (!res.ok) throw new Error(`Could not load ${CONFIG_URL} (${String(res.status)})`);
      raw = await res.json();
    }
  } catch (e) {
    showStatus(
      `⚠️ ${escapeHtml(errorMessage(e))}<br><small>Make sure config.json is in the same directory as player.html</small>`
    );
    return;
  }

  // Normalizing also strips `_` comment fields.
  config = normalizeConfig(raw);
  if (!config) {
    showStatus(`⚠️ ${escapeHtml(CONFIG_URL)} is not a show config (no "nodes" array).`);
    return;
  }
  for (const node of config.nodes) nodeMap.set(node.id, node);

  $showTitle.textContent = config.title || "Interactive Video";
  document.title = config.title || "Interactive Video";

  loadYouTubeApi(onYTReady);
}

// ── YouTube IFrame API ────────────────────────

function onYTReady(yt: NonNullable<Window["YT"]>): void {
  ytPlayer = new yt.Player("yt-player", {
    width: "100%",
    height: "100%",
    playerVars: {
      autoplay: 1,
      controls: 1,
      rel: 0,
      modestbranding: 1,
      iv_load_policy: 3, // hide annotations
      enablejsapi: 1,
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange,
      onError: onPlayerError,
    },
  });
}

function onPlayerReady(): void {
  if (!config) return;
  hideStatus();
  // Navigate to node from URL hash, or startNode
  const hash = location.hash.replace("#", "").trim();
  navigateTo(hash && nodeMap.has(hash) ? hash : config.startNode);
}

function onPlayerStateChange(e: { data: number }): void {
  if (e.data === YT_STATE.PLAYING) {
    segmentReady = true;
    startPolling();
  } else if (e.data === YT_STATE.ENDED) {
    stopPolling();
    // Guard 1: ignore ENDED before the new segment has actually started playing.
    if (!segmentReady) return;
    // Guard 2: when `end` is set, only treat ENDED as real if currentTime is near it.
    // seekTo() from an ENDED state can re-fire ENDED before transitioning to PLAYING,
    // which would otherwise trigger showChoices for the wrong moment.
    const t = currentTime();
    if (currentNode && typeof currentNode.end === "number" && t !== null) {
      if (Math.abs(t - currentNode.end) > 5) return; // spurious — wait for the real end
    }
    onSegmentEnded();
  }
  // Other states (PAUSED, BUFFERING, CUED): leave polling alone; pollTick is a no-op when paused.
}

function startPolling(): void {
  if (pollHandle !== null) return;
  pollHandle = setInterval(pollTick, POLL_INTERVAL_MS);
}

function stopPolling(): void {
  if (pollHandle !== null) clearInterval(pollHandle);
  pollHandle = null;
}

function pollTick(): void {
  const t = currentTime();
  if (!currentNode || t === null) return;

  // Mid-segment choice cue
  if (
    !segmentChoicesShown &&
    typeof currentNode.showChoicesAt === "number" &&
    t >= currentNode.showChoicesAt
  ) {
    segmentChoicesShown = true;
    showChoices(currentNode);
  }

  // Backstop end detection — YouTube usually fires ENDED at endSeconds, but on slow loads /
  // certain browsers it can miss. Trigger ourselves if we've sailed past `end` without it.
  if (typeof currentNode.end === "number" && t >= currentNode.end + END_BACKSTOP_TOLERANCE) {
    stopPolling();
    onSegmentEnded();
  }
}

function resolveVideoId(node: ShowNode): string | null {
  return node.videoId || config?.masterVideoId || null;
}

function onPlayerError(e: { data: number }): void {
  showStatus(
    `⚠️ YouTube player error (code ${String(e.data)}).<br><small>Check that the videoId is correct and the video is Public or Unlisted.</small>`
  );
}

// ── Navigation ────────────────────────────────

function navigateTo(nodeId: string, seekToOverride?: number): void {
  if (!config || !ytPlayer) return;
  clearChoices();
  hideEndScreen();
  stopPolling();
  segmentReady = false;

  const node = nodeMap.get(nodeId);
  if (!node) {
    showStatus(
      `⚠️ Node not found: <code>${escapeHtml(nodeId)}</code><br><small>Check your config.json for a matching id.</small>`
    );
    return;
  }

  // Capture where the viewer is branching from, but only when leaving the main line
  // (i.e. not from an aside — otherwise nested asides would clobber the original anchor).
  const t = currentTime();
  if (node.returnAtCurrentTime && currentNode && !currentNode.isAside && t !== null) {
    branchContext = { nodeId: currentNode.id, currentTime: t };
  }

  currentNode = node;

  // Update URL hash (enables back/forward and deep linking)
  history.pushState(null, "", `#${node.id}`);

  // Update header
  $nodeTitle.textContent = node.title || "";
  document.title = [node.title, config.title].filter(Boolean).join(" — ");

  // Aside indicator
  if (node.isAside) {
    $asideBadge.classList.add("visible");
    $asideBadge.textContent = node.defaultAside ? "Aside" : "Deep dive";
  } else {
    $asideBadge.classList.remove("visible");
  }

  // Pattern B: persistent skip button for default asides
  const returnTo = node.returnTo;
  if (node.isAside && node.defaultAside && returnTo) {
    $skipBtn.textContent = "Skip → back to main";
    $skipBtn.classList.add("visible");
    $skipBtn.onclick = () => {
      navigateTo(returnTo);
    };
  } else {
    $skipBtn.classList.remove("visible");
    $skipBtn.onclick = null;
  }

  // Back-to-branch-point button: only meaningful when both opted in and an anchor was captured.
  if (node.returnAtCurrentTime && branchContext) {
    const ctx = branchContext;
    $backBtn.textContent = "← Back to where I was";
    $backBtn.classList.add("visible");
    $backBtn.onclick = () => {
      branchContext = null;
      navigateTo(ctx.nodeId, ctx.currentTime);
    };
  } else {
    $backBtn.classList.remove("visible");
    $backBtn.onclick = null;
  }

  const videoId = resolveVideoId(node);
  if (!videoId) {
    showStatus(
      `⚠️ Node "${escapeHtml(node.id)}" has no videoId and no <code>masterVideoId</code> is set in config.`
    );
    return;
  }

  // Effective start: explicit override (back-button resume) > node.start > 0.
  const startSec =
    typeof seekToOverride === "number"
      ? seekToOverride
      : typeof node.start === "number"
        ? node.start
        : 0;

  // If we're resuming past the mid-segment cue, don't re-fire choices on the way back in.
  // The end-of-segment flow will still show them when the segment finishes naturally.
  segmentChoicesShown = typeof node.showChoicesAt === "number" && startSec >= node.showChoicesAt;

  // If we're already on this videoId, just seek instead of reloading. Avoids the black-screen
  // reload flash when slicing one master video into many segments. pollTick's backstop handles
  // the new `end` boundary since YouTube's prior endSeconds is now stale.
  const currentData = ytPlayer.getVideoData ? ytPlayer.getVideoData() : null;
  const sameVideo = currentData?.video_id === videoId;

  if (sameVideo) {
    // Only pre-arm segmentReady if the player is already PLAYING — otherwise we'd race
    // against a spurious ENDED that can fire when seekTo() is called from ENDED state.
    const stateBefore = playerState() ?? -1;
    ytPlayer.seekTo?.(startSec, true);
    ytPlayer.playVideo?.();
    if (stateBefore === YT_STATE.PLAYING) {
      segmentReady = true;
      startPolling();
    }
    // Otherwise: wait for the real PLAYING state event to flip segmentReady + start polling.
  } else {
    ytPlayer.loadVideoById?.({
      videoId,
      startSeconds: startSec,
      ...(typeof node.end === "number" ? { endSeconds: node.end } : {}),
    });
    ytPlayer.playVideo?.();
  }

  // Analytics hook — replace with your own event tracking if needed
  // e.g. gtag('event', 'node_view', { node_id: node.id, node_title: node.title });
}

function onSegmentEnded(): void {
  const node = currentNode;
  if (!node || !config) return;

  // If mid-segment choices are already visible, the countdown owns the next step.
  if ($choices.classList.contains("visible")) return;

  const action = segmentEndAction(config, node, branchContext !== null);
  switch (action.kind) {
    case "resume-branch": {
      // Resume at the original branch point this aside opted into.
      const ctx = branchContext;
      branchContext = null;
      if (ctx) navigateTo(ctx.nodeId, ctx.currentTime);
      return;
    }
    case "return-to": // Aside with returnTo: auto-route back to the main line
    case "continue": // No way forward: play on into the next node (ADR-0022)
      navigateTo(action.nodeId);
      return;
    case "end-screen":
      showEndScreen(action.endScreen);
      return;
    case "wrap": // Last node without an end screen: a simple replay
      showEndScreen({ heading: "That's a wrap.", links: [{ label: "Watch again", target: node.id }] });
      return;
    case "choices":
      showChoices(node);
      return;
  }
}

// ── Choice UI ─────────────────────────────────

function showChoices(node: ShowNode): void {
  clearChoices();

  // Mid-segment: countdown runs until `end` is reached.
  // End-of-segment: fall back to configured choiceDisplaySeconds.
  let displaySeconds: number;
  if (typeof node.showChoicesAt === "number" && typeof node.end === "number") {
    const now = currentTime() ?? node.showChoicesAt;
    displaySeconds = Math.max(0, node.end - now);
  } else {
    displaySeconds = config?.choiceDisplaySeconds ?? 8;
  }

  const defaultChoice = node.choices.find((c) => c.default);

  // Build buttons
  for (const choice of node.choices) {
    const btn = document.createElement("button");
    btn.className = `choice-btn ${choice.style === "secondary" ? "secondary" : "primary"}`;
    btn.textContent = choice.label;
    btn.onclick = () => {
      clearChoices();
      // Analytics hook:
      // gtag('event', 'choice_click', { from: node.id, to: choice.target, label: choice.label });
      navigateTo(choice.target);
    };
    $choices.appendChild(btn);
  }

  // Countdown bar (only if there's a default to auto-fire).
  // Tied to player state so pausing the video pauses the countdown.
  if (defaultChoice && displaySeconds > 0) {
    $cdWrap.style.display = "block";
    startCountdown(displaySeconds, () => {
      clearChoices();
      navigateTo(defaultChoice.target);
    });
  } else {
    $cdWrap.style.display = "none";
  }

  // Trigger CSS transition
  requestAnimationFrame(() => {
    $choices.classList.add("visible");
  });
}

function startCountdown(durationSec: number, onComplete: () => void): void {
  const durationMs = durationSec * 1000;
  let elapsedMs = 0;
  let lastTick = performance.now();

  choiceTimer = setInterval(() => {
    const now = performance.now();
    const dt = now - lastTick;
    lastTick = now;

    // Advance only when the video is playing or ended.
    // Pausing, buffering, or cued freezes the countdown.
    const state = playerState() ?? YT_STATE.PLAYING;
    if (state === YT_STATE.PLAYING || state === YT_STATE.ENDED) elapsedMs += dt;

    const fraction = Math.min(elapsedMs / durationMs, 1);
    $cdBar.style.transform = `scaleX(${String(1 - fraction)})`;

    if (fraction >= 1) {
      if (choiceTimer !== null) clearInterval(choiceTimer);
      choiceTimer = null;
      onComplete();
    }
  }, COUNTDOWN_TICK_MS);
}

function clearChoices(): void {
  if (choiceTimer !== null) clearInterval(choiceTimer);
  choiceTimer = null;

  $choices.classList.remove("visible");
  $cdBar.style.transform = "scaleX(1)";

  // Remove all choice buttons (keep countdown-wrap)
  for (const b of Array.from($choices.querySelectorAll(".choice-btn"))) b.remove();
}

// ── End screen ───────────────────────────────

function showEndScreen(endScreen: EndScreen): void {
  $endHeading.textContent = endScreen.heading || "The end.";
  $endBody.textContent = endScreen.body || "";
  $endLinks.innerHTML = "";

  for (const link of endScreen.links) {
    const a = document.createElement("a");
    a.className = "end-link-btn";
    a.textContent = link.label;

    const target = link.target;
    if (target) {
      // Internal node link
      a.href = `#${target}`;
      a.onclick = (e) => {
        e.preventDefault();
        hideEndScreen();
        navigateTo(target);
      };
    } else if (link.url) {
      a.href = link.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }

    $endLinks.appendChild(a);
  }

  $endScreen.classList.add("visible");
}

function hideEndScreen(): void {
  $endScreen.classList.remove("visible");
}

// ── Status / error ────────────────────────────

/** `html` is trusted markup: every interpolated value is escaped at the call site. */
function showStatus(html: string): void {
  $status.innerHTML = html;
  $status.classList.add("visible");
}

function hideStatus(): void {
  $status.classList.remove("visible");
}

// ── Chapter menu ─────────────────────────────

function openMenu(): void {
  buildMenuList();
  $menu.classList.add("visible");
  $menu.setAttribute("aria-hidden", "false");
  $menuToggle.setAttribute("aria-expanded", "true");
}

function closeMenu(): void {
  $menu.classList.remove("visible");
  $menu.setAttribute("aria-hidden", "true");
  $menuToggle.setAttribute("aria-expanded", "false");
}

function buildMenuList(): void {
  if (!config) return;
  $menuList.innerHTML = "";

  // Update index link label from config title if available
  if (config.title) $menuIndexLink.textContent = "← " + config.title + " — All shows";

  for (const node of config.nodes) {
    const item = document.createElement("button");
    item.className = "menu-item" + (currentNode?.id === node.id ? " current" : "");

    const title = document.createElement("span");
    title.className = "menu-item-title";
    title.textContent = node.title || node.id;
    item.appendChild(title);

    if (node.isAside) {
      const badge = document.createElement("span");
      badge.className = "menu-item-badge";
      badge.textContent = node.defaultAside ? "Aside" : "Deep dive";
      item.appendChild(badge);
    }

    item.onclick = () => {
      closeMenu();
      navigateTo(node.id);
    };

    const li = document.createElement("li");
    li.appendChild(item);
    $menuList.appendChild(li);
  }
}

$menuToggle.addEventListener("click", openMenu);
$menuClose.addEventListener("click", closeMenu);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $menu.classList.contains("visible")) closeMenu();
});

// ── Browser back/forward ─────────────────────

window.addEventListener("popstate", () => {
  const hash = location.hash.replace("#", "").trim();
  if (hash && nodeMap.has(hash) && hash !== currentNode?.id) {
    navigateTo(hash);
  }
});

// ── Go ────────────────────────────────────────
void init();
