"use client";

import { useState, useEffect } from "react";
import { Building2, Shield, Loader2, Users, Target } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";

const STAGE_COLORS={invested:"bg-emerald-500/10 text-emerald-400",due_diligence:"bg-purple-500/10 text-purple-400",negotiation:"bg-orange-500/10 text-orange-400",meeting_requested:"bg-amber-500/10 text-amber-400"};
const STAGE_LABELS={invested:"Invested",due_diligence:"Due Diligence",negotiation:"Negotiation",meeting_requested:"Meeting Requested"};
const REQ_CAT_COLORS={general:"bg-slate-500/10 text-slate-400",financial:"bg-emerald-500/10 text-emerald-400",legal:"bg-purple-500/10 text-purple-400",product:"bg-blue-500/10 text-blue-400",team:"bg-amber-500/10 text-amber-400",market:"bg-rose-500/10 text-rose-400"};

export default function AdminInvestorOverview() {
  const [data,setData]=useState({workspaces:[],pipelines:[],stats:{},requests:[]});
  const [loading,setLoading]=useState(true);
  useEffect(()=>{fetch("/api/investor/admin-overview").then(r=>r.json()).then(d=>{if(d.success)setData(d);setLoading(false)});},[]);
  if(loading)return<DashboardLayout role="super_admin"><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]"/></div></DashboardLayout>;
  return(<DashboardLayout role="super_admin"><div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
    <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">Investor Activity</h1>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[{label:"Approved",value:data.stats.approved_investors||0,icon:Users,color:"text-emerald-400"},{label:"Pending",value:data.stats.pending_investors||0,icon:Users,color:"text-amber-400"},{label:"Active DD",value:data.stats.active_dd||0,icon:Shield,color:"text-purple-400"},{label:"Invested",value:data.stats.total_invested||0,icon:Target,color:"text-[var(--brand-orange)]"}].map((s,i)=>(<AppCard key={i} padding="md"><div className="flex items-center gap-3"><s.icon className={`w-5 h-5 ${s.color}`}/><div><p className="text-2xl font-black text-[var(--text-primary)]">{s.value}</p><p className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{s.label}</p></div></div></AppCard>))}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Due Diligence ({data.workspaces.length})</h3>{data.workspaces.length===0?<p className="text-xs text-[var(--text-tertiary)] py-4">No active DD</p>:data.workspaces.map(w=>(<AppCard key={w.id} padding="md"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[var(--text-primary)]">{w.venture_name||"—"}</p><p className="text-[10px] text-[var(--text-secondary)]">{w.investor_name} · {w.organization_name||""}</p></div><span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${w.status==="active"?"bg-purple-500/10 text-purple-400":"bg-emerald-500/10 text-emerald-400"}`}>{w.status}</span></div></AppCard>))}</div>
      <div className="space-y-3"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Active Pipelines ({data.pipelines.length})</h3>{data.pipelines.length===0?<p className="text-xs text-[var(--text-tertiary)] py-4">No active pipelines</p>:data.pipelines.map(p=>(<AppCard key={p.id} padding="md"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[var(--text-primary)]">{p.venture_name||"—"}</p><p className="text-[10px] text-[var(--text-secondary)]">{p.investor_name} · {p.organization_name||""}</p></div><div className="flex items-center gap-2">{p.investment_amount&&<span className="text-xs font-bold text-emerald-400">${Number(p.investment_amount).toLocaleString()}</span>}<span className={`px-2 py-1 rounded text-[9px] font-black uppercase ${STAGE_COLORS[p.stage]||"bg-slate-500/10 text-slate-400"}`}>{STAGE_LABELS[p.stage]||p.stage}</span></div></div></AppCard>))}</div>
    </div>
    <div className="space-y-3 mt-6"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Information Requests ({data.requests.length})</h3>{data.requests.length===0?<p className="text-xs text-[var(--text-tertiary)] py-4">No requests</p>:data.requests.map(r=>(<AppCard key={r.id} padding="md"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${REQ_CAT_COLORS[r.category]||REQ_CAT_COLORS.general}`}>{r.category}</span><span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${r.status==="pending"?"bg-amber-500/10 text-amber-400":r.status==="responded"?"bg-emerald-500/10 text-emerald-400":"bg-slate-500/10 text-slate-400"}`}>{r.status}</span></div><p className="text-sm font-bold text-[var(--text-primary)]">{r.title}</p><p className="text-[10px] text-[var(--text-secondary)]">{r.venture_name} · {r.investor_name}</p>{r.response_text&&<p className="text-[10px] text-emerald-400 mt-1">Response: {r.response_text}</p>}</div><span className="text-[10px] text-[var(--text-tertiary)] shrink-0">{new Date(r.created_at).toLocaleDateString()}</span></div></AppCard>))}</div>
  </div></DashboardLayout>);
}
