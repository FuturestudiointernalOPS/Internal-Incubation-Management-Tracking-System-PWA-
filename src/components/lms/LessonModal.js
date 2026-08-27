"use client";

import { useState } from "react";
import { CheckCircle2, AlertCircle, Film } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppInput from "@/components/ui/AppInput";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import { extractYouTubeVideoId } from "@/lib/lms/youtube";
import { notify } from "./notify";

/**
 * Lesson authoring modal (create + edit).
 * Stores only the normalized YouTube video ID — never the URL, never the file.
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

  const trimmedVideo = video.trim();
  const extracted = trimmedVideo ? extractYouTubeVideoId(trimmedVideo) : null;
  const videoInvalid = trimmedVideo !== "" && !extracted;

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
        youtubeVideoId: trimmedVideo || null,
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AppInput
            label={t("lms.lessons.duration")}
            type="number"
            min="0"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
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
            <span className="text-[10px] font-bold uppercase tracking-wider">
              {isRequired ? t("lms.lessons.required") : t("lms.lessons.optional")}
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
