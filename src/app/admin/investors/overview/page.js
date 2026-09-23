"use client";

import { useState } from "react";
import { Shield, Loader2, Users, Target, MessageSquare, X, UserPlus } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

const STAGE_COLORS={invested:"bg-emerald-500/10 text-emerald-400",due_diligence:"bg-purple-500/10 text-purple-400",negotiation:"bg-orange-500/10 text-orange-400",meeting_requested:"bg-amber-500/10 text-amber-400"};
const REQ_CAT_COLORS={general:"bg-slate-500/10 text-slate-400",financial:"bg-emerald-500/10 text-emerald-400",legal:"bg-purple-500/10 text-purple-400",product:"bg-blue-500/10 text-blue-400",team:"bg-amber-500/10 text-amber-400",market:"bg-rose-500/10 text-rose-400"};

// The shape the screen renders from, so a failed or malformed payload never
// reaches a `.length` / `.stats` read. Module scope keeps both values stable for
// the hook (an inline literal would refetch on every render).
const EMPTY_OVERVIEW={workspaces:[],pipelines:[],stats:{},requests:[]};
const pickOverview=(payload)=>payload?.success?{workspaces:payload.workspaces||[],pipelines:payload.pipelines||[],stats:payload.stats||{},requests:payload.requests||[]}:EMPTY_OVERVIEW;

export default function AdminInvestorOverview() {
  const { t } = useI18n();
  const STAGE_LABELS={invested:t("investorAdmin.overview.invested"),due_diligence:t("investorAdmin.overview.dueDiligence"),negotiation:t("investorAdmin.overview.negotiation"),meeting_requested:t("investorAdmin.overview.introductionRequested")};
  // The loader's work — cache-first paint, discarding a stale response, the
  // background refresh — belongs to the hook, so the screen keeps no data state
  // of its own and never sets state from an effect.
  const {data,loading}=useApi("/api/investor/admin-overview",{defaultValue:EMPTY_OVERVIEW,transform:pickOverview});
  const [detail,setDetail]=useState(null);

  if(loading)return<><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]"/></div></>;

  return(<><div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
    <h1 className="text-2xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{t("investorAdmin.overview.investorActivity")}</h1>

    {/* Stats */}
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[{label:t("investorAdmin.overview.approved"),value:data.stats.approved_investors||0,icon:Users,color:"text-emerald-400"},{label:t("investorAdmin.overview.pending"),value:data.stats.pending_investors||0,icon:Users,color:"text-amber-400"},{label:t("investorAdmin.overview.activeDd"),value:data.stats.active_dd||0,icon:Shield,color:"text-purple-400"},{label:t("investorAdmin.overview.invested"),value:data.stats.total_invested||0,icon:Target,color:"text-[var(--brand-orange)]"}].map((stat,i)=>(<AppCard key={i} padding="md"><div className="flex items-center gap-3"><stat.icon className={`w-5 h-5 ${stat.color}`}/><div><p className="text-2xl font-black text-[var(--text-primary)]">{stat.value}</p><p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{stat.label}</p></div></div></AppCard>))}
    </div>

    {/* DD + Pipelines */}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-3"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.overview.dueDiligenceCount",{count:data.workspaces.length})}</h3>{data.workspaces.length===0?<p className="text-xs text-[var(--text-tertiary)] py-4">{t("investorAdmin.overview.noActiveDd")}</p>:data.workspaces.map(workspace=>(<AppCard key={workspace.id} padding="md"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[var(--text-primary)]">{workspace.venture_name||"—"}</p><p className="text-[10px] text-[var(--text-secondary)]">{workspace.investor_name} · {workspace.organization_name||""}</p></div><span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${workspace.status==="active"?"bg-purple-500/10 text-purple-400":"bg-emerald-500/10 text-emerald-400"}`}>{workspace.status}</span></div></AppCard>))}</div>

      <div className="space-y-3"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.overview.introductionRequestsCount",{count:data.pipelines.filter(pipeline=>pipeline.stage==='meeting_requested').length})}</h3>
        {data.pipelines.filter(pipeline=>pipeline.stage==='meeting_requested').length===0?<p className="text-xs text-[var(--text-tertiary)] py-4">{t("investorAdmin.overview.noPendingIntroductionRequests")}</p>:
          data.pipelines.filter(pipeline=>pipeline.stage==='meeting_requested').map(pipeline=>(<AppCard key={pipeline.id} padding="md" hover onClick={()=>setDetail(pipeline)}>
            <div className="cursor-pointer flex items-center justify-between">
              <div><p className="text-sm font-bold text-[var(--text-primary)]">{pipeline.venture_name||"—"}</p><p className="text-[10px] text-[var(--text-secondary)]">{pipeline.investor_name} · {pipeline.organization_name||""}</p></div>
              <div className="flex items-center gap-2">
                {pipeline.notes && <MessageSquare className="w-3.5 h-3.5 text-amber-400" title={pipeline.notes}/>}
                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400">{STAGE_LABELS[pipeline.stage]||pipeline.stage}</span>
              </div>
            </div>
          </AppCard>))
        }

        {/* Other active pipelines */}
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase mt-4">{t("investorAdmin.overview.activePipelines")}</h3>
        {data.pipelines.filter(pipeline=>pipeline.stage!=='meeting_requested').map(pipeline=>(<AppCard key={pipeline.id} padding="md"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[var(--text-primary)]">{pipeline.venture_name||"—"}</p><p className="text-[10px] text-[var(--text-secondary)]">{pipeline.investor_name} · {pipeline.organization_name||""}</p></div><div className="flex items-center gap-2">{pipeline.investment_amount&&<span className="text-xs font-bold text-emerald-400">${Number(pipeline.investment_amount).toLocaleString()}</span>}<span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${STAGE_COLORS[pipeline.stage]||"bg-slate-500/10 text-slate-400"}`}>{STAGE_LABELS[pipeline.stage]||pipeline.stage}</span></div></div></AppCard>))}
      </div>
    </div>

    {/* Requests */}
    <div className="space-y-3 mt-6"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.overview.informationRequestsCount",{count:data.requests.length})}</h3>{data.requests.length===0?<p className="text-xs text-[var(--text-tertiary)] py-4">{t("investorAdmin.overview.noRequests")}</p>:data.requests.map(request=>(<AppCard key={request.id} padding="md"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${REQ_CAT_COLORS[request.category]||REQ_CAT_COLORS.general}`}>{request.category}</span><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${request.status==="pending"?"bg-amber-500/10 text-amber-400":request.status==="responded"?"bg-emerald-500/10 text-emerald-400":"bg-slate-500/10 text-slate-400"}`}>{request.status}</span></div><p className="text-sm font-bold text-[var(--text-primary)]">{request.title}</p><p className="text-[10px] text-[var(--text-secondary)]">{request.venture_name} · {request.investor_name}</p>{request.response_text&&<p className="text-[10px] text-emerald-400 mt-1">{t("investorAdmin.overview.response",{text:request.response_text})}</p>}</div><span className="text-[10px] text-[var(--text-tertiary)] shrink-0">{new Date(request.created_at).toLocaleDateString()}</span></div></AppCard>))}</div>

    {/* Detail Modal */}
    {detail && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setDetail(null)}/>
        <div className="relative w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorAdmin.overview.introductionRequest")}</h3>
            <button onClick={()=>setDetail(null)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {[[t("investorAdmin.overview.venture"),detail.venture_name||"—"],[t("investorAdmin.overview.investor"),detail.investor_name||"—"],[t("investorAdmin.overview.organization"),detail.organization_name||"—"],[t("investorAdmin.overview.stage"),STAGE_LABELS[detail.stage]||detail.stage],[t("investorAdmin.overview.email"),detail.email||"—"],[t("investorAdmin.overview.date"),new Date(detail.stage_changed_at).toLocaleDateString()]].map(([label,value],i)=>(<div key={i} className="p-3 rounded-xl bg-[var(--surface-3)]"><p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{label}</p><p className="text-xs font-bold text-[var(--text-primary)] mt-1">{value}</p></div>))}
            </div>
            {/* Investor Profile */}
            {(detail.industries?.length > 0 || detail.countries?.length > 0 || detail.startup_stages?.length > 0) && (
              <div className="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)] space-y-2">
                <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">{t("investorAdmin.overview.investorProfile")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {detail.industries?.length > 0 && <div><p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.overview.industries")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">{(detail.industries||[]).join(", ")}</p></div>}
                  {detail.countries?.length > 0 && <div><p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.overview.countries")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">{(detail.countries||[]).join(", ")}</p></div>}
                  {detail.startup_stages?.length > 0 && <div><p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.overview.stages")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">{(detail.startup_stages||[]).join(", ")}</p></div>}
                  {(detail.ticket_size_min || detail.ticket_size_max) && <div><p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">{t("investorAdmin.overview.ticket")}</p><p className="text-[10px] font-bold text-[var(--text-primary)]">${detail.ticket_size_min||"0"}–${detail.ticket_size_max||"∞"}</p></div>}
                </div>
              </div>
            )}
            {detail.notes ? (
              <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wide mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3"/> {t("investorAdmin.overview.investorMessage")}</p>
                <p className="text-xs text-[var(--text-primary)] leading-relaxed">{detail.notes}</p>
              </div>
            ) : <p className="text-xs text-[var(--text-tertiary)] text-center">{t("investorAdmin.overview.noMessageFromInvestor")}</p>}
            <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)]">
              <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-1 flex items-center gap-1"><UserPlus className="w-3 h-3"/> {t("investorAdmin.overview.actions")}</p>
              <p className="text-xs text-[var(--text-secondary)]">{t("investorAdmin.overview.actionsHint")}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 pb-5">
            <AppButton variant="secondary" size="sm" onClick={()=>setDetail(null)}>{t("investorAdmin.overview.close")}</AppButton>
          </div>
        </div>
      </div>
    )}
  </div></>);
}
