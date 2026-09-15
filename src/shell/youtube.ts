/**
 * The slice of the YouTube IFrame Player API this app uses. Hand-typed rather than pulling in
 * `@types/youtube`: it is a dozen members, and every dependency is admitted under ADR-0014.
 *
 * Player methods only exist once the player's `onReady` has fired, which is why they are
 * optional here and every call site guards them — the same guards the pre-TypeScript pages had.
 */

export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

export interface YTPlayer {
  getCurrentTime?: () => number;
  getPlayerState?: () => number;
  getVideoData?: () => { video_id?: string };
  seekTo?: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo?: () => void;
  pauseVideo?: () => void;
  loadVideoById?: (args: { videoId: string; startSeconds?: number; endSeconds?: number }) => void;
}

export interface YTPlayerOptions {
  width: string;
  height: string;
  videoId?: string;
  playerVars: Record<string, number>;
  events: {
    onReady?: () => void;
    onStateChange?: (e: { data: number }) => void;
    onError?: (e: { data: number }) => void;
  };
}

interface YTNamespace {
  Player: new (elementId: string, options: YTPlayerOptions) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Calls `onReady` once `window.YT.Player` exists, injecting the API script if needed. */
export function loadYouTubeApi(onReady: (yt: YTNamespace) => void): void {
  const ready = (): void => {
    if (window.YT) onReady(window.YT);
  };
  if (window.YT?.Player) {
    ready();
    return;
  }
  window.onYouTubeIframeAPIReady = ready;
  const s = document.createElement("script");
  s.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(s);
}
