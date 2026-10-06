"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { Copy, Loader2 } from "lucide-react";

/**
 * Generate the journey from a journey template or an operating-plan
 * template (structure only).
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function JourneyApplyTemplateBar({
  applyTemplate,
  journeyTemplates,
  savingTemplate,
  selectedTemplateId,
  setSelectedTemplateId,
  templates,
}) {
  const { t } = useI18n();
  return (
    <div className="mb-4 p-3 rounded-xl border border-[var(--border-primary)] bg-tertiary flex flex-wrap items-end gap-3">
      <div className="flex-1 min-w-[200px]">
        <label className="block text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">{t("venture.manager.generateFromTemplate")}</label>
        <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)} className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]">
          <option value="">{t("venture.manager.selectTemplate")}</option>
          {journeyTemplates.map((template) => (
            <option key={`j-${template.id}`} value={`journey:${template.id}`}>{t("venture.manager.journeyTplOption", { name: template.name, count: template.stage_count || 0 })}</option>
          ))}
          {journeyTemplates.length > 0 && templates.length > 0 && <option disabled>──────────</option>}
          {templates.map((template) => (
            <option key={`p-${template.id}`} value={`plan:${template.id}`}>{t("venture.manager.planTplOption", { name: template.name, count: template.section_count || 0 })}</option>
          ))}
        </select>
      </div>
      <button onClick={applyTemplate} disabled={savingTemplate || !selectedTemplateId} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
        {savingTemplate ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} {t("venture.manager.generate")}
      </button>
    </div>
  );
}
