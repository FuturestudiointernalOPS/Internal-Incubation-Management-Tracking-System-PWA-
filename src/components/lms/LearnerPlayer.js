"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  X,
} from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import LessonStateIcon from "./LessonStateIcon";
import LearnerProgressBar from "./LearnerProgressBar";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { isValidYouTubeVideoId, buildYouTubeEmbedUrl } from "@/lib/lms/youtube";

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
  const [justCompleted, setJustCompleted] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const completeTimer = useRef(null);

  useEffect(() => () => clearTimeout(completeTimer.current), []);

  // The video starts on a clean poster (no YouTube chrome); it is only
  // embedded once the learner clicks play. Switching lessons resets it.
  useEffect(() => {
    setPlaying(false);
  }, [lessonId]);

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

  /** Refresh course data in the background — no full-page loading flash. */
  const refreshSilently = useCallback(async () => {
    try {
      const res = await fetch(`/api/lms/courses/${courseId}/learn`);
      const json = await res.json();
      if (json.success) setData(json);
    } catch {
      /* best-effort background refresh */
    }
  }, [courseId]);

  const complete = async () => {
    if (!lesson || isCompleted || completing || justCompleted) return;
    setCompleting(true);
    try {
      const res = await fetch(`/api/lms/lessons/${lesson.id}/complete`, { method: "POST" });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "lms.errors.saveFailed");
      // Update the page behind the overlay, then confirm with the check badge.
      await refreshSilently();
      setCompleting(false);
      setJustCompleted(true);
      if (json.courseCompleted && json.certificate) {
        notify("success", "lms.certificate.courseCompleted");
      }
      completeTimer.current = setTimeout(() => setJustCompleted(false), 2600);
    } catch (e) {
      setCompleting(false);
      notify("error", "lms.player.saveProgressFailed");
      console.error("[LMS] complete error:", e);
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

  // The assessment that follows this lesson, when there is one: the current
  // section's assessment after its last lesson, else the first course-level
  // assessment after the very last lesson. Surfaced as its own CTA so the
  // learner does not have to find it in the sidebar.
  const currentSection = data.sections.find((s) =>
    (s.lessons || []).some((l) => String(l.id) === String(lessonId)),
  );
  const isSectionLast =
    !!currentSection &&
    currentSection.lessons.length > 0 &&
    String(currentSection.lessons[currentSection.lessons.length - 1].id) === String(lessonId);
  const isCourseLast = currentIndex >= 0 && currentIndex === lessons.length - 1;
  const upcomingAssessment =
    isSectionLast && currentSection?.assessment
      ? currentSection.assessment
      : isCourseLast && (data.courseAssessments || []).length > 0
        ? data.courseAssessments[0]
        : null;

  return (
    <div className="relative max-w-6xl mx-auto space-y-4">
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
              playing ? (
                <>
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={buildYouTubeEmbedUrl(videoId, { autoplay: true, loop: true })}
                    title={lesson.title}
                    frameBorder="0"
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
                  title={t("lms.player.playVideo")}
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
                    className="relative z-10 flex items-center justify-center w-16 h-16 rounded-full transition-transform group-hover:scale-110"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                  >
                    <PlayCircle className="w-9 h-9" style={{ color: "rgba(255,255,255,0.95)" }} />
                  </span>
                </button>
              )
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

          {/* Up-next assessment CTA (last lesson of a section / of the course) */}
          {upcomingAssessment && (
            <div
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border px-4 py-3"
              style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <HelpCircle className="w-5 h-5 shrink-0" style={{ color: "var(--brand-blue)" }} />
                <div className="min-w-0">
                  <p className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                    {t("lms.player.upNext")}
                  </p>
                  <p className="text-xs font-black truncate" style={{ color: "var(--text-primary)" }}>
                    {upcomingAssessment.title}
                  </p>
                </div>
              </div>
              {upcomingAssessment.passed ? (
                <AppButton variant="success" icon={CheckCircle2} disabled>
                  {t("lms.assessment.passed")}
                </AppButton>
              ) : (
                <AppButton
                  variant="primary"
                  icon={HelpCircle}
                  onClick={() => openAssessment(upcomingAssessment.id)}
                >
                  {upcomingAssessment.attempted
                    ? t("lms.assessment.tryAgain")
                    : t("lms.player.startAssessment")}
                </AppButton>
              )}
            </div>
          )}

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

      {/* In-place completion feedback: blur the page, confirm, then fade back. */}
      {(completing || justCompleted) && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center rounded-xl"
          style={{ background: "rgba(127,127,127,0.12)", backdropFilter: "blur(3px)" }}
          aria-live="polite"
        >
          <div
            className="flex items-center gap-3 rounded-2xl border px-6 py-4"
            style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
          >
            {completing ? (
              <>
                <span className="w-5 h-5 border-2 border-[var(--brand-orange)] border-t-transparent rounded-full animate-spin shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
                  {t("lms.player.saving")}
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: "var(--chart-success)" }} />
                <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--chart-success)" }}>
                  {t("lms.player.lessonCompleted")}
                </p>
              </>
            )}
          </div>
        </div>
      )}
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
