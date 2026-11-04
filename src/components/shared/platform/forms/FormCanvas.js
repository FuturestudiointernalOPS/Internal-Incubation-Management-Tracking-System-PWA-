import { useState } from "react";
import { ChevronUp, ChevronDown, Trash2, FileText } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import FieldPreview from "./FieldPreview";

export default function FormCanvas({
  editingForm, previewMode, sections, fields, selectedFieldId, setSelectedFieldId,
  onUpdateSection, onRemoveSection, onMoveSection,
  onUpdate, onMove, onRemove, onAddOption, onUpdateOption, onRemoveOption,
}) {
  const { t } = useI18n();
  // Target for the bulk move of unassigned fields. Defaults to the first section
  // so the control is usable without a second click.
  const [bulkTarget, setBulkTarget] = useState(null);
  const formFieldsForSection = (sectionId) => fields.filter((field) => field.section_id === sectionId);
  const orphanFields = fields.filter((field) => !field.section_id);
  const renderField = (field) => (
    <FieldPreview
      key={field._tmpId}
      field={field}
      isSelected={selectedFieldId === field._tmpId}
      onToggleSelect={() => setSelectedFieldId(selectedFieldId === field._tmpId ? null : field._tmpId)}
      sections={sections}
      fields={fields}
      onMove={onMove}
      onRemove={onRemove}
      onUpdate={onUpdate}
      onAddOption={onAddOption}
      onUpdateOption={onUpdateOption}
      onRemoveOption={onRemoveOption}
    />
  );
  return (
    <div className="flex-1 bg-primary overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--text-primary)]">{editingForm?.name}</h1>
          {editingForm?.description && <p className="text-[11px] text-[var(--text-secondary)] mt-1">{editingForm.description}</p>}
        </div>

        {/* Sections */}
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="space-y-3">
            {!previewMode ? (
              <div className="flex items-center gap-2 group">
                <input value={section.title} onChange={(event) => onUpdateSection(sectionIndex, { title: event.target.value })} className="text-sm font-black uppercase text-[var(--text-primary)] bg-transparent outline-none border-b-2 border-transparent focus:border-[var(--brand-orange)]" />
                <button onClick={() => onMoveSection(sectionIndex, -1)} disabled={sectionIndex === 0} className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
                <button onClick={() => onMoveSection(sectionIndex, 1)} disabled={sectionIndex === sections.length - 1} className="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
                <button onClick={() => onRemoveSection(sectionIndex)} className="opacity-0 group-hover:opacity-100 text-rose-500"><Trash2 className="w-3 h-3" /></button>
              </div>
            ) : (
              <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)] pb-2 border-b border-[var(--border-primary)]">{section.title}</h2>
            )}
            {section.description && !previewMode && (
              <textarea value={section.description} onChange={(event) => onUpdateSection(sectionIndex, { description: event.target.value })} className="w-full text-[10px] text-[var(--text-secondary)] bg-transparent outline-none resize-none" rows={1} />
            )}
            <div className="space-y-2">
              {formFieldsForSection(sections[sectionIndex]?.id).map((field) => renderField(field))}
            </div>
          </div>
        ))}

        {/* Orphan Fields (legacy — should be empty with new architecture) */}
        {orphanFields.length > 0 && (
          <div className="space-y-3 pt-4 border-t-2 border-dashed border-amber-500/30">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-500/70">
                {t("platformMisc.forms.orphanFieldsTitle", { count: orphanFields.length })}
              </p>
              {/* One click puts every unassigned field back into a section — the
                  per-field dropdown stays for the cases that need it. */}
              {sections.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                    {t("platformMisc.forms.orphanAssignAllTo")}
                  </span>
                  <select
                    value={bulkTarget || sections[0]?.id || ""}
                    onChange={(event) => setBulkTarget(event.target.value)}
                    className="px-2 py-1 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                  >
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>{section.title}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const target = bulkTarget || sections[0]?.id;
                      if (!target) return;
                      for (const field of orphanFields) onUpdate(field._tmpId, { section_id: target });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[var(--brand-orange)] text-black text-[9px] font-black uppercase tracking-widest"
                  >
                    {t("platformMisc.forms.orphanAssignAll")}
                  </button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              {orphanFields.map((field) => <div key={field._tmpId}>{renderField(field)}</div>)}
            </div>
          </div>
        )}

        {fields.length === 0 && <div className="py-16 text-center"><FileText className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-20" /><p className="text-[11px] text-[var(--text-secondary)] mt-3 font-bold">{t("platformMisc.forms.emptyCanvasTitle")}</p><p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1 opacity-50">{t("platformMisc.forms.emptyCanvasHint")}</p></div>}
      </div>
    </div>
  );
}
