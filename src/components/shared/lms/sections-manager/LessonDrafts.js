"use client";

import { Plus, Trash2 } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import { extractYouTubeVideoId } from "@/models/lms/youtube";

/** An empty lesson row of the chapter-creation form. */
export const newLessonDraft = () => ({
  key: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: "",
  description: "",
  video: "",
  duration: "",
  isRequired: true,
});

/** Does this row carry anything the author typed? Blank rows are skipped on save. */
export const isDraftFilled = (draft) =>
  Boolean(draft.title.trim() || draft.description.trim() || draft.video.trim() || draft.duration);

/**
 * The lessons of a chapter being CREATED: the author fills them in the same
 * form as the chapter, and SectionsManager sends them once the chapter exists.
 * Controlled — the rows live in the modal state of the parent.
 */
export default function LessonDrafts({ drafts, onChange, t }) {
  const update = (key, patch) =>
    onChange(drafts.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  const remove = (key) => onChange(drafts.filter((draft) => draft.key !== key));

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
        {t("lms.sections.lessonsHeading")}
      </p>

      {drafts.map((draft, index) => {
        const videoInvalid = draft.video.trim() !== "" && !extractYouTubeVideoId(draft.video.trim());
        return (
          <div
            key={draft.key}
            className="rounded-xl border p-3 space-y-3"
            style={{ borderColor: "var(--border-primary)", background: "var(--surface-2)" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                {t("lms.lessons.title")} {index + 1}
              </span>
              <button
                type="button"
                onClick={() => remove(draft.key)}
                aria-label={t("common.delete")}
                className="p-1 rounded"
                style={{ color: "var(--text-tertiary)" }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <AppInput
              label={t("lms.lessons.name")}
              value={draft.title}
              onChange={(event) => update(draft.key, { title: event.target.value })}
              placeholder={t("lms.lessons.namePlaceholder")}
            />
            <AppInput
              label={t("lms.lessons.description")}
              value={draft.description}
              onChange={(event) => update(draft.key, { description: event.target.value })}
            />
            <AppInput
              label={t("lms.lessons.video")}
              value={draft.video}
              onChange={(event) => update(draft.key, { video: event.target.value })}
              placeholder={t("lms.lessons.videoPlaceholder")}
              error={videoInvalid ? t("lms.lessons.videoInvalid") : undefined}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <AppInput
                label={t("lms.lessons.duration")}
                type="number"
                min="0"
                value={draft.duration}
                onChange={(event) => update(draft.key, { duration: event.target.value })}
              />
              <label className="flex items-center gap-3 pb-3 cursor-pointer" style={{ color: "var(--text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={draft.isRequired}
                  onChange={(event) => update(draft.key, { isRequired: event.target.checked })}
                  className="w-4 h-4"
                  style={{ accentColor: "var(--brand-orange)" }}
                />
                <span className="text-[10px] font-bold uppercase tracking-wider">{t("lms.lessons.required")}</span>
              </label>
            </div>
          </div>
        );
      })}

      <AppButton variant="secondary" size="sm" icon={Plus} onClick={() => onChange([...drafts, newLessonDraft()])}>
        {t("lms.sections.addLesson")}
      </AppButton>
    </div>
  );
}
