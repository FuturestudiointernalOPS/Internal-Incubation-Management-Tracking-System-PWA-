"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { Loader2, Save } from "lucide-react";

/**
 * Add-a-journey form (name, description, objective, start date).
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function JourneyAddStageForm({
  addStage,
  form,
  saving,
  setForm,
}) {
  const { t } = useI18n();
  return (
    <form onSubmit={addStage} className="mb-4 p-4 rounded-xl border border-[var(--border-primary)] bg-tertiary space-y-3">
      <input
        value={form.name}
        onChange={(event) => setForm({ ...form, name: event.target.value })}
        placeholder={t("venture.manager.stageNamePlaceholder")}
        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
        required
      />
      <textarea
        value={form.description}
        onChange={(event) => setForm({ ...form, description: event.target.value })}
        rows={2}
        placeholder={t("venture.manager.stageDescPlaceholder")}
        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
      />
      <input
        value={form.objective}
        onChange={(event) => setForm({ ...form, objective: event.target.value })}
        placeholder={t("venture.manager.stageObjectivePlaceholder")}
        className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
      />
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.manager.stageStartDate")}</label>
        <input
          type="date"
          value={form.start_date || ""}
          onChange={(event) => setForm({ ...form, start_date: event.target.value })}
          className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
        />
        <p className="text-[10px] text-[var(--text-secondary)]">{t("venture.manager.stageStartDateHint")}</p>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="px-4 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("venture.manager.addStage")}
        </button>
      </div>
    </form>
  );
}
