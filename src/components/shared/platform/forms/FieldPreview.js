import { ChevronUp, ChevronDown, Trash2, Type } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FIELD_ICONS, FIELD_TYPES, FIELD_TYPE_KEYS, cn } from "./constants";

export default function FieldPreview({
  field, isSelected, onToggleSelect, sections, fields,
  onMove, onRemove, onUpdate, onAddOption, onUpdateOption, onRemoveOption,
}) {
  const { t } = useI18n();
  const Icon = FIELD_ICONS[field.field_type] || Type;
  const tempId = field._tmpId;
  return (
    <div
      onClick={onToggleSelect}
      className={cn(
        "p-4 rounded-xl border transition-all cursor-pointer group",
        isSelected
          ? "border-[var(--brand-orange)] bg-brand-orange/5"
          : "border-[var(--border-primary)] bg-secondary hover:border-[var(--text-secondary)]",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Icon className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-[var(--text-primary)]">
              {field.label || t("platformMisc.forms.untitled")}
              {field.required && <span className="text-rose-500 ml-1">*</span>}
            </p>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase tracking-widest">
              {FIELD_TYPE_KEYS[field.field_type] ? t("platformMisc.forms." + FIELD_TYPE_KEYS[field.field_type]) : field.field_type}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <button onClick={(event) => { event.stopPropagation(); onMove(tempId, -1); }}><ChevronUp className="w-3 h-3" /></button>
          <button onClick={(event) => { event.stopPropagation(); onMove(tempId, 1); }}><ChevronDown className="w-3 h-3" /></button>
          <button onClick={(event) => { event.stopPropagation(); onRemove(tempId); }} className="text-rose-500"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Field editor (expanded) */}
      {isSelected && (
        <div className="mt-4 pt-4 border-t border-[var(--border-primary)] space-y-3" onClick={(event) => event.stopPropagation()}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorLabel")}</label>
              <input
                value={field.label}
                onChange={(event) => onUpdate(tempId, { label: event.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorType")}</label>
              <select
                value={field.field_type}
                onChange={(event) => {
                  const newType = event.target.value;
                  const needsOptions = ["select", "radio", "checkbox", "multiselect", "rating"].includes(newType);
                  onUpdate(tempId, { field_type: newType, options: needsOptions ? (newType === "rating" ? [{ label: "1", value: "1" }, { label: "2", value: "2" }, { label: "3", value: "3" }, { label: "4", value: "4" }, { label: "5", value: "5" }] : [{ label: t("platformMisc.forms.optionDefault", { n: 1 }), value: "option-1" }]) : null });
                }}
                className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
              >
                {FIELD_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{t("platformMisc.forms." + FIELD_TYPE_KEYS[type.value])}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorSection")}</label>
            <select
              value={field.section_id || ""}
              onChange={(event) => onUpdate(tempId, { section_id: event.target.value || null })}
              className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
            >
              <option value="">{t("platformMisc.forms.fieldSectionNone")}</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>{section.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorPlaceholder")}</label>
            <input
              value={field.placeholder || ""}
              onChange={(event) => onUpdate(tempId, { placeholder: event.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldEditorHelpText")}</label>
            <input
              value={field.help_text || ""}
              onChange={(event) => onUpdate(tempId, { help_text: event.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-primary)]">
            <input type="checkbox" checked={field.required} onChange={(event) => onUpdate(tempId, { required: event.target.checked })} />
            {t("platformMisc.forms.fieldRequired")}
          </label>

          {/* Options editor */}
          {field.options && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.fieldOptions")}</label>
              {field.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <input
                    value={option.label}
                    onChange={(event) => onUpdateOption(tempId, optionIndex, "label", event.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none"
                  />
                  <button onClick={() => onRemoveOption(tempId, optionIndex)} className="text-rose-500"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
              <button onClick={() => onAddOption(tempId)} className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline">{t("platformMisc.forms.addOption")}</button>
            </div>
          )}

          {/* Validation Rules */}
          <div className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">{t("platformMisc.forms.validationTitle")}</p>
            <div className="grid grid-cols-2 gap-2">
              {["text", "textarea"].includes(field.field_type) && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationMinLength")}</label>
                    <input type="number" value={field.validation?.minLength || ""} onChange={(event) => onUpdate(tempId, { validation: { ...(field.validation || {}), minLength: event.target.value ? parseInt(event.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationMaxLength")}</label>
                    <input type="number" value={field.validation?.maxLength || ""} onChange={(event) => onUpdate(tempId, { validation: { ...(field.validation || {}), maxLength: event.target.value ? parseInt(event.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" />
                  </div>
                </>
              )}
              {["number", "currency"].includes(field.field_type) && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationMinValue")}</label>
                    <input type="number" value={field.validation?.min || ""} onChange={(event) => onUpdate(tempId, { validation: { ...(field.validation || {}), min: event.target.value ? parseFloat(event.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationMaxValue")}</label>
                    <input type="number" value={field.validation?.max || ""} onChange={(event) => onUpdate(tempId, { validation: { ...(field.validation || {}), max: event.target.value ? parseFloat(event.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" />
                  </div>
                </>
              )}
              {["file"].includes(field.field_type) && (
                <>
                  <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationMaxSizeMb")}</label><input type="number" value={field.validation?.maxSize || ""} onChange={(event) => onUpdate(tempId, { validation: { ...(field.validation || {}), maxSize: event.target.value ? parseInt(event.target.value) : undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" /></div>
                  <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationAllowedTypes")}</label><input value={field.validation?.acceptedFiles || ""} onChange={(event) => onUpdate(tempId, { validation: { ...(field.validation || {}), acceptedFiles: event.target.value } })} placeholder=".pdf,.jpg" className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" /></div>
                </>
              )}
              <div className="col-span-2 space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.validationErrorMessage")}</label><input value={field.validation?.errorMessage || ""} onChange={(event) => onUpdate(tempId, { validation: { ...(field.validation || {}), errorMessage: event.target.value } })} placeholder={t("platformMisc.forms.validationErrorMessagePlaceholder")} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" /></div>
            </div>
          </div>

          {/* Conditional Logic */}
          <div className="space-y-2 p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">{t("platformMisc.forms.conditionalLogicTitle")}</p>
            <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.conditionalShowOnlyWhen")}</label>
              <select value={field.conditional_logic?.field_id || ""} onChange={(event) => onUpdate(tempId, { conditional_logic: { ...(field.conditional_logic || {}), field_id: event.target.value || undefined } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none">
                <option value="">{t("platformMisc.forms.conditionalAlwaysVisible")}</option>
                {fields.filter((candidate) => candidate !== field).slice(0, 20).map((candidate) => <option key={candidate._tmpId || candidate.id || candidate.label} value={candidate.label}>{candidate.label}</option>)}
              </select>
            </div>
            {field.conditional_logic?.field_id && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.conditionalOperator")}</label>
                  <select value={field.conditional_logic?.operator || "equals"} onChange={(event) => onUpdate(tempId, { conditional_logic: { ...field.conditional_logic, operator: event.target.value } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none">
                    <option value="equals">{t("platformMisc.forms.operatorEquals")}</option><option value="not_equals">{t("platformMisc.forms.operatorNotEquals")}</option><option value="contains">{t("platformMisc.forms.operatorContains")}</option><option value="greater_than">{t("platformMisc.forms.operatorGreaterThan")}</option><option value="less_than">{t("platformMisc.forms.operatorLessThan")}</option>
                  </select>
                </div>
                <div className="space-y-1"><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.conditionalValue")}</label><input value={field.conditional_logic?.value || ""} onChange={(event) => onUpdate(tempId, { conditional_logic: { ...field.conditional_logic, value: event.target.value } })} className="w-full px-2 py-1.5 rounded bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none" /></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
