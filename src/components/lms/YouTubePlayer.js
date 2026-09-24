"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PlayCircle,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  Film,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { buildYouTubeEmbedUrl } from "@/lib/lms/youtube";

// Origin of the embed, used as the postMessage target for player commands.
const YT_ORIGIN = "https://www.youtube-nocookie.com";

const CONTROL_BTN =
  "shrink-0 flex items-center justify-center w-9 h-9 rounded-full transition-colors cursor-pointer hover:bg-white/15";

/**
 * Hardened YouTube embed — the single player used everywhere a course video is
 * shown: the learner player, the admin / program-manager course presentation and
 * the admin lesson preview.
 *
 * Hardening:
 * - The stored 11-char ID is embedded via `youtube-nocookie` with YouTube's own
 *   chrome turned off (`controls=0`, no branding / cards / native fullscreen) —
 *   see `buildYouTubeEmbedUrl`.
 * - The video sits inside a container that refuses the right-click (context)
 *   menu, drag-copy and text selection, and covers the iframe with a shield so
 *   YouTube's own context menu can never appear.
 * - Play/pause, mute and fullscreen are ours, driven through the YouTube
 *   postMessage API, so no YouTube UI is ever exposed.
 *
 * Honest limitation: this is UX hardening, not DRM. An Unlisted video can still
 * be extracted or shared by a determined user.
 */
export default function YouTubePlayer({
  videoId,
  title,
  loop = false,
  playLabel,
  emptyLabel,
  emptyTitle,
  rounded = "rounded-2xl",
  className = "",
}) {
  const { t } = useI18n();
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const feedbackTimer = useRef(null);

  // `active` = the poster has been replaced by the real player.
  const [active, setActive] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Switching lessons (or editing a new link) always returns to the poster.
  useEffect(() => {
    setActive(false);
    setIsPlaying(true);
    setMuted(false);
    setShowFeedback(false);
  }, [videoId]);

  useEffect(() => () => clearTimeout(feedbackTimer.current), []);

  // Keep our fullscreen icon in sync with the browser (Esc / native UI).
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /** Send a command to the embedded player (playVideo, pauseVideo, mute…). */
  const command = useCallback((func, args = []) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(JSON.stringify({ event: "command", func, args }), YT_ORIGIN);
  }, []);

  const flash = useCallback(() => {
    setShowFeedback(true);
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setShowFeedback(false), 700);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      const next = !prev;
      command(next ? "playVideo" : "pauseVideo");
      return next;
    });
    flash();
  }, [command, flash]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      command(next ? "mute" : "unMute");
      return next;
    });
  }, [command]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  }, []);

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      className={`relative w-full overflow-hidden ${rounded} border select-none ${className}`}
      style={{ aspectRatio: "16 / 9", background: "#000", borderColor: "var(--border-primary)" }}
    >
      {videoId ? (
        active ? (
          <>
            <iframe
              ref={iframeRef}
              className="absolute inset-0 w-full h-full"
              src={buildYouTubeEmbedUrl(videoId, { autoplay: true, loop })}
              title={title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              referrerPolicy="strict-origin-when-cross-origin"
              onLoad={() => {
                command("playVideo");
                setIsPlaying(true);
              }}
            />

            {/* Right-click shield: swallows the context menu over the iframe and
                routes the click to our own play/pause control. */}
            <div
              onClick={togglePlay}
              aria-hidden="true"
              className="absolute inset-0 w-full h-full cursor-pointer"
            />

            {/* Center play/pause confirmation (never intercepts clicks). */}
            {showFeedback && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className="flex items-center justify-center w-16 h-16 rounded-full"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                >
                  {isPlaying ? (
                    <Pause className="w-8 h-8" style={{ color: "rgba(255,255,255,0.95)" }} />
                  ) : (
                    <PlayCircle className="w-9 h-9" style={{ color: "rgba(255,255,255,0.95)" }} />
                  )}
                </span>
              </span>
            )}

            {/* Our own control bar — the only playback UI the learner ever sees. */}
            <div
              className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-1 px-2 py-2"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65), transparent)", color: "#fff" }}
            >
              <button
                type="button"
                onClick={togglePlay}
                title={isPlaying ? t("lms.player.pause") : t("lms.player.playVideo")}
                aria-label={isPlaying ? t("lms.player.pause") : t("lms.player.playVideo")}
                className={CONTROL_BTN}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <PlayCircle className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={toggleMute}
                title={muted ? t("lms.player.unmute") : t("lms.player.mute")}
                aria-label={muted ? t("lms.player.unmute") : t("lms.player.mute")}
                className={CONTROL_BTN}
              >
                {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <span className="flex-1" />
              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? t("lms.player.exitFullscreen") : t("lms.player.enterFullscreen")}
                aria-label={isFullscreen ? t("lms.player.exitFullscreen") : t("lms.player.enterFullscreen")}
                className={CONTROL_BTN}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>

            {/* Return to the clean poster. */}
            <button
              type="button"
              onClick={() => setActive(false)}
              title={t("common.close")}
              className="absolute top-2 right-2 z-20 p-1.5 rounded-full transition-colors"
              style={{ background: "rgba(0,0,0,0.6)", color: "rgba(255,255,255,0.9)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setActive(true)}
            title={playLabel}
            className="absolute inset-0 w-full h-full flex items-center justify-center group"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              loading="lazy"
            />
            <span
              className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full transition-transform group-hover:scale-110"
              style={{ background: "rgba(0,0,0,0.55)" }}
            >
              <PlayCircle className="w-9 h-9" style={{ color: "rgba(255,255,255,0.95)" }} />
            </span>
          </button>
        )
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4"
          style={{ background: "var(--surface-3)" }}
        >
          <Film className="w-9 h-9" style={{ color: "var(--text-tertiary)" }} />
          {emptyTitle && (
            <p
              className="text-xs font-black uppercase tracking-tight text-center truncate max-w-full"
              style={{ color: "var(--text-primary)" }}
            >
              {emptyTitle}
            </p>
          )}
          <p
            className="text-[10px] font-bold uppercase tracking-wider text-center"
            style={{ color: "var(--text-tertiary)" }}
          >
            {emptyLabel}
          </p>
        </div>
      )}
    </div>
  );
}
