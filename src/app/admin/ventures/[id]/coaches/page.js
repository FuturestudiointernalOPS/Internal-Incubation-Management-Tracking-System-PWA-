"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, AlertTriangle, X, Plus, Trash2, User, Mail, Phone,
  Globe, Linkedin, BookOpen, Clock, Star, Calendar,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useI18n } from "@/lib/i18n";

export default function VentureCoachesPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const [venture, setVenture] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => { fetchAll(); }, []);

  const notify = (msg, type = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 4000);
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [vRes, aRes, cRes] = await Promise.all([
        fetch(`/api/ventures/${id}`),
        fetch(`/api/ventures/${id}/coaches`),
        fetch(`/api/ventures/${id}/coaches?type=coach`),
      ]);
      const v = await vRes.json(); const a = await aRes.json(); const c = await cRes.json();
      if (v.success) setVenture(v.venture);
      if (a.success) setAssignments(a.coaches || []);
      if (c.success) setCoaches(c.coaches || []);
    } catch {} finally { setLoading(false); }
  };

  // Re-fetch assignments using the assignments endpoint from lib
  const fetchAssignments = async () => {
    try {
      const res = await fetch(`/api/ventures/${id}/coaches`);
      const d = await res.json();
      if (d.success) setAssignments(d.coaches || []);
    } catch {}
  };

  const handleAssign = async () => {
    if (!selectedCoachId) { notify(t("vadmin.coaches.selectCoach"), "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${id}/coaches`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: assignType === "advisor" ? "assign_advisor" : "assign_coach", coach_id: selectedCoachId, is_primary: true }),
      });
      const d = await res.json();
      if (d.success) { notify(t(assignType === "advisor" ? "vadmin.coaches.advisorAssigned" : "vadmin.coaches.coachAssigned")); setShowAssignModal(false); setSelectedCoachId(""); fetchAssignments(); }
      else notify(d.error || t("vadmin.coaches.failed"), "error");
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
      fetchAssignments();
    } catch { notify(t("vadmin.coaches.failedToRemove"), "error"); }
  };

  const handleCreateCoach = async () => {
    if (!cForm.full_name.trim() || !cForm.email.trim()) { notify(t("vadmin.coaches.nameEmailRequired"), "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${id}/coaches`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cForm),
      });
      const d = await res.json();
      if (d.success) { notify(t("vadmin.coaches.coachCreated")); setShowCreateModal(false); setCForm({ full_name: "", email: "", coach_type: "coach", phone: "", organization: "", biography: "" }); fetchAll(); }
      else notify(d.error || t("vadmin.coaches.failed"), "error");
    } catch { notify(t("vadmin.coaches.networkError"), "error"); }
    setSaving(false);
  };

  if (loading) return (
    <DashboardLayout role="super_admin">
      <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>
    </DashboardLayout>
  );

  const coachesList = assignments.filter((a) => a.coach_type === "coach");
  const advisorsList = assignments.filter((a) => a.coach_type === "advisor");

  return (
    <DashboardLayout role="super_admin">
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
              <ArrowLeft className="w-3 h-3" /> {t("vadmin.coaches.backToDashboard")}
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-[var(--brand-orange)]" /> {t("vadmin.coaches.title")}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name||""}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={()=>setShowCreateModal(true)} className="px-3 py-2 rounded-xl border border-[var(--border-primary)] text-[8px] font-black uppercase tracking-wider hover:bg-tertiary transition-all flex items-center gap-1.5">
              <Plus className="w-3 h-3" /> {t("vadmin.coaches.newCoach")}
            </button>
            <button onClick={()=>{setAssignType("coach"); setShowAssignModal(true);}} className="px-3 py-2 bg-[var(--brand-orange)] text-black rounded-xl text-[8px] font-black uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
              <Plus className="w-3 h-3" /> {t("vadmin.coaches.assignCoach")}
            </button>
            <button onClick={()=>{setAssignType("advisor"); setShowAssignModal(true);}} className="px-3 py-2 bg-purple-500/10 text-purple-400 rounded-xl text-[8px] font-black uppercase tracking-wider hover:brightness-110 transition-all flex items-center gap-1.5">
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
              className={`text-[9px] font-black uppercase tracking-wider pb-2 border-b-2 transition-all ${
                activeTab===tab.id ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-slate-500"
              }`}>{tab.label}</button>
          ))}
        </div>

        {/* Assigned Tab */}
        {activeTab === "assigned" && (
          <div className="space-y-4">
            {assignments.length === 0 ? (
              <div className="text-center py-16"><BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">{t("vadmin.coaches.noCoachesAssignedYet")}</p></div>
            ) : (
              assignments.map((a) => (
                <div key={a.id} className="p-5 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-black shrink-0 ${
                        a.coach_type==="advisor" ? "bg-purple-500/20 text-purple-400" : "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                      }`}>
                        {a.full_name?.charAt(0)||"?"}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-[var(--text-primary)]">{a.full_name}</p>
                          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${a.coach_type==="advisor"?"bg-purple-500/10 text-purple-400":"bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"}`}>
                            {a.coach_type}
                          </span>
                          {a.is_primary ? <Star className="w-3.5 h-3.5 text-amber-400" /> : null}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3"/>{a.email}</span>
                          {a.organization && <span>{a.organization}</span>}
                          {a.years_experience && <span>{a.years_experience}{t("vadmin.coaches.yearsExperience")}</span>}
                          {a.availability && <span className={`text-[7px] font-bold uppercase ${a.availability==="available"?"text-emerald-400":a.availability==="busy"?"text-amber-400":"text-slate-500"}`}>{a.availability}</span>}
                        </div>
                        {(a.areas_of_expertise||[]).length>0 && (
                          <div className="flex gap-1 mt-2 flex-wrap">
                            {a.areas_of_expertise.map((e,i)=>(
                              <span key={i} className="text-[7px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400">{e}</span>
                            ))}
                          </div>
                        )}
                        {a.biography && <p className="text-[9px] text-slate-600 mt-2">{a.biography}</p>}
                      </div>
                    </div>
                    <button onClick={()=>handleRemove(a.id)} className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all shrink-0"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Coaches Tab */}
        {activeTab === "coaches" && (
          <div className="space-y-2">
            {coachesList.length===0 ? <p className="text-sm text-slate-500 text-center py-8">{t("vadmin.coaches.noCoachesAssigned")}</p> : (
              coachesList.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--brand-orange)]/10 flex items-center justify-center text-sm font-black text-[var(--brand-orange)]">{a.full_name?.charAt(0)}</div>
                    <div><p className="text-xs font-bold text-[var(--text-primary)]">{a.full_name}</p><p className="text-[8px] text-slate-500">{a.email}</p></div>
                  </div>
                  <span className="text-[8px] text-slate-500 capitalize">{a.availability||"available"}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Advisors Tab */}
        {activeTab === "advisors" && (
          <div className="space-y-2">
            {advisorsList.length===0 ? <p className="text-sm text-slate-500 text-center py-8">{t("vadmin.coaches.noAdvisorsAssigned")}</p> : (
              advisorsList.map((a) => (
                <div key={a.id} className="flex items-center justify-between p-4 rounded-xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-sm font-black text-purple-400">{a.full_name?.charAt(0)}</div>
                    <div><p className="text-xs font-bold text-[var(--text-primary)]">{a.full_name}</p><p className="text-[8px] text-slate-500">{a.email}</p></div>
                  </div>
                  <span className="text-[8px] text-slate-500">{a.organization||""}</span>
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
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t(assignType === "advisor" ? "vadmin.coaches.selectAdvisorLabel" : "vadmin.coaches.selectCoachLabel")}</label>
              <select value={selectedCoachId} onChange={(e)=>setSelectedCoachId(e.target.value)}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                <option value="">{t("vadmin.coaches.choose")}</option>
                {(coaches||[]).filter((c)=>c.coach_type===assignType||!assignType).map((c)=>(
                  <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowAssignModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">{t("vadmin.coaches.cancel")}</button>
              <button onClick={handleAssign} disabled={saving}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
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
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.coaches.name")}</label>
                  <input value={cForm.full_name} onChange={(e)=>setCForm((p)=>({...p,full_name:e.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.coaches.email")}</label>
                  <input type="email" value={cForm.email} onChange={(e)=>setCForm((p)=>({...p,email:e.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.coaches.type")}</label>
                  <select value={cForm.coach_type} onChange={(e)=>setCForm((p)=>({...p,coach_type:e.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="coach">{t("vadmin.coaches.coach")}</option><option value="advisor">{t("vadmin.coaches.advisor")}</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.coaches.organization")}</label>
                  <input value={cForm.organization} onChange={(e)=>setCForm((p)=>({...p,organization:e.target.value}))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">{t("vadmin.coaches.biography")}</label>
                <textarea value={cForm.biography} onChange={(e)=>setCForm((p)=>({...p,biography:e.target.value}))} rows={2} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowCreateModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">{t("vadmin.coaches.cancel")}</button>
              <button onClick={handleCreateCoach} disabled={saving}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin"/> : <Plus className="w-4 h-4"/>} {t("vadmin.coaches.create")}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
