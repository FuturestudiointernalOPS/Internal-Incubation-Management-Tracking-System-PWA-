"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import LessonStateIcon from "@/components/lms/LessonStateIcon";
import RichTextContent from "@/components/ui/RichTextContent";
import { useI18n } from "@/lib/i18n";

/**
 * The lesson player's course-structure panel, extracted verbatim from
 * LearnerPlayer.js. It owns only its own fold state; the course payload, the
 * current lesson and the two navigation callbacks are handed down by the player.
 */

/** Course structure panel with lesson states + assessment links. */
export default function CourseContent({ data, currentLessonId, onSelect, onOpenAssessment }) {
  const { t } = useI18n();

  // The course description sits under the panel title, so the learner has the
  // course context without leaving the lesson.
  //
  // Same fold rule as the course overview: a section's lessons stay hidden until
  // asked for, except the section the learner is currently inside. The header
  // becomes the toggle — this panel is a navigation list, so only the lesson
  // list collapses.
  const [sectionToggles, setSectionToggles] = useState({});
  const currentSectionId = data.sections.find((section) =>
    (section.lessons || []).some((lesson) => String(lesson.id) === String(currentLessonId)),
  )?.id;
  const isSectionOpen = (section) =>
    sectionToggles[String(section.id)] ?? String(section.id) === String(currentSectionId);
  const toggleSection = (section) => {
    const key = String(section.id);
    setSectionToggles((previous) => ({
      ...previous,
      [key]: !(previous[key] ?? key === String(currentSectionId)),
    }));
  };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}>
      <div className="px-4 py-3" style={{ background: "var(--surface-2)" }}>
        <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          {t("lms.player.courseContent")}
        </p>
        {data.course?.description && (
          <RichTextContent
            value={data.course.description}
            className="text-[11px] mt-1"
            style={{ color: "var(--text-tertiary)" }}
          />
        )}
      </div>
      <div className="p-3 space-y-3 max-h-[70vh] overflow-y-auto">
        {data.sections.map((section, sectionIndex) => (
          <div key={section.id}>
            <button
              type="button"
              onClick={() => toggleSection(section)}
              aria-expanded={isSectionOpen(section)}
              className="w-full flex items-center gap-2 mb-1 px-1 text-left"
            >
              <ChevronDown
                className={`w-3 h-3 shrink-0 transition-transform ${isSectionOpen(section) ? "" : "-rotate-90"}`}
                style={{ color: "var(--text-tertiary)" }}
              />
              <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>
                {sectionIndex + 1}
              </span>
              <p className="text-[10px] font-black uppercase tracking-wider truncate flex-1" style={{ color: "var(--text-primary)" }}>
                {section.title}
              </p>
              <span className="text-[9px] font-bold" style={{ color: "var(--text-tertiary)" }}>
                {section.progress.completed}/{section.progress.total}
              </span>
            </button>
            {isSectionOpen(section) && (
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
            )}
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
