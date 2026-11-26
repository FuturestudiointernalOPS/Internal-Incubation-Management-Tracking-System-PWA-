"use client";

import { useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Film, HelpCircle, ImageIcon, PlayCircle } from "lucide-react";
import CourseStatusBadge from "./CourseStatusBadge";
import EmbeddedVideo from "./EmbeddedVideo";
import SectionResourcesList from "./SectionResourcesList";
import RichTextContent from "@/components/ui/RichTextContent";
import { useI18n } from "@/lib/i18n";
import { isValidYouTubeVideoId } from "@/models/lms/youtube";
import { formatDate } from "@/lib/constants";

/**
 * READ-ONLY COURSE PRESENTATION — the surface you land on when opening a
 * course from the admin list.
 *
 * Layout: the course IMAGE sits in the box on the LEFT. On its right sit the
 * course name, its description and the whole curriculum (chapters → lessons →
 * assessments). Videos live inside the chapters: a lesson that carries one
 * opens its player inline when clicked. No editing controls here —
 * CourseEditor swaps this for the authoring form when "Edit" is pressed.
 */
export default function CourseView({ course }) {
  const { t } = useI18n();

  const sections = course.sections || [];
  const courseAssessments = course.courseAssessments || [];
  const lessons = sections.flatMap((section) => section.lessons || []);
  const lessonCount = lessons.length;
  const assessmentCount =
    sections.filter((section) => section.assessment).length + courseAssessments.length;
  const [openSectionIds, setOpenSectionIds] = useState(() => new Set());
  const [openLessonIds, setOpenLessonIds] = useState(() => new Set());
  const toggleIn = (setter) => (id) =>
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleSection = toggleIn(setOpenSectionIds);
  const toggleLesson = toggleIn(setOpenLessonIds);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-6 items-start">
      {/* LEFT — course image */}
      <div className="space-y-3 min-w-0">
        <CourseImage course={course} />

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
          <RichTextContent
            value={course.description}
            className="text-sm leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          />
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
              {sections.map((section, sectionIndex) => (
                <div
                  key={section.id}
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: "var(--border-primary)" }}
                >
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                    style={{ background: "var(--surface-2)" }}
                    onClick={() => toggleSection(section.id)}
                  >
                    {openSectionIds.has(section.id) ? (
                      <ChevronUp className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                    ) : (
                      <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                    )}
                    <span className="text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: "var(--text-tertiary)" }}>
                      {sectionIndex + 1}
                    </span>
                    <p className="text-xs font-black uppercase tracking-wider flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
                      {section.title || "—"}
                    </p>
                    <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: "var(--text-tertiary)" }}>
                      {(section.lessons || []).length}{" "}
                      {t("lms.preview.lessons")}
                    </span>
                  </div>

                  {openSectionIds.has(section.id) && (
                    <>
                  {section.description ? (
                    <div className="px-4 pt-3">
                      <RichTextContent
                        value={section.description}
                        className="text-xs"
                        style={{ color: "var(--text-secondary)" }}
                      />
                    </div>
                  ) : null}

                  {(section.resources || []).length > 0 && (
                    <div className="px-4 pt-3">
                      <SectionResourcesList resources={section.resources} />
                    </div>
                  )}

                  <div className="p-2 space-y-0.5">
                    {(section.lessons || []).length === 0 && (
                      <p className="text-[10px] font-bold uppercase tracking-wider text-center py-3" style={{ color: "var(--text-tertiary)" }}>
                        {t("lms.lessons.empty")}
                      </p>
                    )}
                    {(section.lessons || []).map((lesson) => {
                      const hasVideo = isValidYouTubeVideoId(lesson.youtube_video_id);
                      const isOpen = openLessonIds.has(lesson.id);
                      return (
                        <div key={lesson.id} className="px-2 py-2">
                          <div
                            className="flex items-start gap-3 cursor-pointer"
                            onClick={() => toggleLesson(lesson.id)}
                          >
                            {isOpen ? (
                              <ChevronUp className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--text-tertiary)" }} />
                            ) : (
                              <ChevronDown className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--text-tertiary)" }} />
                            )}
                            {hasVideo ? (
                              <PlayCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--brand-blue)" }} />
                            ) : (
                              <Film className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--text-tertiary)" }} />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
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
                              <RichTextContent
                                value={lesson.description}
                                className="text-[11px] mt-1"
                                style={{ color: "var(--text-tertiary)" }}
                              />
                            </div>
                          </div>
                          {isOpen && (
                            <div className="mt-3 max-w-sm">
                              {hasVideo ? (
                                <EmbeddedVideo
                                  key={lesson.youtube_video_id}
                                  videoId={lesson.youtube_video_id}
                                  title={lesson.title}
                                  playLabel={t("lms.courses.videoPlay")}
                                />
                              ) : (
                                <p className="text-[10px] font-bold uppercase tracking-wider py-2" style={{ color: "var(--text-tertiary)" }}>
                                  {t("lms.courses.videoLessonEmpty")}
                                </p>
                              )}
                            </div>
                          )}
                          {isOpen && (lesson.resources || []).length > 0 && (
                            <div className="mt-3">
                              <SectionResourcesList resources={lesson.resources} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {section.assessment && <AssessmentRow assessment={section.assessment} />}
                  </div>
                    </>
                  )}
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

/** The course image (thumbnail); a neutral placeholder while none is set. */
function CourseImage({ course }) {
  const { t } = useI18n();

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border"
      style={{ aspectRatio: "16 / 9", borderColor: "var(--border-primary)", background: "var(--surface-3)" }}
    >
      {course.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={course.thumbnail_url} alt={course.title || ""} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4">
          <ImageIcon className="w-8 h-8" style={{ color: "var(--text-tertiary)" }} />
          <p className="text-[10px] font-bold uppercase tracking-wider text-center" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.courses.imageEmpty")}
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
