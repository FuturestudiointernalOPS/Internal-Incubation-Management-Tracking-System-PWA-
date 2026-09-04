"use client";

import { useState } from "react";
import { BookOpen, Film, HelpCircle, PlayCircle, X } from "lucide-react";
import CourseStatusBadge from "./CourseStatusBadge";
import { useI18n } from "@/lib/i18n";
import { isValidYouTubeVideoId } from "@/lib/lms/youtube";
import { formatDate } from "@/lib/constants";

/**
 * READ-ONLY COURSE PRESENTATION — the surface you land on when opening a
 * course from the admin list.
 *
 * Layout: the first lesson video plays in a box on the LEFT (click to launch
 * it, inline embed), and on its right sit the course name, its description and
 * the whole curriculum (sections → lessons → assessments). No editing controls
 * here — CourseEditor swaps this for the authoring form when "Edit" is pressed.
 */
export default function CourseView({ course }) {
  const { t } = useI18n();

  const sections = course.sections || [];
  const courseAssessments = course.courseAssessments || [];
  const lessons = sections.flatMap((s) => s.lessons || []);
  const lessonCount = lessons.length;
  const assessmentCount =
    sections.filter((s) => s.assessment).length + courseAssessments.length;
  const firstVideoLesson = lessons.find((l) => isValidYouTubeVideoId(l.youtube_video_id)) || null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
      {/* LEFT — first lesson video */}
      <div className="space-y-3 min-w-0">
        <VideoPlayer lesson={firstVideoLesson} />

        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] font-black uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          <span>
            {sections.length} {t("lms.preview.sections")}
          </span>
          <span>
            {lessonCount} {t("lms.preview.lessons")}
          </span>
          <span>
            {assessmentCount} {t("lms.preview.assessments")}
          </span>
          <span className={course.is_free ? "text-emerald-500" : "text-amber-500"}>
            {course.is_free
              ? t("lms.public.free")
              : `${t("lms.public.paid")} · ${Number(course.price || 0).toLocaleString()}`}
          </span>
          <span>
            {course.visibility === "private"
              ? t("lms.fields.visibilityPrivate")
              : t("lms.fields.visibilityPublic")}
          </span>
          {course.updated_at && (
            <span>
              {t("lms.fields.updatedAt")}: {formatDate(course.updated_at)}
            </span>
          )}
        </div>
      </div>

      {/* RIGHT — name, description, curriculum */}
      <div className="space-y-5 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-black uppercase tracking-tight" style={{ color: "var(--text-primary)" }}>
            {course.title || "—"}
          </h1>
          <CourseStatusBadge status={course.status} />
        </div>

        {course.description ? (
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            {course.description}
          </p>
        ) : (
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.courses.noDescription")}
          </p>
        )}

        <div className="pt-1">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "var(--text-secondary)" }}>
            {t("lms.preview.content")}
          </p>

          {sections.length === 0 ? (
            <div
              className="rounded-xl border-2 border-dashed py-10 flex flex-col items-center justify-center gap-2"
              style={{ borderColor: "var(--border-primary)" }}
            >
              <BookOpen className="w-6 h-6" style={{ color: "var(--text-tertiary)" }} />
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                {t("lms.sections.empty")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sections.map((section, si) => (
                <div
                  key={section.id}
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: "var(--border-primary)" }}
                >
                  <div className="flex items-center gap-3 px-4 py-3" style={{ background: "var(--surface-2)" }}>
                    <span className="text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: "var(--text-tertiary)" }}>
                      {si + 1}
                    </span>
                    <p className="text-xs font-black uppercase tracking-wider flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                      {section.title || "—"}
                    </p>
                    <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: "var(--text-tertiary)" }}>
                      {(section.lessons || []).length}{" "}
                      {t("lms.preview.lessons")}
                    </span>
                  </div>

                  <div className="p-2 space-y-0.5">
                    {(section.lessons || []).length === 0 && (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-center py-3" style={{ color: "var(--text-tertiary)" }}>
                        {t("lms.lessons.empty")}
                      </p>
                    )}
                    {(section.lessons || []).map((lesson) => (
                      <div key={lesson.id} className="flex items-center gap-3 px-2 py-2">
                        {isValidYouTubeVideoId(lesson.youtube_video_id) ? (
                          <PlayCircle className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                        ) : (
                          <Film className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                        )}
                        <span className="text-xs font-bold flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                          {lesson.title}
                        </span>
                        {lesson.is_required === false && (
                          <span
                            className="shrink-0 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest"
                            style={{
                              background: "var(--surface-3)",
                              color: "var(--text-tertiary)",
                            }}
                          >
                            {t("lms.lessons.optional")}
                          </span>
                        )}
                      </div>
                    ))}
                    {section.assessment && <AssessmentRow assessment={section.assessment} />}
                  </div>
                </div>
              ))}

              {courseAssessments.length > 0 && (
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border-primary)" }}>
                  <div className="px-4 py-3" style={{ background: "var(--surface-2)" }}>
                    <p className="text-xs font-black uppercase tracking-wider" style={{ color: "var(--text-primary)" }}>
                      {t("lms.sections.courseAssessments")}
                    </p>
                  </div>
                  <div className="p-2 space-y-0.5">
                    {courseAssessments.map((assessment) => (
                      <AssessmentRow key={assessment.id} assessment={assessment} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Inline first-video player. Shows the lesson's YouTube poster with a play
 * button; clicking embeds the player right there (autoplay). A close control
 * returns to the poster. Falls back to an empty state when no lesson video
 * exists yet (draft course).
 */
function VideoPlayer({ lesson }) {
  const { t } = useI18n();
  const [playing, setPlaying] = useState(false);
  const videoId = lesson && isValidYouTubeVideoId(lesson.youtube_video_id) ? lesson.youtube_video_id : null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border"
      style={{ aspectRatio: "16 / 9", background: "#000", borderColor: "var(--border-primary)" }}
    >
      {videoId && playing ? (
        <>
          <iframe
            className="absolute inset-0 w-full h-full"
            src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&color=white&autoplay=1`}
            title={lesson.title}
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
      ) : videoId ? (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          title={t("lms.courses.videoPlay")}
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
      ) : (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 px-4"
          style={{ background: "var(--surface-3)" }}
        >
          <Film className="w-8 h-8" style={{ color: "var(--text-tertiary)" }} />
          <p className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.courses.videoEmpty")}
          </p>
        </div>
      )}
    </div>
  );
}

/** Compact read-only assessment row (title, pass mark, optional/required, question count). */
function AssessmentRow({ assessment }) {
  const { t } = useI18n();
  const questionCount = (assessment.questions || []).length;
  return (
    <div
      className="flex items-center gap-3 px-2 py-2 rounded-lg"
      style={{ background: "var(--surface-2)" }}
    >
      <HelpCircle className="w-4 h-4 shrink-0" style={{ color: "var(--brand-blue)" }} />
      <span className="text-xs font-bold flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
        {assessment.title}
      </span>
      {questionCount > 0 && (
        <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: "var(--text-tertiary)" }}>
          {questionCount} {t("lms.preview.questions")}
        </span>
      )}
      <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: "var(--text-tertiary)" }}>
        {t("lms.preview.passMark")}: {assessment.pass_mark != null ? `${assessment.pass_mark}%` : "—"}
      </span>
      <span
        className="shrink-0 px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest"
        style={{
          background: "var(--surface-3)",
          color: "var(--text-tertiary)",
        }}
      >
        {assessment.is_required ? t("lms.preview.required") : t("lms.preview.optional")}
      </span>
    </div>
  );
}
