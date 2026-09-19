// A stand-in for https://www.youtube.com/iframe_api, served by the tests in its place (ADR-0027).
// It implements the slice of the IFrame Player API that src/shell/youtube.ts types, with a clock
// the test drives: time advances only while PLAYING, at `window.__ytRate` seconds per second, and
// a segment loaded with `endSeconds` fires ENDED when it gets there. `window.__ytPlayer.jump(t)`
// moves the clock without a seek event, as if the video had played to `t`.
(() => {
  const ENDED = 0;
  const PLAYING = 1;
  const PAUSED = 2;
  const BUFFERING = 3;
  const CUED = 5;
  const TICK_MS = 50;

  class FakePlayer {
    constructor(_elementId, options) {
      this.t = 0;
      this.state = -1;
      this.end = null;
      this.videoId = options.videoId ?? null;
      this.events = options.events ?? {};
      window.__ytPlayer = this;
      setTimeout(() => {
        if (this.videoId) this.setState(CUED);
        this.events.onReady?.();
      }, 0);
      setInterval(() => {
        this.tick();
      }, TICK_MS);
    }

    setState(state) {
      if (state === this.state) return;
      this.state = state;
      this.events.onStateChange?.({ data: state });
    }

    tick() {
      if (this.state !== PLAYING) return;
      this.t += (TICK_MS / 1000) * Number(window.__ytRate ?? 1);
      if (this.end !== null && this.t >= this.end) {
        this.t = this.end;
        this.setState(ENDED);
      }
    }

    getCurrentTime() {
      return this.t;
    }

    getPlayerState() {
      return this.state;
    }

    getVideoData() {
      return { video_id: this.videoId ?? undefined };
    }

    // A seek within the loaded video drops the old endSeconds; the player's own backstop owns the
    // new boundary (see navigateTo in src/pages/player.ts).
    seekTo(seconds) {
      this.t = seconds;
      this.end = null;
    }

    playVideo() {
      this.setState(PLAYING);
    }

    pauseVideo() {
      this.setState(PAUSED);
    }

    loadVideoById(args) {
      this.videoId = args.videoId;
      this.t = args.startSeconds ?? 0;
      this.end = args.endSeconds ?? null;
      this.setState(BUFFERING);
    }

    jump(seconds) {
      this.t = seconds;
    }
  }

  window.YT = { Player: FakePlayer };
  window.onYouTubeIframeAPIReady?.();
})();
