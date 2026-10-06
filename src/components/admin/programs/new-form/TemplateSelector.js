/** "Start from a template" selector shown above the program form. */
export default function TemplateSelector({
  t,
  templates,
  selectedTemplate,
  setSelectedTemplate,
  applyingTemplate,
  onApply,
}) {
  return (
    <div className="space-y-3">
      <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
        {t("admin.startFromTemplate")}
      </label>
      <div className="flex gap-3">
        <select
          value={selectedTemplate}
          onChange={(event) => setSelectedTemplate(event.target.value)}
          className="flex-1 bg-secondary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-[var(--brand-orange)] transition-all"
        >
          <option value="">{t("admin.selectTemplate")}</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} ({template.program_type || "incubation"})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selectedTemplate || applyingTemplate}
          onClick={onApply}
          className="px-6 py-3 bg-indigo-500 text-white rounded-xl text-sm font-bold uppercase tracking-wide hover:bg-indigo-600 transition-all disabled:opacity-40"
        >
          {applyingTemplate ? t("adminMisc.newProgram.creating") : t("admin.apply")}
        </button>
      </div>
    </div>
  );
}
