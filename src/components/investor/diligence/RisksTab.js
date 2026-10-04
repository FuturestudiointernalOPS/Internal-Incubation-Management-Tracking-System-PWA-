"use client";

import { Plus, AlertTriangle } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

/**
 * The Risks tab: the risk-assessment form and the risk list.
 * Extracted verbatim from DueDiligenceContent.
 */
export default function RisksTab({
  risks,
  showRiskForm,
  setShowRiskForm,
  riskForm,
  setRiskForm,
  saveRisk,
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Risk Assessments</h3><AppButton variant="primary" size="sm" icon={Plus} onClick={()=>setShowRiskForm(true)}>Add Risk</AppButton></div>
      {showRiskForm && (<AppCard padding="md"><div className="space-y-3">
        <div className="flex gap-2">{["market","product","financial","operational","legal"].map(riskCategory=>(<button key={riskCategory} onClick={()=>setRiskForm({...riskForm,risk_category:riskCategory})} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${riskForm.risk_category===riskCategory?"bg-[var(--brand-orange)] text-white":"bg-[var(--surface-3)] text-[var(--text-secondary)]"}`}>{riskCategory}</button>))}</div>
        <textarea value={riskForm.risk_description} onChange={event=>setRiskForm({...riskForm,risk_description:event.target.value})} rows={2} placeholder="Describe the risk *" className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Severity</label><select value={riskForm.severity} onChange={event=>setRiskForm({...riskForm,severity:event.target.value})} className="w-full mt-0.5 px-2 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-xs font-bold outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
          <div><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">Status</label><select value={riskForm.status} onChange={event=>setRiskForm({...riskForm,status:event.target.value})} className="w-full mt-0.5 px-2 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-xs font-bold outline-none"><option value="open">Open</option><option value="mitigated">Mitigated</option><option value="accepted">Accepted</option></select></div>
          <div/>
        </div>
        <input value={riskForm.mitigation} onChange={event=>setRiskForm({...riskForm,mitigation:event.target.value})} placeholder="Mitigation strategy (optional)" className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"/>
        <div className="flex justify-end gap-2"><AppButton variant="secondary" size="sm" onClick={()=>setShowRiskForm(false)}>Cancel</AppButton><AppButton variant="primary" size="sm" onClick={saveRisk}>Save</AppButton></div>
      </div></AppCard>)}
      {risks.length===0&&!showRiskForm?<div className="text-center py-12"><AlertTriangle className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3"/><p className="text-sm font-bold text-[var(--text-secondary)]">No risks assessed yet</p></div>:<div className="space-y-3">{risks.map(risk=>{const severityColors={low:"bg-blue-500/10 text-blue-400",medium:"bg-amber-500/10 text-amber-400",high:"bg-orange-500/10 text-orange-400",critical:"bg-rose-500/10 text-rose-400"};return(<AppCard key={risk.id} padding="md"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-500/10 text-purple-400">{risk.risk_category}</span><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${severityColors[risk.severity]||severityColors.medium}`}>{risk.severity}</span><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${risk.status==="open"?"bg-amber-500/10 text-amber-400":risk.status==="mitigated"?"bg-emerald-500/10 text-emerald-400":"bg-slate-500/10 text-slate-400"}`}>{risk.status}</span></div><p className="text-xs text-[var(--text-primary)]">{risk.risk_description}</p>{risk.mitigation&&<p className="text-[10px] text-emerald-400 mt-1">Mitigation: {risk.mitigation}</p>}</div></div></AppCard>)})}</div>}
    </div>
  );
}
