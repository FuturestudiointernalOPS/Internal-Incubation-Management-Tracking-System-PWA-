"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Film, PlayCircle, X } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import { extractYouTubeVideoId, buildYouTubeEmbedUrl } from "@/lib/lms/youtube";
import { notify } from "./notify";

/**
 * Lesson authoring modal (create + edit).
 *
 * The YouTube field accepts a full YouTube URL or a bare video ID; the ID is
 * derived from the URL on the fly, shown as a live preview below the field
 * (poster → click to play the same embed the course view uses), and only the
 * normalized 11-char video ID is sent to the API — never the URL, never the
 * file. The server re-normalizes as a safety net.
 *
 * Duration: when the video reference is valid, the modal asks the server for
 * the video metadata and pre-fills the (admin-editable) duration field with
 * the detected minutes. Auto-fill only ever targets an empty field or a value
 * that the modal itself detected — a manually typed duration is never
 * overwritten.
 */
export default function LessonModal({ isOpen, onClose, onSaved, mode, sectionId, lesson }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(lesson?.title || "");
  const [description, setDescription] = useState(lesson?.description || "");
  const [video, setVideo] = useState(lesson?.youtube_video_id || "");
  const [duration, setDuration] = useState(
    lesson?.duration_minutes != null ? String(lesson.duration_minutes) : "",
  );
  const [isRequired, setIsRequired] = useState(lesson ? !!lesson.is_required : true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // ── Duration auto-detection state ────────────────────────────────────────
  // idle | loading | done | unavailable | failed
  const [detectStatus, setDetectStatus] = useState("idle");
  // True while the duration field holds a value the modal detected itself, so
  // a later link change replaces it instead of clobbering a manual entry.
  const [durationAuto, setDurationAuto] = useState(false);
  const lastAutoId = useRef(null);

  const trimmedVideo = video.trim();
  const extracted = trimmedVideo ? extractYouTubeVideoId(trimmedVideo) : null;
  const videoInvalid = trimmedVideo !== "" && !extracted;

  // Ask the server for the video duration whenever the pasted video changes.
  // Fill the duration field only when it is empty or holds a previous auto
  // detection — never overwrite a manually entered value.
  useEffect(() => {
    if (!extracted || lastAutoId.current === extracted) {
      if (!extracted) setDetectStatus("idle");
      return;
    }
    const shouldFill = duration.trim() === "" || durationAuto;
    if (!shouldFill) {
      setDetectStatus("idle");
      return;
    }
    setDetectStatus("loading");
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/lms/video-info?v=${encodeURIComponent(extracted)}`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.success && data.durationMinutes != null) {
          lastAutoId.current = extracted;
          setDuration(String(data.durationMinutes));
          setDurationAuto(true);
          setDetectStatus("done");
        } else {
          setDetectStatus(data?.available === false ? "unavailable" : "failed");
        }
      } catch {
        if (!cancelled) setDetectStatus("failed");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // `duration`/`durationAuto` gate whether a fetch is wanted; they are not
    // triggers on their own (the effect early-returns without fetching).
  }, [extracted, duration, durationAuto]);

  const save = async () => {
    if (!title.trim()) {
      setErrors({ title: "lms.errors.lessonTitleRequired" });
      return;
    }
    if (videoInvalid) {
      setErrors({ video: "lms.errors.invalidYouTubeUrl" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        title,
        description,
        // Persist the derived ID (extracted from the URL/ID the user pasted),
        // not the raw input. `videoInvalid` was already rejected above.
        youtubeVideoId: extracted || null,
        durationMinutes: duration || null,
        isRequired,
      };
      const url =
        mode === "edit" ? `/api/lms/lessons/${lesson.id}` : `/api/lms/sections/${sectionId}/lessons`;
      const res = await fetch(url, {
        method: mode === "edit" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
      notify("success", mode === "edit" ? "lms.courses.saved" : "lms.lessons.title");
      onSaved();
      onClose();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppModal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === "edit" ? t("lms.lessons.edit") : t("lms.lessons.add")}
      size="lg"
    >
      <div className="space-y-5">
        <AppInput
          label={t("lms.lessons.name")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("lms.lessons.namePlaceholder")}
          error={errors.title ? t(errors.title) : undefined}
        />

        <div className="space-y-2">
          <label
            className="text-[10px] font-bold uppercase tracking-wider ml-1"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("lms.lessons.description")}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md py-3 px-4 text-sm font-medium outline-none transition-all border resize-y"
            style={{
              background: "var(--bg-primary)",
              borderColor: "var(--border-primary)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* YouTube video reference */}
        <div>
          <AppInput
            label={t("lms.lessons.video")}
            icon={Film}
            value={video}
            onChange={(e) => setVideo(e.target.value)}
            placeholder={t("lms.lessons.videoPlaceholder")}
            error={errors.video ? t(errors.video) : videoInvalid ? t("lms.lessons.videoInvalid") : undefined}
          />
          <div className="mt-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
            {trimmedVideo === "" ? (
              <span style={{ color: "var(--text-tertiary)" }}>{t("lms.lessons.videoEmpty")}</span>
            ) : extracted ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {t("lms.lessons.videoId")}: {extracted}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-rose-500">
                <AlertCircle className="w-3.5 h-3.5" />
                {t("lms.lessons.videoInvalid")}
              </span>
            )}
          </div>

          {/* Live preview of the video that will be shown — keyed on the ID so
              the player resets to its poster whenever the pasted URL changes. */}
          {extracted && (
            <div className="mt-3">
              <VideoPreview key={extracted} videoId={extracted} playLabel={t("lms.lessons.playPreview")} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <AppInput
              label={t("lms.lessons.duration")}
              type="number"
              min="0"
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value);
                // Manual edits leave the "auto-detected" state: the value is
                // now the admin's own and must not be replaced later.
                setDurationAuto(false);
                setDetectStatus("idle");
              }}
            />
            {detectStatus === "loading" && (
              <p className="text-[10px] font-bold uppercase tracking-wider ml-1" style={{ color: "var(--text-tertiary)" }}>
                {t("lms.lessons.durationDetecting")}
              </p>
            )}
            {detectStatus === "done" && (
              <p className="text-[10px] font-bold uppercase tracking-wider ml-1" style={{ color: "var(--text-tertiary)" }}>
                <span className="text-emerald-500">{t("lms.lessons.durationDetected")}</span>
                {" "}
                {t("lms.lessons.durationAdjustHint")}
              </p>
            )}
            {detectStatus === "unavailable" && (
              <p className="text-[10px] font-bold uppercase tracking-wider ml-1" style={{ color: "var(--text-tertiary)" }}>
                {t("lms.lessons.durationDetectUnavailable")}
              </p>
            )}
            {detectStatus === "failed" && (
              <p className="text-[10px] font-bold uppercase tracking-wider ml-1" style={{ color: "var(--text-tertiary)" }}>
                {t("lms.lessons.durationDetectFailed")}
              </p>
            )}
          </div>
          <label
            className="flex items-center gap-3 self-end pb-3 cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="w-4 h-4"
              style={{ accentColor: "var(--brand-orange)" }}
            />
            {/* Fixed label: checked = lesson is required, unchecked = optional. */}
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {t("lms.lessons.required")}
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <AppButton variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </AppButton>
          <AppButton variant="primary" loading={saving} onClick={save}>
            {t("common.save")}
          </AppButton>
        </div>
      </div>
    </AppModal>
  );
}

/**
 * Live preview of the YouTube video referenced by the lesson. Shows the video
 * poster with a play button; clicking embeds the player right there (autoplay,
 * same cookie-free embed as the course view). A close control returns to the
 * poster. Mounted with `key={videoId}`, so it always starts on the poster for
 * the current ID.
 */
function VideoPreview({ videoId, playLabel }) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border"
      style={{ aspectRatio: "16 / 9", background: "#000", borderColor: "var(--border-primary)" }}
    >
      {playing ? (
        <>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={buildYouTubeEmbedUrl(videoId, { autoplay: true })}
            title={playLabel}
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
            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover"
            loading="lazy"
          />
          <span
            className="relative z-10 flex items-center justify-center w-14 h-14 rounded-full transition-transform group-hover:scale-110"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <PlayCircle className="w-8 h-8" style={{ color: "rgba(255,255,255,0.95)" }} />
          </span>
        </button>
      )}
    </div>
  );
}
