"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, PlayCircle, CheckCircle2, AlertCircle } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import LearnerProgressBar from "./LearnerProgressBar";
import { useI18n } from "@/lib/i18n";

/**
 * MY LEARNING — enrolled courses with progress and Continue Learning.
 * Access is enrollment-derived (server-side); empty state when unenrolled.
 */
export default function LearnerLearning() {
  const { t } = useI18n();
  const router = useRouter();
  const [courses, setCourses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchCourses = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/lms/my-learning");
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "lms.learning.loadFailed");
      setCourses(data.courses || []);
    } catch (e) {
      console.error("[LMS] my-learning error:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const openCourse = (course, continueLesson) => {
    if (continueLesson) {
      router.push(`/participant/learning/${course.id}/lessons/${continueLesson.lessonId}`);
    } else {
      router.push(`/participant/learning/${course.id}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-black uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
        {t("lms.learning.title")}
      </h1>

      {loading ? (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div
              key={i}
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
          <AppButton variant="secondary" onClick={fetchCourses}>
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
          {courses.map(({ course, enrollment, progress, continueLesson }) => (
            <div
              key={course.id}
              className="rounded-xl border overflow-hidden"
              style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
            >
              <div className="flex items-center gap-4 p-5">
                {course.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.thumbnail_url}
                    alt=""
                    className="w-16 h-16 rounded-xl object-cover shrink-0"
                  />
                ) : (
                  <div
                    className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "var(--surface-3)" }}
                  >
                    <BookOpen className="w-7 h-7" style={{ color: "var(--text-tertiary)" }} />
                  </div>
                )}
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

                <div className="mt-4">
                  {continueLesson ? (
                    <AppButton
                      variant="primary"
                      icon={PlayCircle}
                      onClick={() => openCourse(course, continueLesson)}
                    >
                      {t("lms.learning.continue")}
                    </AppButton>
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
