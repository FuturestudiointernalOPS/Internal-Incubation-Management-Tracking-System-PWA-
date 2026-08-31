"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PlayCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  AlertCircle,
  ListVideo,
  Film,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import LessonStateIcon from "./LessonStateIcon";
import LearnerProgressBar from "./LearnerProgressBar";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { isValidYouTubeVideoId } from "@/lib/lms/youtube";

/**
 * COURSE PLAYER (learner).
 * - Embedded YouTube (youtube-nocookie iframe) built from the stored video ID
 *   only — the learner never leaves ImpactOS and never sees a raw URL.
 * - Manual "Mark Lesson Complete" (explicit completion; YouTube playback events
 *   are deliberately NOT relied on — the learner can never get stuck).
 * - Progress persists server-side via /api/lms/lessons/[id]/complete.
 * - Desktop: video + course-content sidebar. Mobile: stacked with collapsible
 *   content panel.
 */
export default function LearnerPlayer({ courseId, lessonId }) {
  const { t } = useI18n();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);

  const fetchCourse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/learn`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "lms.errors.loadFailedCourse");
      setData(json);
    } catch (e) {
      setError(e.message || "lms.errors.loadFailedCourse");
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  // Ordered lesson list for prev/next navigation (assessments are not lessons).
  const lessons = useMemo(() => {
    if (!data) return [];
    return data.sections.flatMap((s) => s.lessons || []);
  }, [data]);

  const currentIndex = lessons.findIndex((l) => String(l.id) === String(lessonId));
  const lesson = currentIndex >= 0 ? lessons[currentIndex] : null;
  const prevLesson = currentIndex > 0 ? lessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < lessons.length - 1 ? lessons[currentIndex + 1] : null;

  const isCompleted = !!lesson && lesson.state === "completed";

  const complete = async () => {
    if (!lesson || isCompleted) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/lms/lessons/${lesson.id}/complete`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "lms.errors.saveFailed");
      notify("success", "lms.player.lessonCompleted");
      fetchCourse(); // refresh progress + states (server is the source of truth)
    } catch (e) {
      notify("error", "lms.player.saveProgressFailed");
      console.error("[LMS] complete error:", e);
    } finally {
      setCompleting(false);
    }
  };

  const go = (targetLesson) =>
    router.push(`/participant/learning/${courseId}/lessons/${targetLesson.id}`);

  const openAssessment = (assessmentId) =>
    router.push(`/participant/learning/${courseId}/assessments/${assessmentId}`);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-6 h-6 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data || !lesson) {
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

  const { course, progress } = data;
  const videoId = isValidYouTubeVideoId(lesson.youtube_video_id) ? lesson.youtube_video_id : null;

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.push(`/participant/learning/${course.id}`)}
          className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest self-start transition-colors"
          style={{ color: "var(--text-tertiary)" }}
        >
          ← {course.title}
        </button>
        <div className="flex items-center gap-3">
          <div className="w-32">
            <LearnerProgressBar percent={progress.percent} label={`${course.title} ${progress.percent}%`} />
          </div>
          <span className="text-xs font-black" style={{ color: "var(--text-primary)" }}>
            {progress.percent}%
          </span>
        </div>
      </div>

      {/* Completed banner */}
      {progress.complete && (
        <div
          className="flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{ background: "rgba(16,185,129,0.06)", borderColor: "rgba(16,185,129,0.25)" }}
        >
          <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: "var(--chart-success)" }} />
          <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--chart-success)" }}>
            {t("lms.player.courseCompletedBanner")}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        {/* Main column */}
        <div className="space-y-4 min-w-0">
          {/* Video */}
          <div
            className="relative w-full overflow-hidden rounded-2xl border"
            style={{ aspectRatio: "16 / 9", background: "#000", borderColor: "var(--border-primary)" }}
          >
            {videoId ? (
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&color=white`}
                title={lesson.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Film className="w-10 h-10" style={{ color: "var(--text-tertiary)" }} />
                <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
                  {t("lms.player.videoUnavailable")}
                </p>
              </div>
            )}
          </div>

          {/* Lesson meta */}
          <div className="rounded-xl border p-5" style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}>
            <div className="flex items-center gap-2">
              <LessonStateIcon state={lesson.state} />
              <h2 className="text-base font-black tracking-tight" style={{ color: "var(--text-primary)" }}>
                {lesson.title}
              </h2>
            </div>
            {lesson.description && (
              <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
                {lesson.description}
              </p>
            )}

            {/* Controls */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <AppButton
                variant="secondary"
                icon={ChevronLeft}
                disabled={!prevLesson}
                onClick={() => prevLesson && go(prevLesson)}
              >
                {t("lms.player.previous")}
              </AppButton>

              {isCompleted ? (
                <AppButton variant="success" icon={CheckCircle2} disabled>
                  {t("lms.player.completed")}
                </AppButton>
              ) : (
                <AppButton variant="primary" icon={CheckCircle2} loading={completing} onClick={complete}>
                  {t("lms.player.markComplete")}
                </AppButton>
              )}

              <AppButton
                variant="secondary"
                icon={ChevronRight}
                disabled={!nextLesson}
                onClick={() => nextLesson && go(nextLesson)}
              >
                {t("lms.player.next")}
              </AppButton>
            </div>
          </div>

          {/* Mobile content toggle */}
          <button
            type="button"
            onClick={() => setContentOpen((o) => !o)}
            className="lg:hidden w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[10px] font-black uppercase tracking-widest"
            style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}
          >
            <ListVideo className="w-4 h-4" />
            {t("lms.player.courseContent")}
          </button>
          {contentOpen && <CourseContent data={data} courseId={course.id} currentLessonId={lesson.id} onSelect={go} onOpenAssessment={openAssessment} />}
        </div>

        {/* Sidebar (desktop) */}
        <div className="hidden lg:block">
          <CourseContent data={data} courseId={course.id} currentLessonId={lesson.id} onSelect={go} onOpenAssessment={openAssessment} />
        </div>
      </div>
    </div>
  );
}

/** Course structure panel with lesson states + assessment links. */
function CourseContent({ data, courseId, currentLessonId, onSelect, onOpenAssessment }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}>
      <div className="px-4 py-3" style={{ background: "var(--surface-2)" }}>
        <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {t("lms.player.courseContent")}
        </p>
      </div>
      <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
        {data.sections.map((section, si) => (
          <div key={section.id}>
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                {si + 1}
              </span>
              <p className="text-[10px] font-black uppercase tracking-wider truncate flex-1" style={{ color: "var(--text-primary)" }}>
                {section.title}
              </p>
              <span className="text-[9px] font-bold" style={{ color: "var(--text-tertiary)" }}>
                {section.progress.completed}/{section.progress.total}
              </span>
            </div>
            <div className="space-y-0.5">
              {section.lessons.map((lesson) => {
                const isCurrent = String(lesson.id) === String(currentLessonId);
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => onSelect(lesson)}
                    className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors"
                    style={{
                      background: isCurrent ? "var(--surface-3)" : "transparent",
                      color: "var(--text-primary)",
                    }}
                    aria-current={isCurrent ? "true" : undefined}
                  >
                    <LessonStateIcon state={isCurrent ? "current" : lesson.state} />
                    <span className="text-xs font-bold truncate flex-1">{lesson.title}</span>
                  </button>
                );
              })}
              {section.assessment && (
                <SidebarAssessmentRow
                  t={t}
                  assessment={section.assessment}
                  onOpen={onOpenAssessment}
                />
              )}
            </div>
          </div>
        ))}
        {data.courseAssessments?.map((assessment) => (
          <SidebarAssessmentRow key={assessment.id} t={t} assessment={assessment} onOpen={onOpenAssessment} />
        ))}
      </div>
    </div>
  );
}

/** Assessment link in the sidebar with learner state. */
function SidebarAssessmentRow({ t, assessment, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(assessment.id)}
      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors"
      style={{ color: "var(--text-primary)" }}
    >
      <HelpCircle className="w-4 h-4 shrink-0" style={{ color: "var(--brand-blue)" }} />
      <span className="text-xs font-bold truncate flex-1">{assessment.title}</span>
      {assessment.passed ? (
        <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: "var(--chart-success)" }}>
          ✓
        </span>
      ) : assessment.attempted ? (
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
