"use client";

import React, { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, X, Plus, Trash2, Mail,
  BookOpen, Star,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];

const pickVenture = (payload) => (payload?.success ? payload.venture || null : null);
const pickCoaches = (payload) => (payload?.success ? payload.coaches || [] : []);

export default function VentureCoachesPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("assigned");

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [assignType, setAssignType] = useState("coach");
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [saving, setSaving] = useState(false);

  // Create coach form
  const [cForm, setCForm] = useState({ full_name: "", email: "", coach_type: "coach", phone: "", organization: "", biography: "" });

  // The venture, the coaches attached to it and the coach directory, through the
  // shared hook: it owns the cache, the cache-first paint and the discarding of a
  // stale answer, so the page keeps no copy of its own and reads during render.
  const { data: venture, loading: ventureLoading } = useApi(
    id ? `/api/ventures/${id}` : null,
    { defaultValue: null, transform: pickVenture, deps: [id] },
  );
  const {
    data: assignments,
    loading: assignmentsLoading,
    refresh: refreshAssignments,
  } = useApi(id ? `/api/ventures/${id}/coaches` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickCoaches,
    deps: [id],
  });
  const {
    data: coaches,
    loading: coachesLoading,
    refresh: refreshCoaches,
  } = useApi(id ? `/api/ventures/${id}/coaches?type=coach` : null, {
    defaultValue: EMPTY_LIST,
    transform: pickCoaches,
    deps: [id],
  });

  const loading = ventureLoading || assignmentsLoading || coachesLoading;

  const notify = (message, type = "success") => {
    setToast({ msg: message, type }); setTimeout(() => setToast(null), 4000);
  };

  const handleAssign = async () => {
    if (!selectedCoachId) { notify(t("vadmin.coaches.selectCoach"), "error"); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/ventures/${id}/coaches`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: assignType === "advisor" ? "assign_advisor" : "assign_coach", coach_id: selectedCoachId, is_primary: true }),
      });
      const payload = await response.json();
      if (payload.success) { notify(t(assignType === "advisor" ? "vadmin.coaches.advisorAssigned" : "vadmin.coaches.coachAssigned")); setShowAssignModal(false); setSelectedCoachId(""); refreshAssignments(); }
      else notify(t((payload.error || t("vadmin.coaches.failed")) || "") || (payload.error || t("vadmin.coaches.failed")), "error");
    } catch { notify(t("vadmin.coaches.networkError"), "error"); }
    setSaving(false);
  };

  const handleRemove = async (assignmentId) => {
    try {
      await fetch(`/api/ventures/${id}/coaches`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove_assignment", assignment_id: assignmentId }),
      });
      notify(t("vadmin.coaches.assignmentRemoved"));
      refreshAssignments();
    } catch { notify(t("vadmin.coaches.failedToRemove"), "error"); }
  };

  const handleCreateCoach = async () => {
    if (!cForm.full_name.trim() || !cForm.email.trim()) { notify(t("vadmin.coaches.nameEmailRequired"), "error"); return; }
    setSaving(true);
    try {
      const response = await fetch(`/api/ventures/${id}/coaches`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cForm),
      });
      const payload = await response.json();
      if (payload.success) { notify(t("vadmin.coaches.coachCreated")); setShowCreateModal(false); setCForm({ full_name: "", email: "", coach_type: "coach", phone: "", organization: "", biography: "" }); refreshAssignments();
      refreshCoaches(); }
      else notify(t((payload.error || t("vadmin.coaches.failed")) || "") || (payload.error || t("vadmin.coaches.failed")), "error");
    } catch { notify(t("vadmin.coaches.networkError"), "error"); }
    setSaving(false);
  };

  if (loading) return (
    <>
      <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>
    </>
  );

  const coachesList = assignments.filter((assignment) => assignment.coach_type === "coach");
  const advisorsList = assignments.filter((assignment) => assignment.coach_type === "advisor");

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
              className="flex items-center gap-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.coaches.backToDashboard")}
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-[var(--brand-orange)]" /> {t("vadmin.coaches.title")}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{venture?.company_name||""}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowCreateModal(true)} className="px-3 py-2 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-wider hover:bg-tertiary transition-all flex items-center gap-1.5">
              <Plus className="w-3 h-3" /> {t("vadmin.coaches.newCoach")}
            </button>
            <button onClick={()=>{setAssignType("coach"); setShowAssignModal(true);}} className="px-3 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
              <Plus className="w-3 h-3" /> {t("vadmin.coaches.assignCoach")}
            </button>
            <button onClick={()=>{setAssignType("advisor"); setShowAssignModal(true);}} className="px-3 py-2 bg-purple-500/10 text-purple-400 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
              <Plus className="w-3 h-3" /> {t("vadmin.coaches.assignAdvisor")}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 border-b border-[var(--border-primary)] pb-2">
          {[
            { id: "assigned", label: t("vadmin.coaches.tabAssigned", { count: assignments.length }) },
            { id: "coaches", label: t("vadmin.coaches.tabCoaches", { count: coachesList.length }) },
            { id: "advisors", label: t("vadmin.coaches.tabAdvisors", { count: advisorsList.length }) },
          ].map((tab) => (
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)}
              className={`text-[10px] font-bold uppercase tracking-wider pb-2 border-b-2 transition-all ${
                activeTab===tab.id ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)]"
              }`}>{tab.label}</button>
          ))}
        </div>

        {/* Assigned Tab */}
        {activeTab === "assigned" && (
          <div className="space-y-4">
            {assignments.length === 0 ? (
              <div className="text-center py-16"><BookOpen className="w-12 h-12 text-[var(--text-secondary)] mx-auto mb-3" /><p className="text-sm text-[var(--text-secondary)]">{t("vadmin.coaches.noCoachesAssignedYet")}</p></div>
            ) : (
              assignments.map((assignment) => (
                <div key={assignment.id} className="p-5 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-black shrink-0 ${
                        assignment.coach_type==="advisor" ? "bg-purple-500/20 text-purple-400" : "bg-brand-orange/10 text-[var(--brand-orange)]"
                      }`}>
                        {assignment.full_name?.charAt(0)||"?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-[var(--text-primary)]">{assignment.full_name}</p>
                          <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${assignment.coach_type==="advisor"?"bg-purple-500/10 text-purple-400":"bg-brand-orange/10 text-[var(--brand-orange)]"}`}>
                            {assignment.coach_type}
                          </span>
                          {assignment.is_primary ? <Star className="w-3.5 h-3.5 text-amber-400" /> : null}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--text-secondary)] flex-wrap">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3"/>{assignment.email}</span>
                          {assignment.organization && <span>{assignment.organization}</span>}
                          {assignment.years_experience && <span>{assignment.years_experience}{t("vadmin.coaches.yearsExperience")}</span>}
                          {assignment.availability && <span className={`text-[10px] font-bold uppercase ${assignment.availability==="available"?"text-emerald-400":assignment.availability==="busy"?"text-amber-400":"text-slate-500"}`}>{assignment.availability}</span>}
                        </div>
                        {(assignment.areas_of_expertise||[]).length>0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {assignment.areas_of_expertise.map((expertise, index)=>(
                              <span key={index} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400">{expertise}</span>
                            ))}
                          </div>
                        )}
                        {assignment.biography && <p className="text-sm text-[var(--text-secondary)] mt-2">{assignment.biography}</p>}
                      </div>
                    </div>
                    <button onClick={()=>handleRemove(assignment.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Coaches Tab */}
        {activeTab === "coaches" && (
          <div className="space-y-2">
            {coachesList.length===0 ? <p className="text-sm text-[var(--text-secondary)] text-center py-8">{t("vadmin.coaches.noCoachesAssigned")}</p> : (
              coachesList.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-orange/10 flex items-center justify-center text-sm font-black text-[var(--brand-orange)]">{assignment.full_name?.charAt(0)}</div>
                    <div><p className="text-xs font-bold text-[var(--text-primary)]">{assignment.full_name}</p><p className="text-[10px] text-[var(--text-secondary)]">{assignment.email}</p></div>
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)] capitalize">{assignment.availability||"available"}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Advisors Tab */}
        {activeTab === "advisors" && (
          <div className="space-y-2">
            {advisorsList.length===0 ? <p className="text-sm text-[var(--text-secondary)] text-center py-8">{t("vadmin.coaches.noAdvisorsAssigned")}</p> : (
              advisorsList.map((assignment) => (
                <div key={assignment.id} className="flex items-center justify-between p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-sm font-black text-purple-400">{assignment.full_name?.charAt(0)}</div>
                    <div><p className="text-xs font-bold text-[var(--text-primary)]">{assignment.full_name}</p><p className="text-[10px] text-[var(--text-secondary)]">{assignment.email}</p></div>
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)]">{assignment.organization||""}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Assign Modal ── */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">{t(assignType === "advisor" ? "vadmin.coaches.assignAdvisor" : "vadmin.coaches.assignCoach")}</h2>
              <button onClick={()=>setShowAssignModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500"/></button>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">{t(assignType === "advisor" ? "vadmin.coaches.selectAdvisorLabel" : "vadmin.coaches.selectCoachLabel")}</label>
              <select value={selectedCoachId} onChange={(event)=>setSelectedCoachId(event.target.value)}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                <option value="">{t("vadmin.coaches.choose")}</option>
                {(coaches||[]).filter((coach)=>coach.coach_type===assignType||!assignType).map((coach)=>(
                  <option key={coach.id} value={coach.id}>{coach.full_name} ({coach.email})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowAssignModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary">{t("vadmin.coaches.cancel")}</button>
              <button onClick={handleAssign} disabled={saving}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : null} {t("vadmin.coaches.assign")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Coach Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">{t("vadmin.coaches.newCoach")}</h2>
              <button onClick={()=>setShowCreateModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500"/></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">{t("vadmin.coaches.name")}</label>
                  <input value={cForm.full_name} onChange={(event)=>setCForm((previous)=>({...previous,full_name:event.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">{t("vadmin.coaches.email")}</label>
                  <input type="email" value={cForm.email} onChange={(event)=>setCForm((previous)=>({...previous,email:event.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">{t("vadmin.coaches.type")}</label>
                  <select value={cForm.coach_type} onChange={(event)=>setCForm((previous)=>({...previous,coach_type:event.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="coach">{t("vadmin.coaches.coach")}</option><option value="advisor">{t("vadmin.coaches.advisor")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">{t("vadmin.coaches.organization")}</label>
                  <input value={cForm.organization} onChange={(event)=>setCForm((previous)=>({...previous,organization:event.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1.5 block">{t("vadmin.coaches.biography")}</label>
                <textarea value={cForm.biography} onChange={(event)=>setCForm((previous)=>({...previous,biography:event.target.value}))} rows={2} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowCreateModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest hover:bg-tertiary">{t("vadmin.coaches.cancel")}</button>
              <button onClick={handleCreateCoach} disabled={saving}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>} {t("vadmin.coaches.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
