/**
 * YouTube reference handling for LMS lessons.
 *
 * The LMS stores only the YouTube **video identifier** (per the Phase 1
 * architecture) — never the URL and never the video file itself.
 *
 * Security note: an Unlisted video is NOT private/DRM-protected. Storing the
 * ID makes embedding convenient but does not prevent extraction or sharing.
 */

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** True when the value looks like a valid 11-char YouTube video ID. */
export function isValidYouTubeVideoId(value) {
  return YT_ID_RE.test(String(value || "").trim());
}

// Default player parameters shared by every embed (admin presentation + learner
// player). Rationale:
//   - youtube-nocookie.com        keep the player on-page without YouTube's
//                                 tracking cookies on our site (privacy).
//   - rel=0                       end-of-video suggestions stay on the same
//                                 channel — the viewer is not pushed toward
//                                 unrelated videos.
//   - modestbranding=1            lighten the YouTube logo in the control bar.
//   - playsinline=1               play inline on mobile instead of forcing
//                                 fullscreen.
//   - color=white                 neutral control bar matching the embeds.
const EMBED_PARAMS = ["rel=0", "modestbranding=1", "playsinline=1", "color=white"];

/**
 * Build the cookie-free embed URL for a validated video ID.
 * `autoplay` is opt-in so it is only ever added after a real user gesture
 * (browser autoplay policies) — never on initial page load.
 * Returns null when the ID is not a valid 11-char YouTube video ID.
 */
export function buildYouTubeEmbedUrl(videoId, { autoplay = false } = {}) {
  const id = isValidYouTubeVideoId(videoId) ? String(videoId).trim() : null;
  if (!id) return null;
  const params = autoplay ? [...EMBED_PARAMS, "autoplay=1"] : EMBED_PARAMS;
  return `https://www.youtube-nocookie.com/embed/${id}?${params.join("&")}`;
}

/**
 * Normalize a YouTube URL or bare video ID into the canonical 11-char ID.
 * Supported inputs:
 *   - bare ID:            dQw4w9WgXcQ
 *   - watch:              https://www.youtube.com/watch?v=dQw4w9WgXcQ
 *   - short link:         https://youtu.be/dQw4w9WgXcQ
 *   - embed:              https://www.youtube.com/embed/dQw4w9WgXcQ
 *   - shorts / live:      https://www.youtube.com/shorts/dQw4w9WgXcQ
 *
 * Returns the 11-char ID, or null when the input is not a recognized format.
 */
export function extractYouTubeVideoId(input) {
  if (input == null) return null;
  const value = String(input).trim();
  if (!value) return null;

  if (YT_ID_RE.test(value)) return value;

  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0] || "";
    return YT_ID_RE.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "music.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v") || "";
      return YT_ID_RE.test(id) ? id : null;
    }
    const parts = url.pathname.split("/").filter(Boolean);
    if (
      (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") &&
      parts[1]
    ) {
      return YT_ID_RE.test(parts[1]) ? parts[1] : null;
    }
  }

  return null;
}
