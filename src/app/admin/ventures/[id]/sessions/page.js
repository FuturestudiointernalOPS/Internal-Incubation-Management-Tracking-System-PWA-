"use client";

import React, { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, X, Plus, Calendar, Clock, User,
  Video, MapPin, BookOpen, Target,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];

const pickVenture = (payload) => (payload?.success ? payload.venture || null : null);
const pickSessions = (payload) => (payload?.success ? payload.sessions || [] : []);
const pickCoaches = (payload) => (payload?.success ? payload.coaches || [] : []);
import { stageStatusWord, statusLabel } from "@/lib/ventureStatuses";

const SESSION_TYPE_CFG = {
  coaching: { label: "vadmin.sessions.coaching", color: "bg-blue-500/10 text-blue-400" },
  mentoring: { label: "vadmin.sessions.mentoring", color: "bg-purple-500/10 text-purple-400" },
  advisory: { label: "vadmin.sessions.advisory", color: "bg-emerald-500/10 text-emerald-400" },
  office_hours: { label: "vadmin.sessions.officeHours", color: "bg-amber-500/10 text-amber-400" },
  review_meeting: { label: "vadmin.sessions.review", color: "bg-brand-orange/10 text-[var(--brand-orange)]" },
};

const STATUS_CFG = {
  scheduled: { label: "vadmin.sessions.statusScheduled", color: "text-blue-400 bg-blue-500/10" },
  confirmed: { label: "vadmin.sessions.statusConfirmed", color: "text-emerald-400 bg-emerald-500/10" },
  in_progress: { label: "vadmin.sessions.statusInProgress", color: "text-amber-400 bg-amber-500/10" },
  completed: { label: "vadmin.sessions.statusCompleted", color: "text-emerald-400 bg-emerald-500/10" },
  cancelled: { label: "vadmin.sessions.statusCancelled", color: "text-slate-500 bg-slate-500/10" },
  rescheduled: { label: "vadmin.sessions.statusRescheduled", color: "text-amber-400 bg-amber-500/10" },
  no_show: { label: "vadmin.sessions.statusNoShow", color: "text-rose-400 bg-rose-500/10" },
};

export default function VentureSessionsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [toast, setToast] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("upcoming");

  // Form
  const [sForm, setSForm] = useState({ title: "", session_type: "coaching", coach_id: "", start_time: "", end_time: "", meeting_link: "", description: "", venture_facing: false, journey_stage_id: "", milestone_ref: "", task_id: "" });

  // Journey context reference data for the create form (stage -> milestone -> task)
  const [journeyStages, setJourneyStages] = useState([]);
  const [milestoneOptions, setMilestoneOptions] = useState([]);
  const [taskOptions, setTaskOptions] = useState([]);

  // Notes
  const [noteText, setNoteText] = useState("");

  // Action items
  const [aiTitle, setAiTitle] = useState("");

  // The venture, its sessions and the coaches they involve, through the shared
  // hook: it owns the cache, the cache-first paint and the discarding of a stale
  // answer, so the page keeps no copy of its own and reads during render.
  const { data: venture, loading: ventureLoading } = useApi(
    id ? `/api/ventures/${id}` : null,
    { defaultValue: null, transform: pickVenture, deps: [id] },
  );
  const {
    data: sessions,
    loading: sessionsLoading,
    refresh: refreshSessions,
  } = useApi(id ? `/api/ventures/${id}/sessions` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickSessions,
    deps: [id],
  });
  const { data: coaches, loading: coachesLoading } = useApi(
    id ? `/api/ventures/${id}/coaches` : null,
    { defaultValue: EMPTY_LIST, transform: pickCoaches, deps: [id] },
  );

  const loading = ventureLoading || sessionsLoading || coachesLoading;

  // Every action below re-reads what it changed.
  const reload = useCallback(() => {
    refreshSessions();
  }, [refreshSessions]);

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const loadSessionDetail = async (sessionId) => {
    try {
      const response = await fetch(`/api/ventures/${id}/sessions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_session", session_id: sessionId }),
      });
      const payload = await response.json();
      if (payload.success) { setSelectedSession(payload.session); setShowDetail(true); }
    } catch {}
  };

  // Stage/milestone/task pickers load when the create modal opens so they
  // reflect the latest journey structure (Super Admin sees all stages incl.
  // locked ones — the staff authoring view).
  const loadJourneyContext = async () => {
    try {
      const [journeyResponse, milestonesResponse, tasksResponse] = await Promise.all([
        fetch(`/api/ventures/${id}/journey`),
        fetch(`/api/ventures/${id}/milestones`),
        fetch(`/api/ventures/${id}/tasks`),
      ]);
      const journeyData = await journeyResponse.json();
      const milestonesData = await milestonesResponse.json();
      const tasksData = await tasksResponse.json();
      if (journeyData.success) setJourneyStages(journeyData.stages || []);
      if (milestonesData.success) setMilestoneOptions(milestonesData.milestones || []);
      if (tasksData.success) setTaskOptions(tasksData.tasks || []);
    } catch {}
  };

  // Journey stage wording — ONE vocabulary, shared with the admin timeline, the
  // Venture Manager panel and the founder's journey tab (lib/ventureStatuses).
  const stageStatusLabel = (status) => statusLabel(stageStatusWord(status), t);

  const openCreateModal = () => {
    // Fresh journey context each time (options may have changed since last open).
    setSForm((previous) => ({ ...previous, journey_stage_id: "", milestone_ref: "", task_id: "" }));
    setShowCreateModal(true);
    loadJourneyContext();
  };

  // Milestones bound to the selected Journey stage (unbound legacy rows are
  // skipped), then tasks bound to the selected milestone (milestone_id may be
  // TEXT — always compare stringified).
  const stageMilestones = sForm.journey_stage_id
    ? milestoneOptions.filter((milestone) => String(milestone.journey_stage_id) === String(sForm.journey_stage_id))
    : [];
  const milestoneTasks = sForm.milestone_ref
    ? taskOptions.filter((task) => String(task.milestone_id) === String(sForm.milestone_ref))
    : [];

  const RESET_SFORM = { title: "", session_type: "coaching", coach_id: "", start_time: "", end_time: "", meeting_link: "", description: "", venture_facing: false, journey_stage_id: "", milestone_ref: "", task_id: "" };

  const createNewSession = async () => {
    if (!sForm.title.trim() || !sForm.start_time || !sForm.end_time) { notify(t("vadmin.sessions.titleStartEndRequired"), "error"); return; }
    // A session always carries its internal note (compulsory, like the Journey panel).
    if (!String(sForm.description || "").trim()) { notify(t("vadmin.sessions.noteRequired"), "error"); return; }
    // A session never lives outside a milestone (Vinance 3).
    if (!sForm.journey_stage_id || !sForm.milestone_ref) { notify(t("vadmin.sessions.milestoneRequired"), "error"); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/ventures/${id}/sessions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_session", ...sForm,
          journey_stage_id: sForm.journey_stage_id || null,
          milestone_ref: sForm.milestone_ref || null,
          task_id: sForm.task_id ? parseInt(sForm.task_id) : null,
          coach_id: sForm.coach_id ? parseInt(sForm.coach_id) : null,
        }),
      });
      const payload = await response.json();
      if (payload.success) { notify(t("vadmin.sessions.sessionCreated")); setShowCreateModal(false); setSForm({ ...RESET_SFORM }); reload(); }
      else notify(t((payload.error || t("vadmin.sessions.failed")) || "") || (payload.error || t("vadmin.sessions.failed")), "error");
    } catch { notify(t("vadmin.sessions.networkError"), "error"); }
    setSaving(false);
  };

  const cancelSession = async (sessionId) => {
    await fetch(`/api/ventures/${id}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel_session", session_id: sessionId }) });
    notify(t("vadmin.sessions.sessionCancelled"));
    setShowDetail(false);
    reload();
  };

  const addNote = async () => {
    if (!noteText.trim() || !selectedSession) return;
    await fetch(`/api/ventures/${id}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_note", session_id: selectedSession.id, content: noteText.trim() }) });
    setNoteText("");
    loadSessionDetail(selectedSession.id);
  };

  const addActionItem = async () => {
    if (!aiTitle.trim() || !selectedSession) return;
    await fetch(`/api/ventures/${id}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_action_item", session_id: selectedSession.id, title: aiTitle.trim() }) });
    setAiTitle("");
    loadSessionDetail(selectedSession.id);
  };

  if (loading) return (
    <><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>
  );

  const upcoming = sessions.filter((session) => ["scheduled", "confirmed"].includes(session.status));
  const past = sessions.filter((session) => ["completed", "cancelled", "no_show", "rescheduled"].includes(session.status));

  return (
    <>
      <div className="space-y-8 pb-20">
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${toast.type==="error"?"bg-rose-600 text-white":"bg-emerald-600 text-white"}`}>
            {toast.type==="error"?<AlertCircle className="w-4 h-4"/>:<CheckCircle2 className="w-4 h-4"/>}{toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={()=>router.push(`/admin/ventures/${id}`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.sessions.backToDashboard")}
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <Calendar className="w-6 h-6 text-[var(--brand-orange)]" /> {t("vadmin.sessions.mentoringSessions")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name||""} · {t("vadmin.sessions.upcomingCount", { count: upcoming.length })}</p>
          </div>
          <button onClick={()=>openCreateModal()} className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> {t("vadmin.sessions.scheduleSession")}
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 border-b border-[var(--border-primary)] pb-2">
          {["upcoming", "past", "all"].map((filterTab) => (
            <button key={filterTab} onClick={()=>setFilter(filterTab)}
              className={`text-[9px] font-black uppercase tracking-wider pb-2 border-b-2 transition-all ${filter===filterTab?"border-[var(--brand-orange)] text-[var(--brand-orange)]":"border-transparent text-slate-500"}`}>
              {filterTab==="upcoming"?t("vadmin.sessions.tabUpcoming",{count:upcoming.length}):filterTab==="past"?t("vadmin.sessions.tabPast",{count:past.length}):t("vadmin.sessions.tabAll")}
            </button>
          ))}
        </div>

        {/* Sessions List */}
        {(filter==="upcoming"?upcoming:filter==="past"?past:sessions).length===0 ? (
          <div className="text-center py-16"><Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">{t("vadmin.sessions.noSessionsFound")}</p></div>
        ) : (
          <div className="space-y-3">
            {(filter==="upcoming"?upcoming:filter==="past"?past:sessions).map((session) => {
              const typeConfig = SESSION_TYPE_CFG[session.session_type] || SESSION_TYPE_CFG.coaching;
              const statusConfig = STATUS_CFG[session.status] || STATUS_CFG.scheduled;
              return (
                <div key={session.id} onClick={()=>loadSessionDetail(session.id)}
                  className="p-5 rounded-2xl bg-tertiary border border-[var(--border-primary)] cursor-pointer hover:border-brand-orange/30 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${typeConfig.color}`}>
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-[var(--text-primary)]">{session.title}</p>
                          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${typeConfig.color}`}>{t(typeConfig.label)}</span>
                          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${statusConfig.color}`}>{t(statusConfig.label)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{new Date(session.start_time).toLocaleString()}</span>
                          {session.coach_name && <span className="flex items-center gap-1"><User className="w-3 h-3"/>{session.coach_name}</span>}
                          {session.meeting_link && <span className="flex items-center gap-1"><Video className="w-3 h-3"/>{t("vadmin.sessions.online")}</span>}
                          {session.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{session.location}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {session.status==="scheduled" && (
                        <button onClick={(event)=>{event.stopPropagation(); cancelSession(session.id);}} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><X className="w-4 h-4"/></button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Create Session Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.sessions.scheduleSession")}</h2>
              <button onClick={()=>setShowCreateModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.titleRequired")}</label>
                <input value={sForm.title} onChange={(event)=>setSForm((previous)=>({...previous,title:event.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.type")}</label>
                  <select value={sForm.session_type} onChange={(event)=>setSForm((previous)=>({...previous,session_type:event.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="coaching">{t("vadmin.sessions.coaching")}</option><option value="mentoring">{t("vadmin.sessions.mentoring")}</option><option value="advisory">{t("vadmin.sessions.advisory")}</option>
                    <option value="office_hours">{t("vadmin.sessions.officeHours")}</option><option value="review_meeting">{t("vadmin.sessions.reviewMeeting")}</option><option value="pitch_review">{t("vadmin.sessions.pitchReview")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.coach")}</label>
                  <select value={sForm.coach_id} onChange={(event)=>setSForm((previous)=>({...previous,coach_id:event.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="">{t("vadmin.sessions.selectPlaceholder")}</option>
                    {(coaches||[]).filter((coach)=>coach.coach_type==="coach").map((coach)=>(
                      <option key={coach.id} value={coach.id}>{coach.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.startRequired")}</label>
                  <input type="datetime-local" value={sForm.start_time} onChange={(event)=>setSForm((previous)=>({...previous,start_time:event.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.endRequired")}</label>
                  <input type="datetime-local" value={sForm.end_time} onChange={(event)=>setSForm((previous)=>({...previous,end_time:event.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.meetingLink")}</label>
                <input value={sForm.meeting_link} onChange={(event)=>setSForm((previous)=>({...previous,meeting_link:event.target.value}))} placeholder="https://meet.google.com/..." className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.descriptionRequired")}</label>
                <textarea
                  value={sForm.description}
                  onChange={(event) => { setSForm((previous) => ({ ...previous, description: event.target.value })); const element = event.target; element.style.height = "auto"; element.style.height = `${element.scrollHeight}px`; }}
                  rows={3}
                  required
                  placeholder={t("vadmin.sessions.description")}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none resize-none overflow-hidden min-h-[72px]"
                />
              </div>
              {/* Journey context: optional stage/milestone/task links for this session */}
              <div className="rounded-xl border border-[var(--border-primary)] bg-primary p-3 space-y-3">
                <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.sessions.journeyContext")}</p>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.journeyStage")}</label>
                  {journeyStages.length === 0 ? (
                    <p className="text-[9px] text-slate-500">{t("vadmin.sessions.noJourneyStages")}</p>
                  ) : (
                    <select value={sForm.journey_stage_id} onChange={(event)=>{ setSForm((previous)=>({ ...previous, journey_stage_id: event.target.value, milestone_ref: "", task_id: "" })); }}
                      className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                      <option value="">{t("vadmin.sessions.selectPlaceholder")}</option>
                      {journeyStages.map((stage)=>(
                        <option key={stage.id} value={stage.id}>{stage.name} ({stageStatusLabel(stage.status)})</option>
                      ))}
                    </select>
                  )}
                </div>
                {(milestoneOptions.length === 0 || (sForm.journey_stage_id && stageMilestones.length === 0)) && (
                  <p className="text-[9px] text-amber-400">{t("vadmin.sessions.noMilestones")}</p>
                )}
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.milestone")}</label>
                  <select value={sForm.milestone_ref} disabled={!sForm.journey_stage_id} onChange={(event)=>{ setSForm((previous)=>({ ...previous, milestone_ref: event.target.value, task_id: "" })); }}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none disabled:opacity-40">
                    <option value="">{t("vadmin.sessions.selectPlaceholder")}</option>
                    {stageMilestones.map((milestone)=>(
                      <option key={milestone.id} value={String(milestone.id)}>{milestone.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.task")}</label>
                  <select value={sForm.task_id} disabled={!sForm.milestone_ref} onChange={(event)=>setSForm((previous)=>({...previous,task_id:event.target.value}))}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none disabled:opacity-40">
                    <option value="">{t("vadmin.sessions.selectPlaceholder")}</option>
                    {milestoneTasks.map((task)=>(
                      <option key={task.id} value={task.id}>{task.title}</option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-xl border border-[var(--border-primary)] bg-primary px-4 py-3">
                <input type="checkbox" checked={!!sForm.venture_facing} onChange={(event)=>setSForm((previous)=>({...previous,venture_facing:event.target.checked}))} className="mt-0.5" />
                <span>
                  <span className="block text-[9px] font-black text-slate-500 uppercase tracking-widest">{t("vadmin.sessions.ventureFacing")}</span>
                  <span className="block text-[9px] text-slate-500 mt-0.5">{t("vadmin.sessions.ventureFacingHint")}</span>
                </span>
              </label>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowCreateModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">{t("vadmin.sessions.cancel")}</button>
              <button onClick={createNewSession} disabled={saving}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Calendar className="w-4 h-4"/>} {t("vadmin.sessions.schedule")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Session Detail ── */}
      {showDetail && selectedSession && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={()=>setShowDetail(false)} />
          <div className="relative w-full max-w-lg bg-[var(--bg-tertiary)] border-l border-[var(--border-primary)] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-[var(--text-primary)]">{selectedSession.title}</h2>
                <button onClick={()=>setShowDetail(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500"/></button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.sessions.date")}</p><p className="font-bold mt-0.5">{new Date(selectedSession.start_time).toLocaleString()}</p></div>
                <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.sessions.duration")}</p><p className="font-bold mt-0.5">{Math.round((new Date(selectedSession.end_time)-new Date(selectedSession.start_time))/60000)} {t("vadmin.sessions.minutesShort")}</p></div>
                {selectedSession.coach_name && <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.sessions.coach")}</p><p className="font-bold mt-0.5">{selectedSession.coach_name}</p></div>}
                {selectedSession.session_type && <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">{t("vadmin.sessions.type")}</p><p className="font-bold mt-0.5 capitalize">{selectedSession.session_type}</p></div>}
              </div>
              {selectedSession.meeting_link && (
                <a href={selectedSession.meeting_link} target="_blank" className="flex items-center gap-2 px-4 py-2.5 bg-brand-orange/10 text-[var(--brand-orange)] rounded-xl text-[9px] font-black uppercase tracking-wider hover:brightness-110 w-fit" rel="noreferrer">
                  <Video className="w-3.5 h-3.5" /> {t("vadmin.sessions.joinMeeting")}
                </a>
              )}
              {selectedSession.agenda && <div><p className="text-[9px] font-black text-slate-500 uppercase mb-1">{t("vadmin.sessions.agenda")}</p><p className="text-xs text-[var(--text-secondary)]">{selectedSession.agenda}</p></div>}

              {/* Notes */}
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 flex items-center gap-1.5"><BookOpen className="w-3 h-3"/> {t("vadmin.sessions.notesCount", { count: selectedSession.notes?.length||0 })}</p>
                {(selectedSession.notes||[]).length===0 && <p className="text-sm text-[var(--text-secondary)]">{t("vadmin.sessions.noNotesYet")}</p>}
                {(selectedSession.notes||[]).map((note)=>(
                  <div key={note.id} className="p-3 bg-primary rounded-xl mb-2 border border-[var(--border-primary)]">
                    <p className="text-[10px] text-[var(--text-secondary)]">{note.content}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">{note.author_name} · {new Date(note.created_at).toLocaleString()}</p>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input value={noteText} onChange={(event)=>setNoteText(event.target.value)} placeholder={t("vadmin.sessions.addNotePlaceholder")} className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none" />
                  <button onClick={addNote} disabled={!noteText.trim()} className="px-3 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase disabled:opacity-30">{t("vadmin.sessions.add")}</button>
                </div>
              </div>

              {/* Action Items */}
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 flex items-center gap-1.5"><Target className="w-3 h-3"/> {t("vadmin.sessions.actionItemsCount", { count: selectedSession.action_items?.length||0 })}</p>
                {(selectedSession.action_items||[]).length===0 && <p className="text-sm text-[var(--text-secondary)]">{t("vadmin.sessions.noActionItems")}</p>}
                {(selectedSession.action_items||[]).map((actionItem)=>(
                  <div key={actionItem.id} className="flex items-center gap-2 p-2 bg-primary rounded-lg mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${actionItem.status==="completed"?"bg-emerald-500":"bg-amber-500"}`} />
                    <span className="text-[10px] font-bold text-[var(--text-primary)] flex-1">{actionItem.title}</span>
                    {actionItem.owner_name && <span className="text-[10px] text-[var(--text-secondary)]">{actionItem.owner_name}</span>}
                    {actionItem.due_date && <span className="text-[10px] text-[var(--text-secondary)]">{new Date(actionItem.due_date).toLocaleDateString()}</span>}
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input value={aiTitle} onChange={(event)=>setAiTitle(event.target.value)} placeholder={t("vadmin.sessions.newActionItemPlaceholder")} className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none" />
                  <button onClick={addActionItem} disabled={!aiTitle.trim()} className="px-3 py-2 bg-amber-500/10 text-amber-400 rounded-lg text-[8px] font-black uppercase disabled:opacity-30"><Plus className="w-3 h-3"/></button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-[var(--border-primary)]">
                {selectedSession.status==="scheduled" && (
                  <button onClick={()=>cancelSession(selectedSession.id)} className="flex-1 py-2.5 rounded-xl border border-rose-500/30 text-rose-400 text-[8px] font-black uppercase tracking-wider hover:bg-rose-500/10">{t("vadmin.sessions.cancelSession")}</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
