import { Send } from "lucide-react";
import FieldBlock from "@/components/public/run-submit/FieldBlock";

/**
 * SECTIONS — step-by-step navigation over the form's sections.
 *
 * Extracted from the public submit page. A run whose form has one section (or
 * whose fields carry none) renders them all at once, which is the first branch;
 * otherwise the progress bar, the section, its fields and the navigation live
 * here. Which step is shown, and where moving a step leads, stay with the screen.
 */
export default function SectionsStepper({
  validSections,
  fields,
  currentSection,
  formData,
  errors,
  disabled,
  saving,
  onFieldChange,
  onStep,
  onSubmit,
  t,
}) {
  if (validSections.length <= 1) {
    // Single section — render all fields directly
    return (
      <div className="space-y-4">
        {fields
          .filter(
            (field) =>
              !field.section_id ||
              validSections.some((section) => String(section.id) === String(field.section_id)),
          )
          .map((field) => (
            <FieldBlock
              key={field.id}
              field={field}
              value={formData[field.id] || ""}
              error={errors[field.id]}
              disabled={disabled}
              onFieldChange={(value) => onFieldChange(field.id, value)}
              t={t}
            />
          ))}
      </div>
    );
  }

  // Multi-section — stepper
  const sec = validSections[currentSection];
  if (!sec) return null;
  // Include fields with no section in the FIRST step so they are never
  // dropped or rendered twice (single-section path already covers them).
  const secFields = fields.filter((field) => {
    if (currentSection === 0 && !field.section_id) return true;
    return String(field.section_id) === String(sec.id);
  });
  const isLast = currentSection >= validSections.length - 1;
  const isFirst = currentSection === 0;

  return (
    <div className="space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-1">
        {validSections.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= currentSection ? "bg-orange-500" : "bg-slate-700"}`}
          />
        ))}
        <span className="text-[10px] font-bold text-slate-500 ml-2">
          {currentSection + 1}/{validSections.length}
        </span>
      </div>

      {/* Section title */}
      <div>
        <h2 className="text-lg font-black uppercase text-slate-100">{sec.title}</h2>
        {sec.description && <p className="text-xs text-slate-400 mt-1">{sec.description}</p>}
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {secFields.map((field) => (
          <FieldBlock
            key={field.id}
            field={field}
            value={formData[field.id] || ""}
            error={errors[field.id]}
            disabled={disabled}
            onFieldChange={(value) => onFieldChange(field.id, value)}
            t={t}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3 pt-2">
        {!isFirst && (
          <button
            onClick={() => onStep(-1)}
            className="px-5 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-slate-300 text-xs font-black uppercase hover:bg-slate-700 transition-colors"
          >
            ← {t("common.previous") || "Previous"}
          </button>
        )}
        {!isLast ? (
          <button
            onClick={() => onStep(1)}
            className="ml-auto px-6 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-black uppercase hover:bg-orange-600 transition-colors"
          >
            {t("common.next") || "Next"} →
          </button>
        ) : (
          <button
            onClick={onSubmit}
            disabled={saving}
            className="ml-auto px-8 py-3 rounded-xl bg-orange-500 text-white text-sm font-black uppercase hover:bg-orange-600 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <Send className="w-4 h-4" /> {saving ? t("forms.submitting") : t("forms.submit")}
          </button>
        )}
      </div>
    </div>
  );
}