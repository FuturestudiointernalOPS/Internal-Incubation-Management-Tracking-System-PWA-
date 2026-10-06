'use client';

import React from 'react';
import { Target, Activity, Trash2 } from 'lucide-react';
import { useI18n } from "@/lib/i18n";

export default function KpiManagement({ kpis, isEditingKpi, setIsEditingKpi, kpiForm, setKpiForm, handleKpiAction, isSubmitting }) {
  const { t } = useI18n();
  return (
    <div className="ios-card bg-secondary border-[var(--border-primary)] !p-10 space-y-8">
      <div className="flex justify-between items-start">
         <div>
            <div className="flex items-center gap-3">
               <Target className="w-5 h-5 text-[#FF6600]" />
               <h3 className="text-xl font-black text-white uppercase tracking-tighter">{t("adminMisc.programDetail.strategicKpis")}</h3>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-md">
               {t("adminMisc.programDetail.kpiDescription")}
            </p>
         </div>
         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-2">{t("adminMisc.programDetail.definedBySuperAdmin")}</p>
      </div>

      <div className="space-y-4">
         {kpis.map(kpi => (
            <div key={kpi.id} className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl group hover:border-[#FF6600]/30 transition-all">
               <div className="flex flex-col text-left">
                  <p className="text-xs font-black text-white uppercase tracking-tighter">{kpi.title}</p>
                  <p className="text-[10px] font-bold text-[#FF6600] uppercase tracking-widest mt-1">{t("adminMisc.programDetail.targetLabel", { value: kpi.target_value })}</p>
               </div>
               <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                     onClick={() => { setIsEditingKpi(kpi.id); setKpiForm({ title: kpi.title, target_value: kpi.target_value }); }}
                     className="p-2 hover:text-[#FF6600] transition-colors"
                  >
                     <Activity className="w-3.5 h-3.5" />
                  </button>
                  <button 
                     onClick={() => handleKpiAction('delete', kpi.id)}
                     className="p-2 hover:text-rose-500 transition-colors"
                  >
                     <Trash2 className="w-3.5 h-3.5" />
                  </button>
               </div>
            </div>
         ))}

         <div className="pt-6 border-t border-white/5 space-y-4">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isEditingKpi ? t("adminMisc.programDetail.editStrategicKpi") : t("adminMisc.programDetail.defineNewKpi")}</h4>
            <div className="grid grid-cols-2 gap-4">
               <input 
                  type="text"
                  placeholder={t("adminMisc.programDetail.kpiTitlePlaceholder")}
                  value={kpiForm.title}
                  onChange={event => setKpiForm({...kpiForm, title: event.target.value})}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#FF6600]/50 transition-all"
               />
               <input 
                  type="text"
                  placeholder={t("adminMisc.programDetail.targetPlaceholder")}
                  value={kpiForm.target_value}
                  onChange={event => setKpiForm({...kpiForm, target_value: event.target.value})}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white outline-none focus:border-[#FF6600]/50 transition-all"
               />
            </div>
            <div className="flex justify-end gap-3">
               {isEditingKpi && (
                  <button onClick={() => { setIsEditingKpi(null); setKpiForm({ title: '', target_value: '' }); }} className="text-[10px] font-bold text-slate-500 uppercase">{t("adminMisc.programDetail.cancel")}</button>
               )}
               <button 
                  onClick={() => handleKpiAction(isEditingKpi ? 'update' : 'create', isEditingKpi)}
                  disabled={isSubmitting || !kpiForm.title || !kpiForm.target_value}
                  className="px-6 py-2 bg-[#FF6600] text-black text-sm font-bold uppercase tracking-wide rounded-lg hover:bg-white transition-all disabled:opacity-50"
               >
                  {isSubmitting ? '...' : isEditingKpi ? t("adminMisc.programDetail.updateKpi") : t("adminMisc.programDetail.deployKpi")}
               </button>
            </div>
         </div>
      </div>
    </div>
  );
}
