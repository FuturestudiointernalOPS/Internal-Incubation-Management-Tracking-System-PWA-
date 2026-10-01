"use client";

import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Film,
  HelpCircle,
  CheckCircle2,
  GripVertical,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AppButton from "@/components/ui/AppButton";
import RichTextContent from "@/components/ui/RichTextContent";
import SectionResourcesPanel from "../SectionResourcesPanel";
import AssessmentCard from "./AssessmentCard";

/**
 * ONE section card, sortable with dnd-kit. The whole card is the drag node (so
 * the other cards animate around it), but only the grip handle is the activator
 * — the title, the buttons and the lesson rows stay clickable.
 * Extracted verbatim from SectionsManager, which passes `t` and the handlers.
 */
export default function SortableSection({
  section,
  index,
  courseId,
  canEdit,
  collapsed,
  onToggleCollapse,
  insertEdge,
  savingId,
  t,
  onEditSection,
  onDeleteSection,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onMoveLesson,
  onAddAssessment,
  onViewAssessment,
  onEditAssessment,
  onDeleteAssessment,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(section.id) });

  return (
    <div
      ref={setNodeRef}
      className="relative rounded-xl border overflow-hidden"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        borderColor: "var(--border-primary)",
        // Dragging must not also scroll the page or select text.
        touchAction: "manipulation",
      }}
    >
      {/* Insertion line — where the card will land. */}
      {insertEdge && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 right-0 z-10"
          style={{
            height: 2,
            background: "var(--brand-orange)",
            boxShadow: "0 0 8px var(--brand-orange)",
            [insertEdge]: 0,
          }}
        />
      )}

      {/* Section header */}
      <div
        className="flex items-center gap-2 px-4 py-3 flex-wrap"
        style={{ background: "var(--surface-2)" }}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          title={t("lms.sections.dragToReorder")}
          aria-label={t("lms.sections.dragToReorder")}
          className="p-1.5 rounded-lg cursor-grab active:cursor-grabbing transition-colors"
          style={{ color: "var(--text-tertiary)", touchAction: "none" }}
        >
          <GripVertical className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? t("lms.sections.expand") : t("lms.sections.collapse")}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-tertiary)" }}
        >
          {collapsed ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronUp className="w-4 h-4" />
          )}
        </button>
        <p className="text-[9px] font-black uppercase tracking-widest shrink-0" style={{ color: "var(--text-tertiary)" }}>
          {index + 1}
        </p>
        <p className="text-xs font-black uppercase tracking-wider flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
          {section.title}
        </p>
        {section.lessons.length > 0 && (
          <span className="text-[9px] font-black uppercase tracking-wider shrink-0" style={{ color: "var(--text-tertiary)" }}>
            {section.lessons.length} {t("lms.preview.lessons")}
          </span>
        )}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEditSection}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            title={t("lms.sections.edit")}
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onDeleteSection}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-tertiary)" }}
            title={t("lms.sections.delete")}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Section description — visible as soon as it is written, collapsed or not. */}
      {section.description ? (
        <div className="px-4 pt-3">
          <RichTextContent
            value={section.description}
            className="text-xs"
            style={{ color: "var(--text-secondary)" }}
          />
        </div>
      ) : null}

      {/* Lessons */}
      {!collapsed && (
        <div className="p-4 space-y-2">
          {section.lessons.length === 0 ? (
            <p className="text-[10px] font-bold uppercase tracking-wider py-3 text-center" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.lessons.emptyHint")}
            </p>
          ) : (
            section.lessons.map((lesson, lessonIndex) => (
              <div
                key={lesson.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
                style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
              >
                <Film className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                    {lessonIndex + 1}. {lesson.title}
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
                  <RichTextContent
                    value={lesson.description}
                    className="text-[11px] mt-1"
                    style={{ color: "var(--text-tertiary)" }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveLesson(lesson, "up")}
                    disabled={lessonIndex === 0 || savingId === lesson.id}
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                    style={{ color: "var(--text-tertiary)" }}
                    title={t("lms.lessons.moveUp")}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveLesson(lesson, "down")}
                    disabled={lessonIndex === section.lessons.length - 1 || savingId === lesson.id}
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                    style={{ color: "var(--text-tertiary)" }}
                    title={t("lms.lessons.moveDown")}
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditLesson(lesson)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                    title={t("lms.lessons.edit")}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteLesson(lesson)}
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
            <AppButton variant="secondary" size="sm" icon={Plus} onClick={onAddLesson}>
              {t("lms.sections.addLesson")}
            </AppButton>
            {!section.assessment && (
              <AppButton variant="ghost" size="sm" icon={HelpCircle} onClick={onAddAssessment}>
                {t("lms.sections.addAssessment")}
              </AppButton>
            )}
          </div>

          {/* Section assessment */}
          {section.assessment && (
            <AssessmentCard
              assessment={section.assessment}
              t={t}
              onView={() => onViewAssessment(section.assessment)}
              onEdit={() => onEditAssessment(section.assessment)}
              onDelete={() => onDeleteAssessment(section.assessment)}
              className="mt-2"
            />
          )}

          {/* Section material (documents + videos) */}
          <SectionResourcesPanel courseId={courseId} sectionId={section.id} canEdit={canEdit} />
        </div>
      )}
    </div>
  );
}
