"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, X, Plus, Calendar, Clock, User,
  Video, MapPin, BookOpen, MessageCircle, Target, Trash2, Edit3,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

const SESSION_TYPE_CFG = {
  coaching: { label: "vadmin.sessions.coaching", color: "bg-blue-500/10 text-blue-400" },
  mentoring: { label: "vadmin.sessions.mentoring", color: "bg-purple-500/10 text-purple-400" },
  advisory: { label: "vadmin.sessions.advisory", color: "bg-emerald-500/10 text-emerald-400" },
  office_hours: { label: "vadmin.sessions.officeHours", color: "bg-amber-500/10 text-amber-400" },
  review_meeting: { label: "vadmin.sessions.review", color: "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" },
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
  const [venture, setVenture] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("upcoming");

  // Form
  const [sForm, setSForm] = useState({ title: "", session_type: "coaching", coach_id: "", start_time: "", end_time: "", meeting_link: "", description: "" });

  // Notes
  const [noteText, setNoteText] = useState("");

  // Action items
  const [aiTitle, setAiTitle] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const notify = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 4000); };

  const fetchAll = async (bypassCache = false) => {
    const urls = [`/api/ventures/${id}`, `/api/ventures/${id}/sessions`, `/api/ventures/${id}/coaches`];
    const apply = (v, s, c) => {
      if (v.success) setVenture(v.venture);
      if (s.success) setSessions(s.sessions || []);
      if (c.success) setCoaches(c.coaches || []);
    };
    setLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from
      // fresh snapshots; mutation flows pass bypassCache=true so the data
      // always reflects the last action.
      if (!bypassCache) {
        const cached = urls.map((u) => cacheGet(u));
        if (cached.every((c) => c !== null && c.success)) {
          apply(cached[0], cached[1], cached[2]);
          setLoading(false);
        }
      }
      const [vRes, sRes, cRes] = await Promise.all(urls.map((u) => fetch(u)));
      const v = await vRes.json(); const s = await sRes.json(); const c = await cRes.json();
      if (v.success) cacheSet(urls[0], v);
      if (s.success) cacheSet(urls[1], s);
      if (c.success) cacheSet(urls[2], c);
      apply(v, s, c);
    } catch {} finally { setLoading(false); }
  };

  const loadSessionDetail = async (sessionId) => {
    try {
      const res = await fetch(`/api/ventures/${id}/sessions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_session", session_id: sessionId }),
      });
      const d = await res.json();
      if (d.success) { setSelectedSession(d.session); setShowDetail(true); }
    } catch {}
  };

  const createNewSession = async () => {
    if (!sForm.title.trim() || !sForm.start_time || !sForm.end_time) { notify(t("vadmin.sessions.titleStartEndRequired"), "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${id}/sessions`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_session", ...sForm, coach_id: sForm.coach_id ? parseInt(sForm.coach_id) : null }),
      });
      const d = await res.json();
      if (d.success) { notify(t("vadmin.sessions.sessionCreated")); setShowCreateModal(false); setSForm({ title: "", session_type: "coaching", coach_id: "", start_time: "", end_time: "", meeting_link: "", description: "" }); fetchAll(true); }
      else notify(t((d.error || t("vadmin.sessions.failed")) || "") || (d.error || t("vadmin.sessions.failed")), "error");
    } catch { notify(t("vadmin.sessions.networkError"), "error"); }
    setSaving(false);
  };

  const cancelSession = async (sessionId) => {
    await fetch(`/api/ventures/${id}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel_session", session_id: sessionId }) });
    notify(t("vadmin.sessions.sessionCancelled"));
    setShowDetail(false);
    fetchAll(true);
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

  const upcoming = sessions.filter((s) => ["scheduled", "confirmed"].includes(s.status));
  const past = sessions.filter((s) => ["completed", "cancelled", "no_show", "rescheduled"].includes(s.status));

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
            <button onClick={()=>router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.sessions.backToDashboard")}
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <Calendar className="w-6 h-6 text-[var(--brand-orange)]" /> {t("vadmin.sessions.mentoringSessions")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name||""} · {t("vadmin.sessions.upcomingCount", { count: upcoming.length })}</p>
          </div>
          <button onClick={()=>setShowCreateModal(true)} className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> {t("vadmin.sessions.scheduleSession")}
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-4 border-b border-[var(--border-primary)] pb-2">
          {["upcoming", "past", "all"].map((f) => (
            <button key={f} onClick={()=>setFilter(f)}
              className={`text-[9px] font-black uppercase tracking-wider pb-2 border-b-2 transition-all ${filter===f?"border-[var(--brand-orange)] text-[var(--brand-orange)]":"border-transparent text-slate-500"}`}>
              {f==="upcoming"?t("vadmin.sessions.tabUpcoming",{count:upcoming.length}):f==="past"?t("vadmin.sessions.tabPast",{count:past.length}):t("vadmin.sessions.tabAll")}
            </button>
          ))}
        </div>

        {/* Sessions List */}
        {(filter==="upcoming"?upcoming:filter==="past"?past:sessions).length===0 ? (
          <div className="text-center py-16"><Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">{t("vadmin.sessions.noSessionsFound")}</p></div>
        ) : (
          <div className="space-y-3">
            {(filter==="upcoming"?upcoming:filter==="past"?past:sessions).map((s) => {
              const tc = SESSION_TYPE_CFG[s.session_type] || SESSION_TYPE_CFG.coaching;
              const sc = STATUS_CFG[s.status] || STATUS_CFG.scheduled;
              return (
                <div key={s.id} onClick={()=>loadSessionDetail(s.id)}
                  className="p-5 rounded-2xl bg-tertiary border border-[var(--border-primary)] cursor-pointer hover:border-[var(--brand-orange)]/30 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${tc.color}`}>
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-[var(--text-primary)]">{s.title}</p>
                          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${tc.color}`}>{t(tc.label)}</span>
                          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${sc.color}`}>{t(sc.label)}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3"/>{new Date(s.start_time).toLocaleString()}</span>
                          {s.coach_name && <span className="flex items-center gap-1"><User className="w-3 h-3"/>{s.coach_name}</span>}
                          {s.meeting_link && <span className="flex items-center gap-1"><Video className="w-3 h-3"/>{t("vadmin.sessions.online")}</span>}
                          {s.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3"/>{s.location}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {s.status==="scheduled" && (
                        <button onClick={(e)=>{e.stopPropagation(); cancelSession(s.id);}} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg"><X className="w-4 h-4"/></button>
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
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.sessions.scheduleSession")}</h2>
              <button onClick={()=>setShowCreateModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500"/></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.titleRequired")}</label>
                <input value={sForm.title} onChange={(e)=>setSForm((p)=>({...p,title:e.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.type")}</label>
                  <select value={sForm.session_type} onChange={(e)=>setSForm((p)=>({...p,session_type:e.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="coaching">{t("vadmin.sessions.coaching")}</option><option value="mentoring">{t("vadmin.sessions.mentoring")}</option><option value="advisory">{t("vadmin.sessions.advisory")}</option>
                    <option value="office_hours">{t("vadmin.sessions.officeHours")}</option><option value="review_meeting">{t("vadmin.sessions.reviewMeeting")}</option><option value="pitch_review">{t("vadmin.sessions.pitchReview")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.coach")}</label>
                  <select value={sForm.coach_id} onChange={(e)=>setSForm((p)=>({...p,coach_id:e.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="">{t("vadmin.sessions.selectPlaceholder")}</option>
                    {(coaches||[]).filter((c)=>c.coach_type==="coach").map((c)=>(
                      <option key={c.id} value={c.id}>{c.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.startRequired")}</label>
                  <input type="datetime-local" value={sForm.start_time} onChange={(e)=>setSForm((p)=>({...p,start_time:e.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.endRequired")}</label>
                  <input type="datetime-local" value={sForm.end_time} onChange={(e)=>setSForm((p)=>({...p,end_time:e.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.meetingLink")}</label>
                <input value={sForm.meeting_link} onChange={(e)=>setSForm((p)=>({...p,meeting_link:e.target.value}))} placeholder="https://meet.google.com/..." className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.sessions.description")}</label>
                <textarea value={sForm.description} onChange={(e)=>setSForm((p)=>({...p,description:e.target.value}))} rows={2} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none resize-none" />
              </div>
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
                <a href={selectedSession.meeting_link} target="_blank" className="flex items-center gap-2 px-4 py-2.5 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] rounded-xl text-[9px] font-black uppercase tracking-wider hover:brightness-110 w-fit">
                  <Video className="w-3.5 h-3.5" /> {t("vadmin.sessions.joinMeeting")}
                </a>
              )}
              {selectedSession.agenda && <div><p className="text-[9px] font-black text-slate-500 uppercase mb-1">{t("vadmin.sessions.agenda")}</p><p className="text-xs text-[var(--text-secondary)]">{selectedSession.agenda}</p></div>}

              {/* Notes */}
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 flex items-center gap-1.5"><BookOpen className="w-3 h-3"/> {t("vadmin.sessions.notesCount", { count: selectedSession.notes?.length||0 })}</p>
                {(selectedSession.notes||[]).length===0 && <p className="text-sm text-[var(--text-secondary)]">{t("vadmin.sessions.noNotesYet")}</p>}
                {(selectedSession.notes||[]).map((n)=>(
                  <div key={n.id} className="p-3 bg-primary rounded-xl mb-2 border border-[var(--border-primary)]">
                    <p className="text-[10px] text-[var(--text-secondary)]">{n.content}</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-1">{n.author_name} · {new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input value={noteText} onChange={(e)=>setNoteText(e.target.value)} placeholder={t("vadmin.sessions.addNotePlaceholder")} className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none" />
                  <button onClick={addNote} disabled={!noteText.trim()} className="px-3 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase disabled:opacity-30">{t("vadmin.sessions.add")}</button>
                </div>
              </div>

              {/* Action Items */}
              <div>
                <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-2 flex items-center gap-1.5"><Target className="w-3 h-3"/> {t("vadmin.sessions.actionItemsCount", { count: selectedSession.action_items?.length||0 })}</p>
                {(selectedSession.action_items||[]).length===0 && <p className="text-sm text-[var(--text-secondary)]">{t("vadmin.sessions.noActionItems")}</p>}
                {(selectedSession.action_items||[]).map((a)=>(
                  <div key={a.id} className="flex items-center gap-2 p-2 bg-primary rounded-lg mb-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${a.status==="completed"?"bg-emerald-500":"bg-amber-500"}`} />
                    <span className="text-[10px] font-bold text-[var(--text-primary)] flex-1">{a.title}</span>
                    {a.owner_name && <span className="text-[10px] text-[var(--text-secondary)]">{a.owner_name}</span>}
                    {a.due_date && <span className="text-[10px] text-[var(--text-secondary)]">{new Date(a.due_date).toLocaleDateString()}</span>}
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input value={aiTitle} onChange={(e)=>setAiTitle(e.target.value)} placeholder={t("vadmin.sessions.newActionItemPlaceholder")} className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none" />
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
