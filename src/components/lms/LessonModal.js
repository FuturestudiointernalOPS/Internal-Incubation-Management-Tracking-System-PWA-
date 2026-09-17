"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Film, PlayCircle, X } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import { extractYouTubeVideoId, buildYouTubeEmbedUrl } from "@/lib/lms/youtube";
import { useApi } from "@/lib/hooks/useApi";
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

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are built once here
// rather than on every render.

const EMPTY_VIDEO_INFO = { minutes: null, available: null };

/**
 * What the duration lookup said: the detected minutes, or why there are none.
 * `available === false` is the server reporting that the lookup is not
 * configured, which is a different hint from a lookup that failed.
 */
const pickVideoInfo = (d) =>
  d?.success && d.durationMinutes != null
    ? { minutes: d.durationMinutes, available: true }
    : { minutes: null, available: d?.available === false ? false : null };

export default function LessonModal({ isOpen, onClose, onSaved, mode, sectionId, lesson }) {
  const { t } = useI18n();
  const [title, setTitle] = useState(lesson?.title || "");
  const [description, setDescription] = useState(lesson?.description || "");
  const [video, setVideo] = useState(lesson?.youtube_video_id || "");
  // The minutes the lookup detected are the BASE for this field; anything the
  // admin types is recorded as an edit on top of it, so a detection can never
  // land on a manual entry. `null` means the field is still the modal's to fill.
  const [durationEdit, setDurationEdit] = useState(
    lesson?.duration_minutes != null ? String(lesson.duration_minutes) : null,
  );
  const [isRequired, setIsRequired] = useState(lesson ? !!lesson.is_required : true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const trimmedVideo = video.trim();
  const extracted = trimmedVideo ? extractYouTubeVideoId(trimmedVideo) : null;
  const videoInvalid = trimmedVideo !== "" && !extracted;

  // The duration lookup is asked for by ADDRESS: the video reference is the
  // address, so a pasted link is the whole trigger, and the lookup is only asked
  // for while the field is still the modal's to fill — never once the admin has
  // taken the value over.
  const detectUrl =
    extracted && durationEdit === null
      ? `/api/lms/video-info?v=${encodeURIComponent(extracted)}`
      : null;
  const { data: videoInfo, loading: detecting, error: lookupError } = useApi(detectUrl, {
    defaultValue: EMPTY_VIDEO_INFO,
    transform: pickVideoInfo,
  });

  // What the field shows: the admin's own value when there is one, the detected
  // minutes otherwise.
  const duration =
    durationEdit !== null
      ? durationEdit
      : videoInfo.minutes != null
        ? String(videoInfo.minutes)
        : "";

  // The lookup's own progress, derived rather than stored:
  // idle | loading | done | unavailable | failed
  const detectStatus = !detectUrl
    ? "idle"
    : detecting
      ? "loading"
      : lookupError
        ? "failed"
        : videoInfo.minutes != null
          ? "done"
          : videoInfo.available === false
            ? "unavailable"
            : "failed";

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
                // The admin's own value: it sits over the detected one and the
                // lookup stops being asked for, so nothing replaces it later.
                setDurationEdit(e.target.value);
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
