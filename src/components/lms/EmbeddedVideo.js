"use client";

import { isValidYouTubeVideoId } from "@/lib/lms/youtube";
import YouTubePlayer from "./YouTubePlayer";

/**
 * THE EMBEDDED VIDEO BOX — the single place the LMS plays a YouTube video.
 *
 * Every surface goes through this box: the course presentation, the lesson
 * authoring preview, the learner player, and a session resource that points at a
 * YouTube video. It exists so the rules below cannot drift apart again — a
 * video attached to a program session used to be a plain link that opened
 * YouTube in a new tab, while the same video inside a course was locked in an
 * embed, and the authoring preview was the one embed that did not loop.
 *
 * The rules, deliberately identical everywhere:
 *   - the video starts on a clean poster (no YouTube chrome) and is only
 *     embedded after a real click — browser autoplay policies;
 *   - the embed LOOPS, so YouTube's end screen — its suggested videos and its
 *     copy-link control — is never reached;
 *   - only the stored 11-char reference is used: no raw URL is ever rendered,
 *     and nothing here links out to YouTube.
 *
 * The locked container itself lives in `YouTubePlayer` (YouTube's own controls
 * hidden, right-click/context menu and drag-copy blocked, our own play/pause,
 * mute and fullscreen controls driven through the postMessage API); this box is
 * the boundary the rest of the app talks to, so the invalid-reference case and
 * the always-loop rule stay in one place.
 *
 * This hides the accidental copy, it does not protect the video: the reference
 * can still be extracted by a determined viewer (see docs/LMS_ARCHITECTURE.md
 * §10). The no-video case stays with the caller — an empty state, or the plain
 * link a resource keeps when it cannot be embedded — so an invalid reference
 * renders nothing at all here.
 *
 * Mount it with `key={videoId}` wherever the box can outlive the video it shows
 * (the player changes lesson, the preview changes reference), so a new
 * reference starts on its own poster instead of inheriting "playing".
 */
export default function EmbeddedVideo({ videoId, title, playLabel, className = "" }) {
  const reference = isValidYouTubeVideoId(videoId) ? String(videoId).trim() : null;

  if (!reference) return null;

  return (
    <YouTubePlayer
      videoId={reference}
      title={title}
      loop
      playLabel={playLabel}
      className={className}
    />
  );
}
