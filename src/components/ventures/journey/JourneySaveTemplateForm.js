"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { Loader2, Save } from "lucide-react";

/**
 * Save the current journey as a reusable journey template.
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function JourneySaveTemplateForm({
  saveForm,
  saveJourneyTemplate,
  savingSave,
  setSaveForm,
  setSaveOpen,
}) {
  const { t } = useI18n();
  return (
    <form onSubmit={saveJourneyTemplate} className="mb-4 p-3 rounded-xl border border-brand-orange/30 bg-tertiary space-y-2">
      <p className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
        {t("venture.manager.saveTemplateTitle")}
      </p>
      <input
        value={saveForm.name}
        onChange={(event) => setSaveForm({ ...saveForm, name: event.target.value })}
        placeholder={t("venture.manager.saveTemplateNamePlaceholder")}
        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
      />
      <textarea
        rows={2}
        value={saveForm.description}
        onChange={(event) => setSaveForm({ ...saveForm, description: event.target.value })}
        placeholder={t("venture.manager.saveTemplateDescPlaceholder")}
        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
      />
      <div className="flex items-center gap-2 justify-end">
        <button type="button" onClick={() => { setSaveOpen(false); setSaveForm({ name: "", description: "" }); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]">
          {t("common.cancel")}
        </button>
        <button type="submit" disabled={savingSave} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5 disabled:opacity-50">
          {savingSave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("venture.manager.saveTemplate")}
        </button>
      </div>
    </form>
  );
}
