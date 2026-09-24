"use client";

import { useState } from "react";
import {
  Building2, Target, DollarSign, Calendar, Loader2,
  ArrowLeft, BarChart3, MessageSquare, Plus, Send, FileText,
  Activity, X,
} from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import GlobalToast from "@/components/ui/GlobalToast";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { useApi } from "@/lib/hooks/useApi";

// Module scope on purpose: the hook keys its internal callback on these
// functions, so inline arrows would give them a new identity on every render and
// refetch in a loop. The decision trace keeps its two related lists together so
// one normaliser covers both.
const EMPTY_DECISION_TRACE = { decisions: [], stats: {} };
const pickInvestedPipeline = (response) =>
  response?.success ? (response.pipeline || []).filter((entry) => entry.stage === "invested") : [];
const pickDecisionTrace = (response) =>
  response?.success
    ? { decisions: response.decisions || [], stats: response.stats || {} }
    : EMPTY_DECISION_TRACE;
const pickMeetings = (response) => (response?.success ? response.meetings || [] : []);
const pickNotes = (response) => (response?.success ? response.notes || [] : []);
const pickUpdates = (response) => (response?.success ? response.updates || [] : []);
const pickKpis = (response) => (response?.success ? response.kpis || [] : []);

export default function PortfolioPage() {
  const goBack = useSafeBack("/investor");
  const { t } = useI18n();
  const [selected, setSelected] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [newNote, setNewNote] = useState("");

  // Meetings
  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [meetingForm, setMeetingForm] = useState({ title: "", description: "", start_time: "", end_time: "", location: "video" });
  const [saving, setSaving] = useState(false);

  // Updates
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [updateForm, setUpdateForm] = useState({ title: "", content: "", update_type: "general" });

  const [toast, setToast] = useState(null);

  // The loaders' work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no data state of its own and never sets state from an effect. The two
  // portfolio reads run on mount; the four detail reads follow the selected
  // venture, staying plain dependencies, and ask for nothing until one is picked.
  // Each mutation flow calls the matching refresh, which bypasses the cache
  // exactly like bypassCache did.
  const { data: pipeline, loading: pipelineLoading } = useApi(
    "/api/investor/dashboard",
    { defaultValue: [], transform: pickInvestedPipeline },
  );
  const { data: decisionTrace, loading: decisionsLoading } = useApi(
    "/api/investor/decisions",
    { defaultValue: EMPTY_DECISION_TRACE, transform: pickDecisionTrace },
  );
  const { decisions, stats } = decisionTrace;
  const loading = pipelineLoading || decisionsLoading;

  const ventureId = selected?.venture_id;
  const pipelineId = selected?.id;
  const { data: meetings, refresh: refreshMeetings } = useApi(
    ventureId ? `/api/investor/meetings?venture_id=${ventureId}` : null,
    { defaultValue: [], transform: pickMeetings, deps: [ventureId] },
  );
  const { data: notes, refresh: refreshNotes } = useApi(
    pipelineId ? `/api/investor/diligence?pipeline_id=${pipelineId}` : null,
    { defaultValue: [], transform: pickNotes, deps: [pipelineId] },
  );
  const { data: updates, refresh: refreshUpdates } = useApi(
    ventureId ? `/api/investor/updates?venture_id=${ventureId}` : null,
    { defaultValue: [], transform: pickUpdates, deps: [ventureId] },
  );
  const { data: kpis } = useApi(
    ventureId ? `/api/investor/venture-kpis?venture_id=${ventureId}` : null,
    { defaultValue: [], transform: pickKpis, deps: [ventureId] },
  );

  const getDecision = (ventureId) => decisions.find(decision => decision.venture_id === ventureId);

  const addNote = async () => {
    if (!newNote.trim() || !selected?.id) return;
    try {
      const response = await fetch("/api/investor/diligence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: selected.id, action: "add_note", content: newNote, note_type: "private" }),
      });
      if (response.ok) { setNewNote(""); refreshNotes(); }
    } catch (_) {}
  };

  const scheduleMeeting = async () => {
    if (!meetingForm.title || !meetingForm.start_time) return;
    setSaving(true);
    try {
      const response = await fetch("/api/investor/meetings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...meetingForm, venture_id: selected.venture_id }),
      });
      if (response.ok) {
        setToast({ type: "success", message: t("investorMisc.portfolio.meetingScheduled") });
        setShowMeetingForm(false);
        setMeetingForm({ title: "", description: "", start_time: "", end_time: "", location: "video" });
        refreshMeetings();
      }
    } catch (_) {}
    setSaving(false);
  };

  const addUpdate = async () => {
    if (!updateForm.title || !updateForm.content) return;
    setSaving(true);
    try {
      const response = await fetch("/api/investor/updates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...updateForm, venture_id: selected.venture_id }),
      });
      if (response.ok) {
        setToast({ type: "success", message: t("investorMisc.portfolio.updatePublished") });
        setShowUpdateForm(false);
        setUpdateForm({ title: "", content: "", update_type: "general" });
        refreshUpdates();
      }
    } catch (_) {}
    setSaving(false);
  };

  if (loading) {
    return <><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>;
  }

  // Company detail
  if (selected) {
    const decision = getDecision(selected.venture_id);
    const upcomingMeetings = meetings.filter(meeting => new Date(meeting.start_time) > new Date());
    return (
      <>
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
          <GlobalToast toast={toast} onClose={() => setToast(null)} />
          <button onClick={() => setSelected(null)} className="text-xs font-bold text-[var(--brand-orange)] hover:underline uppercase flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> {t("investorMisc.portfolio.backToPortfolio")}</button>

          {/* Header */}
          <AppCard padding="lg">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><Building2 className="w-7 h-7 text-emerald-400" /></div>
              <div className="flex-1"><h2 className="text-lg font-black text-[var(--text-primary)] uppercase">{selected.venture_name}</h2><p className="text-sm text-emerald-400 font-bold">{t("investorMisc.portfolio.invested")}</p></div>
              {decision?.investment_amount && <span className="text-xl font-black text-emerald-400">${Number(decision.investment_amount).toLocaleString()}</span>}
            </div>
            {decision && (<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[{label:t("investorMisc.portfolio.decision"),value:decision.decision_type},{label:t("investorMisc.portfolio.date"),value:new Date(decision.decision_date).toLocaleDateString()},{label:t("investorMisc.portfolio.amount"),value:decision.investment_amount?`$${Number(decision.investment_amount).toLocaleString()}`:"—"},{label:t("investorMisc.portfolio.notes"),value:decision.decision_notes||"—"}].map((metric,index)=>(<div key={index} className="p-3 rounded-xl bg-[var(--surface-3)]"><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{metric.label}</p><p className="text-xs font-bold text-[var(--text-primary)] mt-1">{metric.value}</p></div>))}
            </div>)}
          </AppCard>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-[var(--border-primary)] overflow-x-auto">
            {[{id:"overview",label:t("investorMisc.portfolio.overview"),icon:Activity},{id:"updates",label:t("investorMisc.portfolio.updatesCount",{count:updates.length}),icon:FileText},{id:"kpis",label:t("investorMisc.portfolio.kpisCount",{count:kpis.length}),icon:BarChart3},{id:"meetings",label:t("investorMisc.portfolio.meetingsCount",{count:meetings.length}),icon:Calendar},{id:"notes",label:t("investorMisc.portfolio.notesCount",{count:notes.length}),icon:MessageSquare}].map(tab=>(
              <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap relative ${activeTab===tab.id?"text-[var(--brand-orange)]":"text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}><tab.icon className="w-3.5 h-3.5"/>{tab.label}{activeTab===tab.id&&<div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-orange)]"/>}</button>
            ))}
          </div>

          {/* Overview */}
          {activeTab==="overview"&&(<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AppCard padding="lg"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase mb-4 flex items-center gap-2"><FileText className="w-4 h-4 text-[var(--brand-orange)]"/> {t("investorMisc.portfolio.recentUpdates")}</h3>
              {updates.length===0?<p className="text-xs text-[var(--text-tertiary)] text-center py-8">{t("investorMisc.portfolio.noUpdatesYet")}</p>:<div className="space-y-3">{updates.slice(0,3).map(update=>(
                <div key={update.id} className="p-3 rounded-lg bg-[var(--surface-3)]"><div className="flex items-center justify-between mb-1"><p className="text-xs font-bold text-[var(--text-primary)]">{update.title}</p><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-orange/10 text-[var(--brand-orange)]">{update.update_type}</span></div><p className="text-[10px] text-[var(--text-secondary)]">{update.content.substring(0,80)}{update.content.length>80?"...":""}</p><p className="text-[10px] font-medium text-[var(--text-tertiary)] mt-1">{new Date(update.created_at).toLocaleDateString()}</p></div>
              ))}</div>}
            </AppCard>
            <AppCard padding="lg"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-purple-400"/> {t("investorMisc.portfolio.upcomingMeetings")}</h3>
              {upcomingMeetings.length===0?<p className="text-xs text-[var(--text-tertiary)] text-center py-8">{t("investorMisc.portfolio.noUpcomingMeetings")}</p>:<div className="space-y-3">{upcomingMeetings.slice(0,3).map(meeting=>(
                <div key={meeting.id} className="flex items-center gap-3 p-3 rounded-lg bg-brand-orange/5 border border-brand-orange/10"><Calendar className="w-4 h-4 text-[var(--brand-orange)]"/><div className="flex-1"><p className="text-xs font-bold text-[var(--text-primary)]">{meeting.title}</p><p className="text-[10px] text-[var(--text-secondary)]">{new Date(meeting.start_time).toLocaleDateString()} · {meeting.location}</p></div></div>
              ))}</div>}
            </AppCard>
          </div>)}

          {/* Updates */}
          {activeTab==="updates"&&(<div className="space-y-4">
            <div className="flex justify-between items-center"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorMisc.portfolio.updates")}</h3><AppButton variant="primary" size="sm" icon={Plus} onClick={()=>setShowUpdateForm(true)}>{t("investorMisc.portfolio.newUpdate")}</AppButton></div>
            {showUpdateForm&&(<AppCard padding="md"><div className="space-y-3">
              <input value={updateForm.title} onChange={event=>setUpdateForm({...updateForm,title:event.target.value})} placeholder={t("investorMisc.portfolio.updateTitlePlaceholder")} className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"/>
              <textarea value={updateForm.content} onChange={event=>setUpdateForm({...updateForm,content:event.target.value})} rows={3} placeholder={t("investorMisc.portfolio.updateContentPlaceholder")} className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/>
              <div className="flex gap-2">{["general","monthly","quarterly","product","business"].map(updateType=>(<button key={updateType} onClick={()=>setUpdateForm({...updateForm,update_type:updateType})} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${updateForm.update_type===updateType?"bg-[var(--brand-orange)] text-white":"bg-[var(--surface-3)] text-[var(--text-secondary)]"}`}>{t(`investorMisc.portfolio.updateTypes.${updateType}`)}</button>))}</div>
              <div className="flex justify-end gap-2"><AppButton variant="secondary" size="sm" onClick={()=>setShowUpdateForm(false)}>{t("investorMisc.portfolio.cancel")}</AppButton><AppButton variant="primary" size="sm" icon={Send} onClick={addUpdate} disabled={saving}>{saving?t("investorMisc.portfolio.saving"):t("investorMisc.portfolio.publish")}</AppButton></div>
            </div></AppCard>)}
            {updates.length===0&&!showUpdateForm?<div className="text-center py-12"><FileText className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3"/><p className="text-sm font-bold text-[var(--text-secondary)]">{t("investorMisc.portfolio.noUpdatesYet")}</p></div>:<div className="space-y-3">{updates.map(update=>(<AppCard key={update.id} padding="md"><div className="flex items-start gap-3"><div className="w-2 h-2 rounded-full mt-1.5 shrink-0 bg-[var(--brand-orange)]"/><div><div className="flex items-center gap-2 mb-1"><p className="text-sm font-bold text-[var(--text-primary)]">{update.title}</p><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-brand-orange/10 text-[var(--brand-orange)]">{update.update_type}</span></div><p className="text-xs text-[var(--text-secondary)]">{update.content}</p><p className="text-[10px] font-medium text-[var(--text-tertiary)] mt-2">{new Date(update.created_at).toLocaleDateString()}</p></div></div></AppCard>))}</div>}
          </div>)}

          {/* KPIs */}
          {activeTab==="kpis"&&(<div className="space-y-4">
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorMisc.portfolio.kpisFromVentureOs")}</h3>
            {kpis.length===0?<div className="text-center py-12"><BarChart3 className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3"/><p className="text-sm font-bold text-[var(--text-secondary)]">{t("investorMisc.portfolio.noKpiData")}</p></div>:<div className="grid grid-cols-2 md:grid-cols-3 gap-4">{kpis.map(kpi=>(<AppCard key={kpi.kpi_key} padding="md"><div className="text-center"><p className="text-2xl font-black text-[var(--text-primary)]">{kpi.kpi_value}</p><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mt-1">{kpi.kpi_label}</p><span className={`inline-block mt-2 text-[10px] font-bold uppercase ${kpi.trend==="up"?"text-emerald-400":kpi.trend==="down"?"text-rose-400":"text-slate-400"}`}>{kpi.trend==="up"?t("investorMisc.portfolio.trendGrowing"):kpi.trend==="down"?t("investorMisc.portfolio.trendDeclining"):t("investorMisc.portfolio.trendStable")}</span></div></AppCard>))}</div>}
          </div>)}

          {/* Meetings */}
          {activeTab==="meetings"&&(<div className="space-y-4">
            <div className="flex justify-between items-center"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorMisc.portfolio.meetings")}</h3><AppButton variant="primary" size="sm" icon={Plus} onClick={()=>setShowMeetingForm(true)}>{t("investorMisc.portfolio.schedule")}</AppButton></div>
            {meetings.length===0?<div className="text-center py-12"><Calendar className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3"/><p className="text-sm font-bold text-[var(--text-secondary)]">{t("investorMisc.portfolio.noMeetingsYet")}</p></div>:<div className="space-y-3">{meetings.map(meeting=>(<AppCard key={meeting.id} padding="md"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><Calendar className="w-8 h-8 text-[var(--brand-orange)]"/><div><p className="text-sm font-bold text-[var(--text-primary)]">{meeting.title}</p><p className="text-[10px] text-[var(--text-secondary)]">{new Date(meeting.start_time).toLocaleString()} · {meeting.location}{meeting.end_time?` → ${new Date(meeting.end_time).toLocaleString()}`:""}</p></div></div><span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-brand-orange/10 text-[var(--brand-orange)]">{t("investorMisc.portfolio.scheduled")}</span></div></AppCard>))}</div>}
          </div>)}

          {/* Notes */}
          {activeTab==="notes"&&(<div className="space-y-4">
            <AppCard padding="md"><textarea value={newNote} onChange={event=>setNewNote(event.target.value)} rows={2} placeholder={t("investorMisc.portfolio.writeNotePlaceholder")} className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/><div className="flex justify-end mt-3"><AppButton variant="primary" size="sm" icon={Send} onClick={addNote}>{t("investorMisc.portfolio.save")}</AppButton></div></AppCard>
            {notes.length>0?<div className="space-y-3">{notes.map(note=>(<AppCard key={note.id} padding="md"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-500/10 text-slate-400">{note.note_type}</span></div><p className="text-xs text-[var(--text-primary)]">{note.content}</p><p className="text-[10px] text-[var(--text-tertiary)] mt-2">{new Date(note.created_at).toLocaleString()}</p></div></div></AppCard>))}</div>:<div className="text-center py-8"><MessageSquare className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-2"/><p className="text-xs text-[var(--text-tertiary)]">{t("investorMisc.portfolio.noNotesYet")}</p></div>}
          </div>)}

          {/* Meeting Modal */}
          {showMeetingForm&&(<div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setShowMeetingForm(false)}/><div className="relative w-full max-w-md bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto"><div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">{t("investorMisc.portfolio.scheduleMeeting")}</h3><button onClick={()=>setShowMeetingForm(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-3)]"><X className="w-4 h-4"/></button></div><div className="p-6 space-y-4"><input value={meetingForm.title} onChange={event=>setMeetingForm({...meetingForm,title:event.target.value})} placeholder={t("investorMisc.portfolio.meetingTitlePlaceholder")} className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"/><textarea value={meetingForm.description} onChange={event=>setMeetingForm({...meetingForm,description:event.target.value})} rows={2} placeholder={t("investorMisc.portfolio.descriptionPlaceholder")} className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.portfolio.start")}</label><input type="datetime-local" value={meetingForm.start_time} onChange={event=>setMeetingForm({...meetingForm,start_time:event.target.value})} className="w-full mt-1 px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-xs font-bold outline-none"/></div><div><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.portfolio.end")}</label><input type="datetime-local" value={meetingForm.end_time} onChange={event=>setMeetingForm({...meetingForm,end_time:event.target.value})} className="w-full mt-1 px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-xs font-bold outline-none"/></div></div><div><label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t("investorMisc.portfolio.location")}</label><select value={meetingForm.location} onChange={event=>setMeetingForm({...meetingForm,location:event.target.value})} className="w-full mt-1 px-3 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-xs font-bold outline-none"><option value="video">{t("investorMisc.portfolio.videoCall")}</option><option value="in_person">{t("investorMisc.portfolio.inPerson")}</option><option value="phone">{t("investorMisc.portfolio.phoneCall")}</option></select></div></div><div className="flex justify-end gap-3 px-6 pb-5"><AppButton variant="secondary" size="sm" onClick={()=>setShowMeetingForm(false)}>{t("investorMisc.portfolio.cancel")}</AppButton><AppButton variant="primary" size="sm" icon={Calendar} onClick={scheduleMeeting} disabled={saving}>{saving?t("investorMisc.portfolio.scheduling"):t("investorMisc.portfolio.schedule")}</AppButton></div></div></div>)}
        </div>
      </>
    );
  }

  // Main list
  return (
    <>
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={goBack} className="p-2 hover:text-[var(--brand-orange)]"><ArrowLeft className="w-5 h-5"/></button>
          <div><h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">{t("investorMisc.portfolio.title")}</h1><p className="text-xs text-[var(--text-secondary)]">{t("investorMisc.portfolio.yourInvestedVentures")}</p></div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[{label:t("investorMisc.portfolio.invested"),value:pipeline.length,icon:Target,color:"text-emerald-400"},{label:t("investorMisc.portfolio.totalCapital"),value:`$${(stats.total_capital||0).toLocaleString()}`,icon:DollarSign,color:"text-[var(--brand-orange)]"},{label:t("investorMisc.portfolio.decisions"),value:stats.total_decisions||0,icon:BarChart3,color:"text-purple-400"}].map((stat,index)=>(<AppCard key={index} padding="md"><div className="flex items-center gap-3"><stat.icon className={`w-5 h-5 ${stat.color}`}/><div><p className="text-xl font-black text-[var(--text-primary)]">{stat.value}</p><p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{stat.label}</p></div></div></AppCard>))}
        </div>
        {pipeline.length===0?<div className="text-center py-20"><Target className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4"/><h2 className="text-lg font-black text-[var(--text-primary)] uppercase mb-2">{t("investorMisc.portfolio.emptyTitle")}</h2><p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto">{t("investorMisc.portfolio.emptyDesc")}</p></div>:<div className="space-y-3">{pipeline.map(pipelineEntry=>{const decision=getDecision(pipelineEntry.venture_id);return(<AppCard key={pipelineEntry.id} padding="md" hover onClick={()=>setSelected(pipelineEntry)}><div className="flex items-center justify-between cursor-pointer"><div className="flex items-center gap-4"><div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"><Building2 className="w-5 h-5 text-emerald-400"/></div><div><p className="text-sm font-bold text-[var(--text-primary)]">{pipelineEntry.venture_name||t("investorMisc.portfolio.venture")}</p><p className="text-[10px] text-[var(--text-secondary)]">{t("investorMisc.portfolio.invested")} · {new Date(pipelineEntry.stage_changed_at).toLocaleDateString()} · {decision?.investment_amount?`$${Number(decision.investment_amount).toLocaleString()}`:""}</p></div></div><div className="flex items-center gap-2 text-[10px]"><span className="text-emerald-400 font-bold">{t("investorMisc.portfolio.active")}</span><ArrowLeft className="w-3 h-3 rotate-180 text-[var(--text-tertiary)]"/></div></div></AppCard>)})}</div>}
      </div>
    </>
  );
}
