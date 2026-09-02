"use client";

import { BookOpen, Film, HelpCircle, X, CheckCircle2 } from "lucide-react";
import AppModal from "@/components/ui/AppModal";
import AppButton from "@/components/ui/AppButton";
import CourseThumb from "./CourseThumb";
import { useI18n } from "@/lib/i18n";

/**
 * Lightweight author preview — read-only tree of the course structure.
 * NOT the learner player (Phase 3): it lets the author verify sections,
 * lessons, video references and assessments before publishing.
 */
export default function CoursePreviewModal({ isOpen, onClose, course }) {
  const { t } = useI18n();
  if (!course) return null;

  const lessonCount = course.sections.reduce((sum, s) => sum + (s.lessons || []).length, 0);
  const assessmentCount =
    (course.sections.filter((s) => s.assessment).length || 0) + (course.courseAssessments || []).length;

  return (
    <AppModal isOpen={isOpen} onClose={onClose} title={t("lms.preview.title")} size="xl">
      <div className="space-y-6 max-h-[60vh] sm:max-h-[65vh] overflow-y-auto pr-1">
        {/* Course summary */}
        <div className="rounded-xl border p-4" style={{ background: "var(--surface-2)", borderColor: "var(--border-primary)" }}>
          {course.thumbnail_url && (
            <CourseThumb
              src={course.thumbnail_url}
              alt={course.title || ""}
              className="w-full h-36 sm:h-44 rounded-lg mb-4"
            />
          )}
          <p className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
            {course.title || "—"}
          </p>
          {course.description && (
            <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {course.description}
            </p>
          )}
          <div className="flex flex-wrap gap-4 mt-3 text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            <span>{course.sections.length} {t("lms.preview.sections")}</span>
            <span>{lessonCount} {t("lms.preview.lessons")}</span>
            <span>{assessmentCount} {t("lms.preview.assessments")}</span>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {course.sections.length === 0 && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-center py-4" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.sections.empty")}
            </p>
          )}
          {course.sections.map((section, si) => (
            <div key={section.id} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-primary)" }}>
              <div className="flex items-center gap-2 px-4 py-3" style={{ background: "var(--surface-2)" }}>
                <BookOpen className="w-4 h-4 shrink-0" style={{ color: "var(--brand-orange)" }} />
                <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                  {si + 1}. {section.title}
                </p>
              </div>
              <div className="p-4 space-y-2">
                {(section.lessons || []).map((lesson, li) => (
                  <div key={lesson.id} className="flex items-center gap-3">
                    <Film className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                    <p className="text-xs font-bold flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                      {li + 1}. {lesson.title}
                    </p>
                    {lesson.youtube_video_id ? (
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-emerald-500">
                        <CheckCircle2 className="w-3 h-3" />
                        {lesson.youtube_video_id}
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                        {t("lms.preview.noVideo")}
                      </span>
                    )}
                  </div>
                ))}
                {section.assessment && <AssessmentSummary assessment={section.assessment} />}
              </div>
            </div>
          ))}

          {course.courseAssessments?.length > 0 && (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-primary)" }}>
              <div className="px-4 py-3" style={{ background: "var(--surface-2)" }}>
                <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                  {t("lms.assessments.courseLevel")}
                </p>
              </div>
              <div className="p-4 space-y-2">
                {course.courseAssessments.map((assessment) => (
                  <AssessmentSummary key={assessment.id} assessment={assessment} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <AppButton variant="secondary" icon={X} onClick={onClose}>
          {t("lms.preview.close")}
        </AppButton>
      </div>
    </AppModal>
  );
}

function AssessmentSummary({ assessment }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg border p-3" style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}>
      <div className="flex items-center gap-2">
        <HelpCircle className="w-4 h-4 shrink-0" style={{ color: "var(--brand-blue)" }} />
        <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
          {t("lms.assessments.title")}: {assessment.title}
        </p>
      </div>
      <div className="flex flex-wrap gap-4 mt-2 text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
        <span>
          {t("lms.preview.passMark")}: {assessment.pass_mark != null ? `${assessment.pass_mark}%` : "—"}
        </span>
        <span>
          {assessment.is_required ? t("lms.preview.required") : t("lms.preview.optional")}
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        {(assessment.questions || []).map((q, index) => (
          <div key={q.id} className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
            {index + 1}. {q.question}
            <span className="ml-2 text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.preview.correctAnswer")}:{" "}
              {q.question_type === "true_false"
                ? t(`lms.questions.${String(q.correct_answer?.[0] || "")}`)
                : (q.correct_answer || []).join(", ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
