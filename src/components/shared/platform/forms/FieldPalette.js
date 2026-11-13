import { useI18n } from "@/lib/i18n";
import { FIELD_TYPES, FIELD_TYPE_KEYS } from "./constants";

export default function FieldPalette({ sections, activeSectionId, onSetActiveSection, onAddSection, onAddField }) {
  const { t } = useI18n();
  return (
    <div className="w-56 shrink-0 bg-secondary border-r border-[var(--border-primary)] p-3 space-y-3 overflow-y-auto">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] opacity-50">{t("platformMisc.forms.paletteAddField")}</p>
      <button onClick={onAddSection} className="w-full p-2 rounded-lg bg-tertiary border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("platformMisc.forms.paletteAddSection")}</button>
      {FIELD_TYPES.map((type) => (
        <button key={type.value} onClick={() => onAddField(type.value)} className="w-full flex items-center gap-2 p-2 rounded-lg text-left text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all">
          <type.icon className="w-3.5 h-3.5" />{t("platformMisc.forms." + FIELD_TYPE_KEYS[type.value])}
        </button>
      ))}
      {/* Per-section quick-add */}
      {sections.map((section) => (
        <div key={section.id} className="pt-2 border-t border-[var(--border-primary)]">
          <button
            onClick={() => onSetActiveSection(section.id)}
            className={`w-full text-left p-1 rounded text-[10px] font-bold uppercase mb-1 transition-all ${activeSectionId === section.id ? 'text-[var(--brand-orange)] bg-brand-orange/10' : 'text-[var(--text-secondary)] opacity-50'}`}
          >
            {t("platformMisc.forms.paletteInto", { title: section.title })} {activeSectionId === section.id && '✓'}
          </button>
          {FIELD_TYPES.slice(0, 6).map((type) => (
            <button key={type.value} onClick={() => onAddField(type.value, section.id)} className="w-full flex items-center gap-2 p-1.5 rounded text-[10px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary">
              <type.icon className="w-3 h-3" />{t("platformMisc.forms." + FIELD_TYPE_KEYS[type.value])}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
