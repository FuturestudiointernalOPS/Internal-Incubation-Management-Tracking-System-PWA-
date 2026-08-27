"use client";

import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Film,
  HelpCircle,
  CheckCircle2,
  ListVideo,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import LessonModal from "./LessonModal";
import AssessmentModal from "./AssessmentModal";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { extractYouTubeVideoId } from "@/lib/lms/youtube";

/**
 * Section/lesson/assessment authoring area of the course editor.
 * All mutations go through the LMS API (server-side lms.edit authorization).
 */
export default function SectionsManager({ course, onChange }) {
  const { t } = useI18n();
  const [sectionModal, setSectionModal] = useState(null); // { mode, section }
  const [lessonModal, setLessonModal] = useState(null); // { mode, sectionId, lesson }
  const [assessmentModal, setAssessmentModal] = useState(null); // { mode, sectionId, assessment }
  const [savingId, setSavingId] = useState(null);

  const api = async (url, method, body) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
    return data;
  };

  const mutate = async (url, method, body, successKey = "lms.courses.saved", id = null) => {
    setSavingId(id);
    try {
      await api(url, method, body);
      notify("success", successKey);
      onChange();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setSavingId(null);
    }
  };

  // ── Sections ─────────────────────────────────────────────────────────────
  const saveSection = async () => {
    if (!sectionModal.title?.trim()) {
      notify("error", "lms.errors.sectionTitleRequired");
      return;
    }
    const url =
      sectionModal.mode === "edit"
        ? `/api/lms/sections/${sectionModal.section.id}`
        : `/api/lms/courses/${course.id}/sections`;
    await mutate(url, sectionModal.mode === "edit" ? "PUT" : "POST", {
      title: sectionModal.title,
      description: sectionModal.description,
    });
    setSectionModal(null);
  };

  const deleteSection = (section) => {
    if (!window.confirm(`${t("lms.confirm.deleteSection")}\n${t("lms.confirm.deleteSectionHint")}`)) return;
    mutate(`/api/lms/sections/${section.id}`, "DELETE", null, "lms.courses.saved", section.id);
  };

  const moveSection = (section, direction) =>
    mutate(`/api/lms/sections/${section.id}`, "PUT", { action: "move", direction }, "lms.courses.saved", section.id);

  // ── Lessons ──────────────────────────────────────────────────────────────
  const deleteLesson = (lesson) => {
    if (!window.confirm(t("lms.confirm.deleteLesson"))) return;
    mutate(`/api/lms/lessons/${lesson.id}`, "DELETE", null, "lms.courses.saved", lesson.id);
  };

  const moveLesson = (lesson, direction) =>
    mutate(`/api/lms/lessons/${lesson.id}`, "PUT", { action: "move", direction }, "lms.courses.saved", lesson.id);

  // ── Assessments ──────────────────────────────────────────────────────────
  const deleteAssessment = (assessment) => {
    if (!window.confirm(`${t("lms.confirm.deleteAssessment")}\n${t("lms.confirm.deleteAssessmentHint")}`)) return;
    mutate(`/api/lms/assessments/${assessment.id}`, "DELETE", null, "lms.courses.saved", assessment.id);
  };

  const courseAssessments = course.courseAssessments || [];

  return (
    <div className="space-y-4">
      {/* Sections */}
      {course.sections.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-12 rounded-xl border border-dashed"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <ListVideo className="w-8 h-8" style={{ color: "var(--text-tertiary)" }} />
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            {t("lms.sections.empty")}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.sections.emptyHint")}
          </p>
        </div>
      ) : (
        course.sections.map((section, index) => (
          <div key={section.id} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-primary)" }}>
            {/* Section header */}
            <div
              className="flex items-center gap-3 px-4 py-3 flex-wrap"
              style={{ background: "var(--surface-2)" }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                {index + 1}
              </p>
              <p className="text-xs font-black uppercase tracking-wider flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                {section.title}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveSection(section, "up")}
                  disabled={index === 0 || savingId === section.id}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                  style={{ color: "var(--text-tertiary)" }}
                  title={t("lms.sections.moveUp")}
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(section, "down")}
                  disabled={index === course.sections.length - 1 || savingId === section.id}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                  style={{ color: "var(--text-tertiary)" }}
                  title={t("lms.sections.moveDown")}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSectionModal({ mode: "edit", section, title: section.title, description: section.description })}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  title={t("lms.sections.edit")}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteSection(section)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  title={t("lms.sections.delete")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Lessons */}
            <div className="p-4 space-y-2">
              {section.lessons.length === 0 ? (
                <p className="text-[10px] font-bold uppercase tracking-wider py-3 text-center" style={{ color: "var(--text-tertiary)" }}>
                  {t("lms.lessons.emptyHint")}
                </p>
              ) : (
                section.lessons.map((lesson, li) => (
                  <div
                    key={lesson.id}
                    className="flex items-center gap-3 p-3 rounded-lg border"
                    style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
                  >
                    <Film className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                        {li + 1}. {lesson.title}
                      </p>
                      <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                        {lesson.youtube_video_id ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-500">{lesson.youtube_video_id}</span>
                          </>
                        ) : (
                          <span>{t("lms.lessons.videoEmpty")}</span>
                        )}
                        <span>·</span>
                        <span>{lesson.is_required ? t("lms.lessons.required") : t("lms.lessons.optional")}</span>
                        {lesson.duration_minutes != null && (
                          <>
                            <span>·</span>
                            <span>{lesson.duration_minutes} min</span>
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => moveLesson(lesson, "up")}
                        disabled={li === 0 || savingId === lesson.id}
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                        style={{ color: "var(--text-tertiary)" }}
                        title={t("lms.lessons.moveUp")}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLesson(lesson, "down")}
                        disabled={li === section.lessons.length - 1 || savingId === lesson.id}
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                        style={{ color: "var(--text-tertiary)" }}
                        title={t("lms.lessons.moveDown")}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLessonModal({ mode: "edit", sectionId: section.id, lesson })}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: "var(--text-tertiary)" }}
                        title={t("lms.lessons.edit")}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLesson(lesson)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: "var(--text-tertiary)" }}
                        title={t("lms.lessons.delete")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}

              <div className="flex items-center gap-2 pt-1">
                <AppButton
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  onClick={() => setLessonModal({ mode: "create", sectionId: section.id, lesson: null })}
                >
                  {t("lms.sections.addLesson")}
                </AppButton>
                {!section.assessment && (
                  <AppButton
                    variant="ghost"
                    size="sm"
                    icon={HelpCircle}
                    onClick={() => setAssessmentModal({ mode: "create", sectionId: section.id, assessment: null })}
                  >
                    {t("lms.sections.addAssessment")}
                  </AppButton>
                )}
              </div>

              {/* Section assessment */}
              {section.assessment && (
                <div
                  className="mt-2 rounded-lg border p-3"
                  style={{ background: "var(--surface-2)", borderColor: "var(--border-primary)" }}
                >
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 shrink-0" style={{ color: "var(--brand-blue)" }} />
                    <p className="text-[10px] font-black uppercase tracking-wider flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                      {t("lms.assessments.title")}: {section.assessment.title}
                    </p>
                    <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                      {section.assessment.questions?.length || 0} {t("lms.preview.questions")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssessmentModal({ mode: "edit", sectionId: section.id, assessment: section.assessment })}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                      title={t("lms.assessments.edit")}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAssessment(section.assessment)}
                      className="p-1.5 rounded-lg transition-colors"
                      style={{ color: "var(--text-tertiary)" }}
                      title={t("lms.assessments.delete")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))
      )}

      <AppButton
        variant="secondary"
        icon={Plus}
        onClick={() => setSectionModal({ mode: "create", section: null, title: "", description: "" })}
      >
        {t("lms.sections.add")}
      </AppButton>

      {/* Course-level assessments */}
      <div className="pt-2 border-t" style={{ borderColor: "var(--border-primary)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              {t("lms.sections.courseAssessments")}
            </p>
            <p className="text-[9px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.sections.courseLevelHint")}
            </p>
          </div>
          <AppButton
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={() => setAssessmentModal({ mode: "create", sectionId: null, assessment: null })}
          >
            {t("lms.assessments.add")}
          </AppButton>
        </div>
        {courseAssessments.length === 0 ? (
          <p className="text-[10px] font-bold uppercase tracking-wider text-center py-3" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.assessments.emptyHint")}
          </p>
        ) : (
          <div className="space-y-2">
            {courseAssessments.map((assessment) => (
              <div
                key={assessment.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
                style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
              >
                <HelpCircle className="w-4 h-4 shrink-0" style={{ color: "var(--brand-blue)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                    {assessment.title}
                  </p>
                  <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: "var(--text-tertiary)" }}>
                    {assessment.questions?.length || 0} {t("lms.preview.questions")} ·{" "}
                    {t("lms.preview.passMark")}: {assessment.pass_mark != null ? `${assessment.pass_mark}%` : "—"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssessmentModal({ mode: "edit", sectionId: null, assessment })}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  title={t("lms.assessments.edit")}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteAssessment(assessment)}
                  className="p-1.5 rounded-lg transition-colors"
                  style={{ color: "var(--text-tertiary)" }}
                  title={t("lms.assessments.delete")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {sectionModal && (
        <AppModal
          isOpen
          onClose={() => setSectionModal(null)}
          title={sectionModal.mode === "edit" ? t("lms.sections.edit") : t("lms.sections.add")}
          size="md"
        >
          <div className="space-y-4">
            <AppInput
              label={t("lms.sections.name")}
              value={sectionModal.title}
              onChange={(e) => setSectionModal((p) => ({ ...p, title: e.target.value }))}
              placeholder={t("lms.sections.namePlaceholder")}
            />
            <div className="space-y-2">
              <label
                className="text-[10px] font-bold uppercase tracking-wider ml-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("lms.sections.description")}
              </label>
              <textarea
                value={sectionModal.description || ""}
                onChange={(e) => setSectionModal((p) => ({ ...p, description: e.target.value }))}
                rows={2}
                className="w-full rounded-md py-3 px-4 text-sm font-medium outline-none transition-all border resize-y"
                style={{
                  background: "var(--bg-primary)",
                  borderColor: "var(--border-primary)",
                  color: "var(--text-primary)",
                }}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <AppButton variant="ghost" onClick={() => setSectionModal(null)}>
                {t("common.cancel")}
              </AppButton>
              <AppButton variant="primary" onClick={saveSection}>
                {t("common.save")}
              </AppButton>
            </div>
          </div>
        </AppModal>
      )}

      {lessonModal && (
        <LessonModal
          isOpen
          onClose={() => setLessonModal(null)}
          onSaved={onChange}
          mode={lessonModal.mode}
          sectionId={lessonModal.sectionId}
          lesson={lessonModal.lesson}
        />
      )}

      {assessmentModal && (
        <AssessmentModal
          isOpen
          onClose={() => setAssessmentModal(null)}
          onSaved={onChange}
          mode={assessmentModal.mode}
          courseId={course.id}
          sectionId={assessmentModal.sectionId}
          assessment={assessmentModal.assessment}
        />
      )}
    </div>
  );
}
