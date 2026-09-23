"use client";

import { useRouter } from "next/navigation";
import { BookOpen, PlayCircle, CheckCircle2, AlertCircle, Award } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import LearnerProgressBar from "./LearnerProgressBar";
import CourseThumb from "./CourseThumb";
import LearnerCoachingButton from "./LearnerCoachingButton";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

/**
 * MY LEARNING — enrolled courses with progress and Continue Learning.
 * Access is enrollment-derived (server-side); empty state when unenrolled.
 */

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are built once here
// rather than on every render.

const EMPTY_MY_LEARNING = { list: [], failure: false };

/**
 * The enrolled courses, together with whether the read was refused. Both ways
 * the loader could fail - the payload refusing and the request never being
 * answered - were shown as the same panel, so the shaper reports the refusal and
 * the panel keeps its message.
 */
const pickMyLearning = (data) =>
  data?.success
    ? { list: data.courses || [], failure: false }
    : { list: [], failure: true };

export default function LearnerLearning() {
  const { t } = useI18n();
  const router = useRouter();

  // The list is read through the shared hook, which owns the cache, the
  // cache-first paint and the discarding of a stale answer, so the screen keeps
  // no copy of its own. The retry button re-reads through `refresh`, which
  // bypasses the cache.
  const {
    data: coursesRead,
    loading,
    error: readError,
    refresh,
  } = useApi("/api/lms/my-learning", {
    defaultValue: EMPTY_MY_LEARNING,
    transform: pickMyLearning,
  });
  const courses = coursesRead.list;

  // The loader's failure flag, derived: the payload refusing or a request that
  // never answered.
  const error = Boolean(coursesRead.failure || readError);

  const openCourse = (course, continueLesson) => {
    if (continueLesson) {
      router.push(`/participant/learning/${course.id}/lessons/${continueLesson.lessonId}`);
    } else {
      router.push(`/participant/learning/${course.id}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
          {t("lms.learning.title")}
        </h1>
        {/* Phase 8 — ask for coaching around a course (blinking CTA). */}
        <LearnerCoachingButton />
      </div>

      {loading ? (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="h-44 rounded-xl animate-pulse"
              style={{ background: "var(--surface-2)" }}
            />
          ))}
        </div>
      ) : error ? (
        <div className="mt-6 flex flex-col items-center gap-4 py-16">
          <AlertCircle className="w-8 h-8 text-rose-500" />
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            {t("lms.learning.loadFailed")}
          </p>
          <AppButton variant="secondary" onClick={refresh}>
            {t("common.refresh")}
          </AppButton>
        </div>
      ) : courses.length === 0 ? (
        <div className="mt-6">
          <AppEmptyState
            title={t("lms.learning.emptyTitle")}
            description={t("lms.learning.emptyDescription")}
            icon={BookOpen}
          />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map(({ course, progress, continueLesson, certificate }) => (
            <div
              key={course.id}
              className="rounded-xl border overflow-hidden"
              style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
            >
              <div className="flex items-center gap-4 p-5">
                <CourseThumb
                  src={course.thumbnail_url}
                  alt={course.title}
                  className="w-16 h-16 rounded-xl"
                  iconClassName="w-7 h-7"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black tracking-tight truncate" style={{ color: "var(--text-primary)" }}>
                    {course.title}
                  </p>
                  <p
                    className="mt-1 text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: progress.complete ? "var(--chart-success)" : "var(--text-tertiary)" }}
                  >
                    {progress.complete
                      ? t("lms.learning.courseCompleted")
                      : progress.status === "in_progress"
                        ? t("lms.learning.inProgress")
                        : t("lms.learning.notStarted")}
                  </p>
                </div>
                {progress.complete && (
                  <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--chart-success)" }} />
                )}
              </div>

              <div className="px-5 pb-5">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <LearnerProgressBar
                    percent={progress.percent}
                    label={`${course.title} ${progress.percent}%`}
                  />
                  <span className="text-xs font-black shrink-0" style={{ color: "var(--text-primary)" }}>
                    {progress.percent}%
                  </span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  {t("lms.learning.completedLessons", {
                    completed: progress.completedLessons,
                    total: progress.totalLessons,
                  })}
                </p>

                {certificate && (
                  <div className="mt-3 flex items-center gap-2">
                    <Award className="w-4 h-4 shrink-0" style={{ color: "var(--brand-orange)" }} />
                    <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--brand-orange)" }}>
                      {t("lms.certificate.available")}
                    </p>
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {continueLesson ? (
                    <AppButton
                      variant="primary"
                      icon={PlayCircle}
                      onClick={() => openCourse(course, continueLesson)}
                    >
                      {t("lms.learning.continue")}
                    </AppButton>
                  ) : certificate ? (
                    <>
                      <AppButton variant="primary" icon={Award} onClick={() => openCourse(course, null)}>
                        {t("lms.certificate.view")}
                      </AppButton>
                      <AppButton variant="secondary" icon={BookOpen} onClick={() => openCourse(course, null)}>
                        {t("lms.learning.review")}
                      </AppButton>
                    </>
                  ) : (
                    <AppButton variant="secondary" icon={BookOpen} onClick={() => openCourse(course, null)}>
                      {t("lms.learning.review")}
                    </AppButton>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
