"use client";

import { useRouter } from "next/navigation";
import { PlayCircle, AlertCircle, HelpCircle, CheckCircle2, XCircle } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import LearnerProgressBar from "./LearnerProgressBar";
import LessonStateIcon from "./LessonStateIcon";
import CertificateCard from "./CertificateCard";
import CourseThumb from "./CourseThumb";
import LearnerCoachingButton from "./LearnerCoachingButton";
import SectionResourcesList from "./SectionResourcesList";
import RichTextContent from "@/components/ui/RichTextContent";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

/**
 * COURSE OVERVIEW (learner) — progress, sections, lessons, resume point.
 * Access is enrollment-derived (server-side).
 */

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are built once here
// rather than on every render.

const EMPTY_COURSE_READ = { payload: null, failure: null };

/**
 * The course overview, together with the reason it is missing. A refusal carries
 * the server's own key (lms.errors.notEnrolled is the one the panel has wording
 * for) and both it and a request that never answered are translated where they
 * are shown.
 */
const pickCourse = (d) =>
  d?.success
    ? { payload: d, failure: null }
    : { payload: null, failure: d?.error || null };

export default function LearnerCourse({ courseId }) {
  const { t } = useI18n();
  const router = useRouter();

  // The overview arrives in ONE payload and is read through the shared hook,
  // which owns the cache, the cache-first paint and the discarding of a stale
  // answer, so the screen keeps no copy of its own.
  const {
    data: courseRead,
    loading,
    error: readError,
  } = useApi(`/api/lms/courses/${courseId}/learn`, {
    defaultValue: EMPTY_COURSE_READ,
    transform: pickCourse,
    deps: [courseId],
  });
  const data = courseRead.payload;

  // The loader showed the server's own key when it refused a payload and the
  // request's message when there was no answer; the panel translates whichever
  // arrives, with the same fallback as before.
  const error = courseRead.failure || readError || null;

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <AlertCircle className="w-8 h-8 text-rose-500" />
        <p className="text-xs font-bold uppercase tracking-wider max-w-sm" style={{ color: "var(--text-secondary)" }}>
          {t(error === "lms.errors.notEnrolled" ? "lms.player.noAccess" : error || "lms.errors.loadFailedCourse")}
        </p>
        <AppButton variant="secondary" onClick={() => router.push("/participant/learning")}>
          {t("lms.learning.title")}
        </AppButton>
      </div>
    );
  }

  const { course, progress, continueLesson, sections, certificate } = data;

  const openLesson = (lessonId) =>
    router.push(`/participant/learning/${course.id}/lessons/${lessonId}`);

  const openAssessment = (assessmentId) =>
    router.push(`/participant/learning/${course.id}/assessments/${assessmentId}`);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => router.push("/participant/learning")}
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest self-start transition-colors"
          style={{ color: "var(--text-tertiary)" }}
        >
          ← {t("lms.learning.title")}
        </button>
        {course.thumbnail_url && (
          <CourseThumb
            src={course.thumbnail_url}
            alt={course.title}
            className="w-full h-36 sm:h-44 rounded-xl"
            iconClassName="w-10 h-10"
          />
        )}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-black uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
              {course.title}
            </h1>
            {/* Phase 8 — coaching request tied to THIS course. */}
            <LearnerCoachingButton courseId={course.id} />
          </div>
          {course.description && (
            <RichTextContent
              value={course.description}
              className="text-xs mt-2 max-w-2xl"
              style={{ color: "var(--text-secondary)" }}
            />
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="rounded-xl border p-5" style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            {t("lms.learning.progress")}
          </span>
          <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
            {progress.percent}%
          </span>
        </div>
        <LearnerProgressBar percent={progress.percent} label={`${course.title} ${progress.percent}%`} />
        <p className="text-[10px] font-bold uppercase tracking-wider mt-2" style={{ color: "var(--text-tertiary)" }}>
          {t("lms.learning.completedLessons", {
            completed: progress.completedLessons,
            total: progress.totalLessons,
          })}
        </p>
        {progress.complete ? (
          <div className="mt-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" style={{ color: "var(--chart-success)" }} />
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--chart-success)" }}>
              {t("lms.learning.courseCompleted")}
            </p>
          </div>
        ) : (
          continueLesson && (
            <AppButton
              className="mt-4"
              variant="primary"
              icon={PlayCircle}
              onClick={() => openLesson(continueLesson.lessonId)}
            >
              {t("lms.learning.continue")}
            </AppButton>
          )
        )}
      </div>

      {/* Certificate — available once the course is completed */}
      {certificate && <CertificateCard certificate={certificate} />}

      {/* Sections */}
      <div className="space-y-3">
        {sections.map((section, si) => (
          <div key={section.id} className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-primary)" }}>
            <div
              className="flex items-center gap-3 px-4 py-3 flex-wrap"
              style={{ background: "var(--surface-2)" }}
            >
              <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                {si + 1}
              </p>
              <p className="text-xs font-black uppercase tracking-wider flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                {section.title}
              </p>
              <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                {section.progress.completed} / {section.progress.total}
              </span>
              {section.lessons.length > 0 &&
                section.progress.completed === section.progress.total && (
                  <CheckCircle2 className="w-4 h-4" style={{ color: "var(--chart-success)" }} />
                )}
            </div>

            {section.description && (
              <div className="px-4 pt-3">
                <RichTextContent
                  value={section.description}
                  className="text-xs"
                  style={{ color: "var(--text-secondary)" }}
                />
              </div>
            )}

            {(section.resources || []).length > 0 && (
              <div className="px-4 pt-3">
                <SectionResourcesList resources={section.resources} />
              </div>
            )}

            <div className="p-3 space-y-1">
              {section.lessons.length === 0 && (
                <p className="text-[10px] font-bold uppercase tracking-wider text-center py-2" style={{ color: "var(--text-tertiary)" }}>
                  {t("lms.lessons.empty")}
                </p>
              )}
              {section.lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openLesson(lesson.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openLesson(lesson.id);
                    }
                  }}
                  className="w-full px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer"
                  style={{
                    background: lesson.state === "current" ? "var(--surface-3)" : "transparent",
                    color: "var(--text-primary)",
                  }}
                >
                  <div className="flex items-center gap-3">
                    <LessonStateIcon state={lesson.state} />
                    <span className="text-xs font-bold truncate flex-1">{lesson.title}</span>
                    {!lesson.is_required && (
                      <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: "var(--text-tertiary)" }}>
                        {t("lms.lessons.optional")}
                      </span>
                    )}
                  </div>
                  <RichTextContent
                    value={lesson.description}
                    className="text-[11px] mt-1 pl-6"
                    style={{ color: "var(--text-tertiary)" }}
                  />
                </div>
              ))}
              {section.assessment && (
                <AssessmentRow
                  t={t}
                  assessment={section.assessment}
                  onOpen={openAssessment}
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Course-level assessments */}
      {data.courseAssessments?.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-primary)" }}>
          <div className="px-4 py-3" style={{ background: "var(--surface-2)" }}>
            <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
              {t("lms.sections.courseAssessments")}
            </p>
          </div>
          <div className="p-3 space-y-1">
            {data.courseAssessments.map((assessment) => (
              <AssessmentRow key={assessment.id} t={t} assessment={assessment} onOpen={openAssessment} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Assessment row with learner state: ✓ passed / ✕ try again / ○ start. */
function AssessmentRow({ t, assessment, onOpen }) {
  const passed = assessment.passed;
  const attempted = assessment.attempted;
  return (
    <button
      type="button"
      onClick={() => onOpen(assessment.id)}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors mt-1"
      style={{ background: "var(--surface-2)", color: "var(--text-primary)" }}
    >
      {passed ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "var(--chart-success)" }} />
      ) : attempted ? (
        <XCircle className="w-4 h-4 shrink-0" style={{ color: "var(--chart-danger)" }} />
      ) : (
        <HelpCircle className="w-4 h-4 shrink-0" style={{ color: "var(--brand-blue)" }} />
      )}
      <span className="text-xs font-bold truncate flex-1" style={{ color: "var(--text-primary)" }}>
        {t("lms.assessments.title")}: {assessment.title}
      </span>
      {passed ? (
        <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: "var(--chart-success)" }}>
          {t("lms.assessment.passed")}
          {assessment.bestPercent != null ? ` ${assessment.bestPercent}%` : ""}
        </span>
      ) : attempted ? (
        <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: "var(--chart-danger)" }}>
          {t("lms.assessment.tryAgain")}
        </span>
      ) : (
        <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: "var(--brand-blue)" }}>
          {t("lms.assessment.start")}
        </span>
      )}
    </button>
  );
}
