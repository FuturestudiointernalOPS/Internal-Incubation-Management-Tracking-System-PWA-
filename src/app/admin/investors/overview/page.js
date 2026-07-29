"use client";

import { useState, useEffect } from "react";
import { Building2, Shield, Loader2, Users, Target, MessageSquare, X, UserPlus } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";

const STAGE_COLORS={invested:"bg-emerald-500/10 text-emerald-400",due_diligence:"bg-purple-500/10 text-purple-400",negotiation:"bg-orange-500/10 text-orange-400",meeting_requested:"bg-amber-500/10 text-amber-400"};
const STAGE_LABELS={invested:"Invested",due_diligence:"Due Diligence",negotiation:"Negotiation",meeting_requested:"Introduction Requested"};
const REQ_CAT_COLORS={general:"bg-slate-500/10 text-slate-400",financial:"bg-emerald-500/10 text-emerald-400",legal:"bg-purple-500/10 text-purple-400",product:"bg-blue-500/10 text-blue-400",team:"bg-amber-500/10 text-amber-400",market:"bg-rose-500/10 text-rose-400"};

export default function AdminInvestorOverview() {
  const [data,setData]=useState({workspaces:[],pipelines:[],stats:{},requests:[]});
  const [loading,setLoading]=useState(true);
  const [detail,setDetail]=useState(null);

  useEffect(()=>{fetch("/api/investor/admin-overview").then(r=>r.json()).then(d=>{if(d.success)setData(d);setLoading(false)});},[]);

  if(loading)return<DashboardLayout role="super_admin"><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]"/></div></DashboardLayout>;

  return(<DashboardLayout role="super_admin"><div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
    <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Investor Activity</h1>

    {/* Stats */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[{label:"Approved",value:data.stats.approved_investors||0,icon:Users,color:"text-emerald-400"},{label:"Pending",value:data.stats.pending_investors||0,icon:Users,color:"text-amber-400"},{label:"Active DD",value:data.stats.active_dd||0,icon:Shield,color:"text-purple-400"},{label:"Invested",value:data.stats.total_invested||0,icon:Target,color:"text-[var(--brand-orange)]"}].map((s,i)=>(<AppCard key={i} padding="md"><div className="flex items-center gap-3"><s.icon className={`w-5 h-5 ${s.color}`}/><div><p className="text-2xl font-black text-[var(--text-primary)]">{s.value}</p><p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{s.label}</p></div></div></AppCard>))}
    </div>

    {/* DD + Pipelines */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Due Diligence ({data.workspaces.length})</h3>{data.workspaces.length===0?<p className="text-xs text-[var(--text-tertiary)] py-4">No active DD</p>:data.workspaces.map(w=>(<AppCard key={w.id} padding="md"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[var(--text-primary)]">{w.venture_name||"—"}</p><p className="text-[10px] text-[var(--text-secondary)]">{w.investor_name} · {w.organization_name||""}</p></div><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${w.status==="active"?"bg-purple-500/10 text-purple-400":"bg-emerald-500/10 text-emerald-400"}`}>{w.status}</span></div></AppCard>))}</div>

      <div className="space-y-3"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Introduction Requests ({data.pipelines.filter(p=>p.stage==='meeting_requested').length})</h3>
        {data.pipelines.filter(p=>p.stage==='meeting_requested').length===0?<p className="text-xs text-[var(--text-tertiary)] py-4">No pending introduction requests</p>:
          data.pipelines.filter(p=>p.stage==='meeting_requested').map(p=>(<AppCard key={p.id} padding="md" hover onClick={()=>setDetail(p)}>
            <div className="cursor-pointer flex items-center justify-between">
              <div><p className="text-sm font-bold text-[var(--text-primary)]">{p.venture_name||"—"}</p><p className="text-[10px] text-[var(--text-secondary)]">{p.investor_name} · {p.organization_name||""}</p></div>
              <div className="flex items-center gap-2">
                {p.notes && <MessageSquare className="w-3.5 h-3.5 text-amber-400" title={p.notes}/>}
                <span className="px-2 py-1 rounded text-[9px] font-black uppercase bg-amber-500/10 text-amber-400">{STAGE_LABELS[p.stage]||p.stage}</span>
              </div>
            </div>
          </AppCard>))
        }

        {/* Other active pipelines */}
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase mt-4">Active Pipelines</h3>
        {data.pipelines.filter(p=>p.stage!=='meeting_requested').map(p=>(<AppCard key={p.id} padding="md"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[var(--text-primary)]">{p.venture_name||"—"}</p><p className="text-[10px] text-[var(--text-secondary)]">{p.investor_name} · {p.organization_name||""}</p></div><div className="flex items-center gap-2">{p.investment_amount&&<span className="text-xs font-bold text-emerald-400">${Number(p.investment_amount).toLocaleString()}</span>}<span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${STAGE_COLORS[p.stage]||"bg-slate-500/10 text-slate-400"}`}>{STAGE_LABELS[p.stage]||p.stage}</span></div></div></AppCard>))}
      </div>
    </div>

    {/* Requests */}
    <div className="space-y-3 mt-6"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Information Requests ({data.requests.length})</h3>{data.requests.length===0?<p className="text-xs text-[var(--text-tertiary)] py-4">No requests</p>:data.requests.map(r=>(<AppCard key={r.id} padding="md"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${REQ_CAT_COLORS[r.category]||REQ_CAT_COLORS.general}`}>{r.category}</span><span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${r.status==="pending"?"bg-amber-500/10 text-amber-400":r.status==="responded"?"bg-emerald-500/10 text-emerald-400":"bg-slate-500/10 text-slate-400"}`}>{r.status}</span></div><p className="text-sm font-bold text-[var(--text-primary)]">{r.title}</p><p className="text-[10px] text-[var(--text-secondary)]">{r.venture_name} · {r.investor_name}</p>{r.response_text&&<p className="text-[10px] text-emerald-400 mt-1">Response: {r.response_text}</p>}</div><span className="text-[10px] text-[var(--text-tertiary)] shrink-0">{new Date(r.created_at).toLocaleDateString()}</span></div></AppCard>))}</div>

    {/* Detail Modal */}
    {detail && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setDetail(null)}/>
        <div className="relative w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Introduction Request</h3>
            <button onClick={()=>setDetail(null)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[["Venture",detail.venture_name||"—"],["Investor",detail.investor_name||"—"],["Organization",detail.organization_name||"—"],["Stage",STAGE_LABELS[detail.stage]||detail.stage],["Date",new Date(detail.stage_changed_at).toLocaleDateString()]].map(([l,v],i)=>(<div key={i} className="p-3 rounded-xl bg-[var(--surface-3)]"><p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{l}</p><p className="text-xs font-bold text-[var(--text-primary)] mt-1">{v}</p></div>))}
            </div>
            {detail.notes ? (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3"/> Investor Message</p>
                <p className="text-xs text-[var(--text-primary)] leading-relaxed">{detail.notes}</p>
              </div>
            ) : <p className="text-xs text-[var(--text-tertiary)] text-center">No message from investor</p>}
            <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)]">
              <p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest mb-1 flex items-center gap-1"><UserPlus className="w-3 h-3"/> Actions</p>
              <p className="text-xs text-[var(--text-secondary)]">Contact the investor and venture founder to coordinate the introduction. Update the pipeline stage once the meeting is scheduled.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-5">
            <AppButton variant="secondary" size="sm" onClick={()=>setDetail(null)}>Close</AppButton>
          </div>
        </div>
      </div>
    )}
  </div></DashboardLayout>);
}
