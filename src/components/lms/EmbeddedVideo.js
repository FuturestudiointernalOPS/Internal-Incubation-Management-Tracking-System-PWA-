"use client";

import { useState } from "react";
import { PlayCircle, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { isValidYouTubeVideoId, buildYouTubeEmbedUrl } from "@/lib/lms/youtube";

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
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const reference = isValidYouTubeVideoId(videoId) ? String(videoId).trim() : null;

  if (!reference) return null;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border ${className}`}
      style={{ aspectRatio: "16 / 9", background: "#000", borderColor: "var(--border-primary)" }}
    >
      {playing ? (
        <>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={buildYouTubeEmbedUrl(reference, { autoplay: true, loop: true })}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
          <button
            type="button"
            onClick={() => setPlaying(false)}
            title={t("common.close")}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-full transition-colors"
            style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.9)" }}
          >
            <X className="w-4 h-4" />
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          title={playLabel}
          className="absolute inset-0 w-full h-full flex items-center justify-center group"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://img.youtube.com/vi/${reference}/hqdefault.jpg`}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <span
            className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full transition-transform group-hover:scale-110"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <PlayCircle className="w-9 h-9" style={{ color: "rgba(255,255,255,0.95)" }} />
          </span>
        </button>
      )}
    </div>
  );
}
