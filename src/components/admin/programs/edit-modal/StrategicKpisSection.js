"use client";

import { Target, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/** Strategic KPIs configuration block (super-admin only). */
export default function StrategicKpisSection({
  editingKpis,
  onDeleteKpi,
  editKpiInput,
  setEditKpiInput,
  isKpiSubmitting,
  onAddKpi,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4 pt-6 border-t border-[var(--border-primary)] text-left">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest ml-2 font-sans flex items-center gap-2">
          <Target className="w-3.5 h-3.5" />{" "}
          {t("adminMisc.programs.strategicKpisConfiguration")}
        </label>
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
          {t("adminMisc.programs.superAdminOnly")}
        </span>
      </div>

      <div className="space-y-3">
        {editingKpis.map((kpi) => (
          <div
            key={kpi.id}
            className="flex items-center justify-between p-3.5 bg-white/[0.02] border border-[var(--border-primary)] rounded-xl group hover:border-brand-orange/30 transition-all"
          >
            <div>
              <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                {kpi.title}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)] mt-1">
                {t("admin.targetValue")}: {kpi.target_value}%
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDeleteKpi(kpi.id)}
              className="text-[var(--text-secondary)] hover:text-rose-500 transition-colors p-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}

        <div className="p-4 bg-brand-orange/5 border border-brand-orange/10 rounded-xl space-y-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-orange)]">
              {t("adminMisc.programs.defineNewTarget")}
            </p>
            <p className="text-[10px] text-[var(--text-secondary)]">
              {t("adminMisc.programs.targetDescription")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder={t("adminMisc.programs.kpiTitlePlaceholder", {
                title: t("admin.kpiTitle"),
              })}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] text-xs font-bold"
              value={editKpiInput.title}
              onChange={(e) =>
                setEditKpiInput({ ...editKpiInput, title: e.target.value })
              }
            />
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max="100"
                placeholder={t("adminMisc.programs.targetPercentSample")}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] text-xs font-bold"
                value={editKpiInput.target_value}
                onChange={(e) =>
                  setEditKpiInput({
                    ...editKpiInput,
                    target_value: parseInt(e.target.value) || 0,
                  })
                }
              />
              <button
                type="button"
                onClick={onAddKpi}
                disabled={isKpiSubmitting || !editKpiInput.title.trim()}
                className="px-4 bg-[var(--brand-orange)] text-black font-bold uppercase text-sm tracking-wide rounded-xl hover:bg-white transition-all disabled:opacity-50"
              >
                {t("adminMisc.programs.add")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
