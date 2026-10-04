"use client";

import { Plus, Users, Save } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

/**
 * The Founders tab: the founder-evaluation form and the evaluation list.
 * Extracted verbatim from DueDiligenceContent.
 */
export default function FoundersTab({
  founders,
  showFounderForm,
  setShowFounderForm,
  founderForm,
  setFounderForm,
  saveFounder,
}) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Founder Evaluations</h3><AppButton variant="primary" size="sm" icon={Plus} onClick={()=>setShowFounderForm(true)}>Evaluate Founder</AppButton></div>
      {showFounderForm && (<AppCard padding="md"><div className="space-y-3">
        <input value={founderForm.founder_name} onChange={event=>setFounderForm({...founderForm,founder_name:event.target.value})} placeholder="Founder name *" className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"/>
        <input value={founderForm.role} onChange={event=>setFounderForm({...founderForm,role:event.target.value})} placeholder="Role (e.g. CEO, CTO)" className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"/>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[{key:"experience_score",label:"Experience"},{key:"leadership_score",label:"Leadership"},{key:"domain_expertise_score",label:"Domain"},{key:"overall_rating",label:"Overall"}].map(scoreField=>(<div key={scoreField.key}><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{scoreField.label} (0-10)</label><input type="number" min={0} max={10} value={founderForm[scoreField.key]} onChange={event=>setFounderForm({...founderForm,[scoreField.key]:parseInt(event.target.value)||0})} className="w-full mt-0.5 px-2 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-xs font-bold text-[var(--text-primary)] outline-none"/></div>))}
        </div>
        <textarea value={founderForm.notes} onChange={event=>setFounderForm({...founderForm,notes:event.target.value})} rows={2} placeholder="Evaluation notes..." className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/>
        <div className="flex justify-end gap-2"><AppButton variant="secondary" size="sm" onClick={()=>setShowFounderForm(false)}>Cancel</AppButton><AppButton variant="primary" size="sm" icon={Save} onClick={saveFounder}>Save</AppButton></div>
      </div></AppCard>)}
      {founders.length===0&&!showFounderForm?<div className="text-center py-12"><Users className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3"/><p className="text-sm font-bold text-[var(--text-secondary)]">No founder evaluations yet</p></div>:<div className="space-y-3">{founders.map(founder=>(<AppCard key={founder.id} padding="md"><div className="flex items-start justify-between"><div><p className="text-sm font-bold text-[var(--text-primary)]">{founder.founder_name}{founder.role?` — ${founder.role}`:""}</p><div className="flex gap-4 mt-2 text-[10px]"><span className="text-[var(--text-secondary)]">Exp: <b className="text-[var(--text-primary)]">{founder.experience_score}/10</b></span><span className="text-[var(--text-secondary)]">Leadership: <b className="text-[var(--text-primary)]">{founder.leadership_score}/10</b></span><span className="text-[var(--text-secondary)]">Domain: <b className="text-[var(--text-primary)]">{founder.domain_expertise_score}/10</b></span></div><div className="mt-1"><span className="text-[10px] font-black text-[var(--brand-orange)]">Overall: {founder.overall_rating}/10</span></div>{founder.notes&&<p className="text-[10px] text-[var(--text-tertiary)] mt-2">{founder.notes}</p>}</div></div></AppCard>))}</div>}
    </div>
  );
}
