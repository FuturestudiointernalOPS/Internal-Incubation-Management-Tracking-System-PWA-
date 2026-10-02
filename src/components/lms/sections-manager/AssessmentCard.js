"use client";

import { HelpCircle, Pencil, Trash2 } from "lucide-react";

/** Compact assessment row: click to view, with edit and delete beside it. */
export default function AssessmentCard({ assessment, t, onView, onEdit, onDelete, className = "" }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onView}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
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
          onClick={(event) => {
            event.stopPropagation();
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
          onClick={(event) => {
            event.stopPropagation();
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
