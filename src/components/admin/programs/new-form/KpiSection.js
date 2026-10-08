import { Target, Plus, Trash2 } from "lucide-react";

/** Strategic KPI configuration (100%-total strategy). */
export default function KpiSection({ t, kpisList, setKpisList, kpiInput, setKpiInput }) {
  return (
    <div className="card space-y-6 relative overflow-hidden">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center text-[var(--brand-orange)]">
            <Target className="w-5 h-5" />
          </div>
          <div className="text-left">
            <h3 className="text-xl font-black text-white uppercase tracking-tight">
              {t("adminMisc.newProgram.strategicKpisConfiguration")}
            </h3>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">
              {t("adminMisc.newProgram.defineKpiTargets")}
            </p>
            <p className="text-sm text-[var(--text-secondary)] mt-3 max-w-2xl leading-relaxed">
              <strong className="text-[var(--text-primary)]">
                {t("adminMisc.newProgram.targetTitle")}
              </strong>{" "}
              {t("adminMisc.newProgram.targetDescription")}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-6 items-end">
        <div className="space-y-1 text-left">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] ml-2">
            {t("adminMisc.newProgram.kpiTitle")}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder={t("adminMisc.newProgram.kpiTitlePlaceholder")}
              value={kpiInput.title}
              onChange={(event) =>
                setKpiInput({ ...kpiInput, title: event.target.value })
              }
              className="flex-1 bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)]"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={kpiInput.target_value}
              onChange={(event) =>
                setKpiInput({ ...kpiInput, target_value: parseInt(event.target.value) || 0 })
              }
              className="w-20 bg-primary border border-[var(--border-primary)] rounded-xl p-4 text-xs font-bold text-white outline-none focus:border-[var(--brand-orange)] text-center"
              placeholder="%"
            />
            <button
              type="button"
              onClick={() => {
                if (!kpiInput.title.trim()) return;
                // Stratégie 100% : le total des KPIs fait toujours 100
                // Le dernier KPI existant est divisé par 2, le nouveau prend la valeur courante
                const currentValue = kpiInput.target_value || 100;
                const nextValue = Math.max(1, Math.floor(currentValue / 2));
                const updated = [...kpisList];
                if (updated.length > 0) {
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = {
                    ...last,
                    target_value: Math.max(1, Math.floor(last.target_value / 2)),
                  };
                }
                setKpisList([
                  ...updated,
                  {
                    title: kpiInput.title,
                    target_value: currentValue,
                  },
                ]);
                setKpiInput({ title: "", target_value: nextValue });
              }}
              className="px-6 bg-[var(--brand-orange)] text-black font-bold uppercase text-[10px] tracking-widest rounded-xl hover:bg-white transition-all flex items-center justify-center shrink-0"
            >
              <Plus className="w-4 h-4" /> {t("adminMisc.newProgram.add")}
            </button>
          </div>
        </div>
      </div>

      {kpisList.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-[var(--border-primary)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] text-left">
            {t("adminMisc.newProgram.definedKpis", {
              count: kpisList.length,
            })}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {kpisList.map((kpi, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 bg-white/[0.02] border border-[var(--border-primary)] rounded-xl group hover:border-brand-orange/30 transition-all text-left"
              >
                <div>
                  <p className="text-xs font-bold text-white uppercase tracking-tighter">
                    {kpi.title}
                    <span className="text-[var(--brand-orange)] ml-2">
                      {kpi.target_value}%
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setKpisList(kpisList.filter((_, itemIndex) => itemIndex !== index))
                  }
                  className="text-slate-500 hover:text-rose-500 transition-colors p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
