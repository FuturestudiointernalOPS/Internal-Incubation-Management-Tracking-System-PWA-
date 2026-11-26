"use client";

import { ChevronUp, ChevronDown, AlertTriangle, FileText } from "lucide-react";
import SubmitField from "./SubmitField";

export default function SubmitFormSections({
  t,
  sections,
  fields,
  closedSections,
  setClosedSections,
  answers,
  errors,
  isSubmitted,
  needsRevision,
  updateField,
}) {
  const isDisabled = isSubmitted && !needsRevision;
  const renderField = (field) => (
    <SubmitField
      field={field}
      value={answers[field.id] || field.default_value || ""}
      hasError={errors[field.id]}
      isDisabled={isDisabled}
      updateField={updateField}
      t={t}
    />
  );

  return (
    <>
      {sections.length > 0 ? (
        sections.map((section) => {
          const sectionFields = fields.filter((field) => field.section_id === section.id);
          if (sectionFields.length === 0) return null;
          const isExpanded = !closedSections[section.id];

          return (
            <div key={section.id} className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
              <button
                type="button"
                onClick={() => setClosedSections((previousClosed) => ({ ...previousClosed, [section.id]: isExpanded }))}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-tertiary/50 transition-colors"
              >
                <div className="text-left">
                  <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">{section.title}</h3>
                  {section.description && <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">{section.description}</p>}
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
              </button>
              {isExpanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-[var(--border-primary)] pt-4">
                  {sectionFields.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
                        {field.label}
                        {field.required && <span className="text-rose-500">*</span>}
                      </label>
                      {field.help_text && <p className="text-[10px] font-medium text-[var(--text-secondary)]">{field.help_text}</p>}
                      {renderField(field)}
                      {errors[field.id] && (
                        <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {errors[field.id]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      ) : (
        // Fields without sections
        <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] p-5 space-y-4">
          {fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <label className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-primary)]">
                {field.label}
                {field.required && <span className="text-rose-500">*</span>}
              </label>
              {field.help_text && <p className="text-[10px] font-medium text-[var(--text-secondary)]">{field.help_text}</p>}
              {renderField(field)}
              {errors[field.id] && (
                <p className="text-[10px] font-bold text-rose-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {errors[field.id]}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty form */}
      {fields.length === 0 && (
        <div className="py-16 text-center">
          <FileText className="w-8 h-8 mx-auto text-[var(--text-secondary)] opacity-30" />
          <p className="text-sm text-[var(--text-secondary)] mt-3">{t("platformMisc.runSubmitDetail.noFields")}</p>
        </div>
      )}
    </>
  );
}
