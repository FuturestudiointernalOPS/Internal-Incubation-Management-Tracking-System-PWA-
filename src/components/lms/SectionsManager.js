"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  Film,
  HelpCircle,
  CheckCircle2,
  ListVideo,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppModal from "@/components/ui/AppModal";
import RichTextEditor from "@/components/ui/RichTextEditor";
import RichTextContent from "@/components/ui/RichTextContent";
import LessonModal from "./LessonModal";
import AssessmentModal from "./AssessmentModal";
import AssessmentViewModal from "./AssessmentViewModal";
import SectionResourcesPanel from "./SectionResourcesPanel";
import { notify } from "./notify";
import { useI18n } from "@/lib/i18n";
import { useDialogs } from "@/components/ui/DialogProvider";

/**
 * Section/lesson/assessment authoring area of the course editor.
 * All mutations go through the LMS API (server-side lms.edit authorization).
 *
 * Sections are reordered by dragging the grip handle (dnd-kit): pointer events
 * cover mouse, touch and pen, the keyboard sensor moves a focused section with
 * the arrow keys, the dragged card is dimmed, a line marks the exact slot, and
 * the other cards animate to their new place. The drop sends the whole new
 * order to the server, which validates and persists it.
 */
export default function SectionsManager({ course, onChange, canEdit = true }) {
  const { t } = useI18n();
  const { confirm } = useDialogs();
  const [sectionModal, setSectionModal] = useState(null); // { mode, section }
  const [lessonModal, setLessonModal] = useState(null); // { mode, sectionId, lesson }
  const [assessmentModal, setAssessmentModal] = useState(null); // { mode, sectionId, assessment }
  const [viewAssessment, setViewAssessment] = useState(null); // assessment shown in read-only view
  const [savingId, setSavingId] = useState(null);

  const api = async (url, method, body) => {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "lms.errors.saveFailed");
    return data;
  };

  const mutate = async (url, method, body, successKey = "lms.courses.saved", id = null) => {
    setSavingId(id);
    try {
      await api(url, method, body);
      notify("success", successKey);
      onChange();
    } catch (e) {
      notify("error", e.message || "lms.errors.saveFailed");
    } finally {
      setSavingId(null);
    }
  };

  // ── Collapse (sections start collapsed) ───────────────────────────────────
  // Initial ids are seeded synchronously (no expand flash on first paint); ids
  // first seen on later refetches (new sections) are collapsed by the effect
  // below. Ids the user deliberately expanded stay expanded across refetches
  // because they are already in `seenSectionIds`.
  const initialSectionIds = (course.sections || []).map((s) => String(s.id));
  const seenSectionIds = useRef(new Set(initialSectionIds));
  const [collapsedIds, setCollapsedIds] = useState(() => new Set(initialSectionIds));

  useEffect(() => {
    const ids = (course.sections || []).map((s) => String(s.id));
    const fresh = ids.filter((id) => !seenSectionIds.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => seenSectionIds.current.add(id));
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      fresh.forEach((id) => next.add(id));
      return next;
    });
  }, [course.sections]);

  const toggleCollapsed = (sectionId) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      const key = String(sectionId);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isCollapsed = (sectionId) => collapsedIds.has(String(sectionId));

  // ── Drag & drop reorder (dnd-kit) ──────────────────────────────────────────
  // Pointer events drive mouse, touch and pen; the distance constraint keeps a
  // plain click on the handle from starting a drag. The keyboard sensor moves
  // the focused section with the arrow keys.
  const [activeId, setActiveId] = useState(null);
  const [overId, setOverId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const sectionIds = (course.sections || []).map((s) => String(s.id));
  const activeIndex = activeId ? sectionIds.indexOf(activeId) : -1;

  const clearDrag = () => {
    setActiveId(null);
    setOverId(null);
  };

  const handleDragStart = ({ active }) => setActiveId(String(active.id));
  const handleDragOver = ({ over }) => setOverId(over ? String(over.id) : null);

  /** Drop the dragged section into `over`'s slot, then persist the full order. */
  const handleDragEnd = ({ active, over }) => {
    const fromId = String(active.id);
    const toId = over ? String(over.id) : null;
    clearDrag();
    if (!toId || fromId === toId) return;
    const ids = (course.sections || []).map((s) => String(s.id));
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    mutate(
      `/api/lms/courses/${course.id}/sections/reorder`,
      "POST",
      { sectionIds: arrayMove(ids, from, to) },
      "lms.courses.saved",
    );
  };

  // ── Sections ─────────────────────────────────────────────────────────────
  const saveSection = async () => {
    if (!sectionModal.title?.trim()) {
      notify("error", "lms.errors.sectionTitleRequired");
      return;
    }
    const url =
      sectionModal.mode === "edit"
        ? `/api/lms/sections/${sectionModal.section.id}`
        : `/api/lms/courses/${course.id}/sections`;
    await mutate(url, sectionModal.mode === "edit" ? "PUT" : "POST", {
      title: sectionModal.title,
      description: sectionModal.description,
    });
    setSectionModal(null);
  };

  const deleteSection = async (section) => {
    if (!(await confirm({ message: `${t("lms.confirm.deleteSection")}\n${t("lms.confirm.deleteSectionHint")}`, tone: "danger" }))) return;
    mutate(`/api/lms/sections/${section.id}`, "DELETE", null, "lms.courses.saved", section.id);
  };

  // ── Lessons ──────────────────────────────────────────────────────────────
  const deleteLesson = async (lesson) => {
    if (!(await confirm({ message: t("lms.confirm.deleteLesson"), tone: "danger" }))) return;
    mutate(`/api/lms/lessons/${lesson.id}`, "DELETE", null, "lms.courses.saved", lesson.id);
  };

  const moveLesson = (lesson, direction) =>
    mutate(`/api/lms/lessons/${lesson.id}`, "PUT", { action: "move", direction }, "lms.courses.saved", lesson.id);

  // ── Assessments ──────────────────────────────────────────────────────────
  const deleteAssessment = async (assessment) => {
    if (!(await confirm({ message: `${t("lms.confirm.deleteAssessment")}\n${t("lms.confirm.deleteAssessmentHint")}`, tone: "danger" }))) return;
    mutate(`/api/lms/assessments/${assessment.id}`, "DELETE", null, "lms.courses.saved", assessment.id);
  };

  const openAssessmentView = (assessment) => setViewAssessment(assessment);

  const openAssessmentEdit = (assessment) => {
    setViewAssessment(null);
    setAssessmentModal({ mode: "edit", sectionId: assessment.section_id || null, assessment });
  };

  const courseAssessments = course.courseAssessments || [];

  return (
    <div className="space-y-4">
      {/* Sections */}
      {course.sections.length === 0 ? (
        <div
          className="flex flex-col items-center gap-3 py-12 rounded-xl border border-dashed"
          style={{ borderColor: "var(--border-primary)" }}
        >
          <ListVideo className="w-8 h-8" style={{ color: "var(--text-tertiary)" }} />
          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            {t("lms.sections.empty")}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.sections.emptyHint")}
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={clearDrag}
        >
          <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
            {course.sections.map((section, index) => {
              const id = String(section.id);
              const isDropTarget = overId === id && activeId !== id;
              return (
                <SortableSection
                  key={section.id}
                  section={section}
                  index={index}
                  courseId={course.id}
                  canEdit={canEdit}
                  collapsed={isCollapsed(section.id)}
                  onToggleCollapse={() => toggleCollapsed(section.id)}
                  insertEdge={
                    isDropTarget && activeIndex >= 0
                      ? activeIndex < index
                        ? "bottom"
                        : "top"
                      : null
                  }
                  savingId={savingId}
                  t={t}
                  onEditSection={() =>
                    setSectionModal({
                      mode: "edit",
                      section,
                      title: section.title,
                      description: section.description,
                    })
                  }
                  onDeleteSection={() => deleteSection(section)}
                  onAddLesson={() =>
                    setLessonModal({ mode: "create", sectionId: section.id, lesson: null })
                  }
                  onEditLesson={(lesson) =>
                    setLessonModal({ mode: "edit", sectionId: section.id, lesson })
                  }
                  onDeleteLesson={deleteLesson}
                  onMoveLesson={moveLesson}
                  onAddAssessment={() =>
                    setAssessmentModal({ mode: "create", sectionId: section.id, assessment: null })
                  }
                  onViewAssessment={openAssessmentView}
                  onEditAssessment={openAssessmentEdit}
                  onDeleteAssessment={deleteAssessment}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      <AppButton
        variant="secondary"
        icon={Plus}
        onClick={() => setSectionModal({ mode: "create", section: null, title: "", description: "" })}
      >
        {t("lms.sections.add")}
      </AppButton>

      {/* Course-level assessments */}
      <div className="pt-2 border-t" style={{ borderColor: "var(--border-primary)" }}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              {t("lms.sections.courseAssessments")}
            </p>
            <p className="text-[9px] mt-0.5" style={{ color: "var(--text-tertiary)" }}>
              {t("lms.sections.courseLevelHint")}
            </p>
          </div>
          <AppButton
            variant="ghost"
            size="sm"
            icon={Plus}
            onClick={() => setAssessmentModal({ mode: "create", sectionId: null, assessment: null })}
          >
            {t("lms.assessments.add")}
          </AppButton>
        </div>
        {courseAssessments.length === 0 ? (
          <p className="text-[10px] font-bold uppercase tracking-wider text-center py-3" style={{ color: "var(--text-tertiary)" }}>
            {t("lms.assessments.emptyHint")}
          </p>
        ) : (
          <div className="space-y-2">
            {courseAssessments.map((assessment) => (
              <AssessmentCard
                key={assessment.id}
                assessment={assessment}
                t={t}
                onView={() => openAssessmentView(assessment)}
                onEdit={() => openAssessmentEdit(assessment)}
                onDelete={() => deleteAssessment(assessment)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {sectionModal && (
        <AppModal
          isOpen
          onClose={() => setSectionModal(null)}
          title={sectionModal.mode === "edit" ? t("lms.sections.edit") : t("lms.sections.add")}
          size="md"
        >
          <div className="space-y-4">
            <AppInput
              label={t("lms.sections.name")}
              value={sectionModal.title}
              onChange={(e) => setSectionModal((p) => ({ ...p, title: e.target.value }))}
              placeholder={t("lms.sections.namePlaceholder")}
            />
            <div className="space-y-2">
              <label
                className="text-[10px] font-bold uppercase tracking-wider ml-1"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("lms.sections.description")}
              </label>
              <RichTextEditor
                value={sectionModal.description || ""}
                onChange={(html) => setSectionModal((p) => ({ ...p, description: html }))}
                minHeight={96}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <AppButton variant="ghost" onClick={() => setSectionModal(null)}>
                {t("common.cancel")}
              </AppButton>
              <AppButton variant="primary" onClick={saveSection}>
                {t("common.save")}
              </AppButton>
            </div>
          </div>
        </AppModal>
      )}

      {lessonModal && (
        <LessonModal
          isOpen
          onClose={() => setLessonModal(null)}
          onSaved={onChange}
          mode={lessonModal.mode}
          sectionId={lessonModal.sectionId}
          lesson={lessonModal.lesson}
        />
      )}

      {assessmentModal && (
        <AssessmentModal
          isOpen
          onClose={() => setAssessmentModal(null)}
          onSaved={onChange}
          mode={assessmentModal.mode}
          courseId={course.id}
          sectionId={assessmentModal.sectionId}
          assessment={assessmentModal.assessment}
        />
      )}

      {viewAssessment && (
        <AssessmentViewModal
          isOpen
          onClose={() => setViewAssessment(null)}
          onEdit={() => openAssessmentEdit(viewAssessment)}
          assessment={viewAssessment}
        />
      )}
    </div>
  );
}

/**
 * ONE section card, sortable with dnd-kit. The whole card is the drag node (so
 * the other cards animate around it), but only the grip handle is the activator
 * — the title, the buttons and the lesson rows stay clickable.
 */
function SortableSection({
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
            section.lessons.map((lesson, li) => (
              <div
                key={lesson.id}
                className="flex items-center gap-3 p-3 rounded-lg border"
                style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
              >
                <Film className="w-4 h-4 shrink-0" style={{ color: "var(--text-tertiary)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold truncate" style={{ color: "var(--text-primary)" }}>
                    {li + 1}. {lesson.title}
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
                    disabled={li === 0 || savingId === lesson.id}
                    className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                    style={{ color: "var(--text-tertiary)" }}
                    title={t("lms.lessons.moveUp")}
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveLesson(lesson, "down")}
                    disabled={li === section.lessons.length - 1 || savingId === lesson.id}
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

/** Compact assessment row: click to view, with edit and delete beside it. */
function AssessmentCard({ assessment, t, onView, onEdit, onDelete, className = "" }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView();
        }
      }}
      className={`rounded-lg border p-3 cursor-pointer transition-colors bg-[var(--surface-2)] hover:bg-[var(--surface-1)] ${className}`}
      style={{ borderColor: "var(--border-primary)" }}
      title={t("lms.assessments.viewAssessment")}
    >
      <div className="flex items-center gap-2">
        <HelpCircle className="w-4 h-4 shrink-0" style={{ color: "var(--brand-blue)" }} />
        <p className="text-[10px] font-black uppercase tracking-wider flex-1 min-w-0 truncate" style={{ color: "var(--text-primary)" }}>
          {t("lms.assessments.title")}: {assessment.title}
        </p>
        <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
          {assessment.questions?.length || 0} {t("lms.preview.questions")}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          title={t("lms.assessments.edit")}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: "var(--text-tertiary)" }}
          title={t("lms.assessments.delete")}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
