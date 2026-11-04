import { Sparkles } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { findUnknownTemplateVariables } from "@/lib/constants";

/**
 * One email template of a form.
 *
 * Defined at MODULE scope, not inside the panel's render: a component created
 * during a render is a new type every time, so React unmounts and remounts its
 * inputs on every keystroke — the field loses focus after each letter and the
 * author can never finish a sentence. Nothing here depends on render-local
 * state, so hoisting it costs nothing and typing works.
 */
function TemplateEditor({ label, icon: Icon, tKey, desc, defaultSubject, defaultBody, vars, onPersonalize, personalizingKey, templates, onChange }) {
  const { t } = useI18n();
  const entry = templates?.[tKey] || {};
  // Names the sender will not fill in — it removes them, so the author is told
  // before sending rather than discovering it in the sent mail.
  const unknownVariables = findUnknownTemplateVariables(
    `${entry.subject || ""} ${entry.body || ""}`,
    vars || [],
  );
  return (
    <div className="space-y-2 p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-cyan-400" />
        <p className="text-[10px] font-black uppercase text-[var(--text-primary)]">{label}</p>
        <button
          type="button"
          disabled={personalizingKey === tKey}
          onClick={() => onPersonalize(tKey, label)}
          className="ml-auto px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-bold uppercase tracking-wide hover:bg-indigo-500/20 disabled:opacity-40 transition-all flex items-center gap-1"
        >
          <Sparkles className="w-2.5 h-2.5" />
          {personalizingKey === tKey ? t("platformMisc.forms.templateWriting") : t("platformMisc.forms.templatePersonalize")}
        </button>
      </div>
      <p className="text-[10px] font-medium text-[var(--text-secondary)]">{desc}</p>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.templateSubject")}</label>
        <input
          value={entry.subject || ""}
          onChange={(event) => onChange(tKey, "subject", event.target.value)}
          placeholder={defaultSubject}
          className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-bold text-[var(--text-primary)] outline-none focus:border-cyan-500"
        />
      </div>
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.forms.templateBody")}</label>
        <textarea
          value={entry.body || ""}
          onChange={(event) => onChange(tKey, "body", event.target.value)}
          rows={4}
          placeholder={defaultBody}
          className="w-full px-3 py-2 rounded-lg bg-primary border border-[var(--border-primary)] text-[10px] font-medium text-[var(--text-primary)] outline-none focus:border-cyan-500 resize-y font-mono"
        />
      </div>
      {vars && (
        <p className="text-[10px] font-medium text-[var(--text-secondary)]">{t("platformMisc.forms.templateVariables", { vars: vars.join(", ") })}</p>
      )}
      {unknownVariables.length > 0 && (
        <p className="text-[10px] font-bold text-amber-500">
          {t("platformMisc.forms.templateUnknownVariables", { vars: unknownVariables.join(", ") })}
        </p>
      )}
    </div>
  );
}

export default TemplateEditor;
