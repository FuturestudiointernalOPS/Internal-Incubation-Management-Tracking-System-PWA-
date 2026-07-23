"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Plus, Loader2, CheckCircle2, AlertCircle, AlertTriangle, X, Trash2, Edit3,
  Flag, Calendar, Clock, User, Paperclip, Send, ChevronDown, ChevronRight, FileText,
  BookOpen, BarChart3, Layers,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

const STATUS_CFG = {
  not_started: { label: "Not Started", color: "text-slate-400 bg-slate-500/10" },
  in_progress: { label: "In Progress", color: "text-blue-400 bg-blue-500/10" },
  completed: { label: "Completed", color: "text-emerald-400 bg-emerald-500/10" },
  delayed: { label: "Delayed", color: "text-rose-400 bg-rose-500/10" },
  cancelled: { label: "Cancelled", color: "text-slate-500 bg-slate-500/5" },
};

const DEL_STATUS_CFG = {
  pending: { label: "Pending", color: "text-slate-400 bg-slate-500/10" },
  in_progress: { label: "In Progress", color: "text-blue-400 bg-blue-500/10" },
  submitted: { label: "Submitted", color: "text-amber-400 bg-amber-500/10" },
  approved: { label: "Approved", color: "text-emerald-400 bg-emerald-500/10" },
  rejected: { label: "Rejected", color: "text-rose-400 bg-rose-500/10" },
  completed: { label: "Completed", color: "text-emerald-400 bg-emerald-500/10" },
};

export default function VentureMilestonesPage() {
  const { id } = useParams();
  const router = useRouter();
  const [venture, setVenture] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Modals
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showDelModal, setShowDelModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [deliverables, setDeliverables] = useState({});
  const [expandedMilestones, setExpandedMilestones] = useState({});

  // Forms
  const [mForm, setMForm] = useState({ title: "", description: "", priority: "medium", due_date: "" });
  const [dForm, setDForm] = useState({ title: "", description: "", deliverable_type: "document", due_date: "", assigned_cid: "" });
  const [reviewForm, setReviewForm] = useState({ decision: "approved", comments: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const notify = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vRes, mRes] = await Promise.all([
        fetch(`/api/ventures/${id}`),
        fetch(`/api/ventures/${id}/milestones`),
      ]);
      const vData = await vRes.json();
      const mData = await mRes.json();
      if (vData.success) setVenture(vData.venture);
      if (mData.success) setMilestones(mData.milestones || []);
    } catch {} finally { setLoading(false); }
  };

  const loadDeliverables = async (milestoneId) => {
    try {
      const res = await fetch(`/api/ventures/${id}/milestones?action=get_deliverables&deliverable_id=${milestoneId}`, { method: "PUT" });
      const data = await res.json();
      if (data.success) setDeliverables((p) => ({ ...p, [milestoneId]: data.deliverables || [] }));
    } catch {}
  };

  const toggleMilestone = (mid) => {
    if (!expandedMilestones[mid]) loadDeliverables(mid);
    setExpandedMilestones((p) => ({ ...p, [mid]: !p[mid] }));
  };

  const createMilestone = async () => {
    if (!mForm.title.trim()) { notify("Title required", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${id}/milestones`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mForm),
      });
      const data = await res.json();
      if (data.success) { notify("Milestone created"); setShowMilestoneModal(false); setMForm({ title: "", description: "", priority: "medium", due_date: "" }); fetchData(); }
      else notify(data.error || "Failed", "error");
    } catch { notify("Network error", "error"); }
    setSaving(false);
  };

  const updateMilestoneStatus = async (milestoneId, status) => {
    try {
      const res = await fetch(`/api/ventures/${id}/milestones?id=${milestoneId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) { notify(`Status: ${status}`); fetchData(); }
      else notify(data.error || "Failed", "error");
    } catch { notify("Network error", "error"); }
  };

  const createDeliverable = async () => {
    if (!dForm.title.trim()) { notify("Deliverable title required", "error"); return; }
    if (!selectedMilestone) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/ventures/${id}/milestones`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_deliverable", milestone_id: selectedMilestone, ...dForm }),
      });
      const data = await res.json();
      if (data.success) { notify("Deliverable created"); setShowDelModal(false); setDForm({ title: "", description: "", deliverable_type: "document", due_date: "", assigned_cid: "" }); loadDeliverables(selectedMilestone); }
      else notify(data.error || "Failed", "error");
    } catch { notify("Network error", "error"); }
    setSaving(false);
  };

  const submitDeliverable = async (delId) => {
    try {
      await fetch(`/api/ventures/${id}/milestones`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_deliverable", deliverable_id: delId, status: "submitted" }),
      });
      notify("Deliverable submitted for review");
      if (selectedMilestone) loadDeliverables(selectedMilestone);
    } catch { notify("Network error", "error"); }
  };

  const reviewDeliverable = async () => {
    if (!selectedDeliverable) return;
    setSaving(true);
    try {
      await fetch(`/api/ventures/${id}/milestones`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_deliverable", deliverable_id: selectedDeliverable.id,
          approval_status: reviewForm.decision, rejection_reason: reviewForm.decision === "rejected" ? reviewForm.comments : null,
          reviewer_cid: "sa", reviewer_name: "Admin",
        }),
      });
      notify(`Deliverable ${reviewForm.decision}`);
      setShowReviewModal(false);
      setSelectedDeliverable(null);
      setReviewForm({ decision: "approved", comments: "" });
      if (selectedMilestone) loadDeliverables(selectedMilestone);
      fetchData();
    } catch { notify("Network error", "error"); }
    setSaving(false);
  };

  if (loading) return (
    <DashboardLayout role="super_admin">
      <div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div>
    </DashboardLayout>
  );

  const completedCount = milestones.filter((m) => m.status === "completed").length;
  const totalDeliverables = Object.values(deliverables).flat().length;
  const completedDeliverables = Object.values(deliverables).flat().filter((d) => d.status === "approved" || d.status === "completed").length;

  return (
    <DashboardLayout role="super_admin">
      <div className="space-y-8 pb-20">
        {toast && (
          <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 ${toast.type === "error" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"}`}>
            {toast.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <Flag className="w-6 h-6 text-[var(--brand-orange)]" /> Milestones & Deliverables
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name || ""}</p>
          </div>
          <button onClick={() => setShowMilestoneModal(true)}
            className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Add Milestone
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Milestones</p>
            <p className="text-2xl font-black text-[var(--text-primary)]">{milestones.length}</p>
          </div>
          <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Completed</p>
            <p className="text-2xl font-black text-emerald-400">{completedCount}</p>
          </div>
          <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Deliverables</p>
            <p className="text-2xl font-black text-[var(--text-primary)]">{totalDeliverables}</p>
          </div>
          <div className="p-4 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
            <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Progress</p>
            <p className="text-2xl font-black text-[var(--brand-orange)]">{milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0}%</p>
          </div>
        </div>

        {/* Milestones List */}
        {milestones.length === 0 ? (
          <div className="text-center py-20">
            <Flag className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">No milestones yet</h3>
            <p className="text-sm text-slate-500 mb-6">Create your first milestone to track progress</p>
            <button onClick={() => setShowMilestoneModal(true)} className="btn btn-primary gap-2">
              <Plus className="w-4 h-4" /> Add Milestone
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {milestones.map((m) => {
              const sc = STATUS_CFG[m.status] || STATUS_CFG.not_started;
              const milestoneDels = deliverables[m.id] || [];
              const isExpanded = expandedMilestones[m.id];
              return (
                <div key={m.id} className="p-5 rounded-2xl bg-tertiary border border-[var(--border-primary)]">
                  <div className="flex items-start justify-between gap-4 cursor-pointer" onClick={() => toggleMilestone(m.id)}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">{m.title}</h3>
                          <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${sc.color}`}>{sc.label}</span>
                          {m.priority === "high" && <span className="text-[7px] font-black text-rose-400">High</span>}
                        </div>
                        {m.description && <p className="text-[10px] text-slate-500 mt-1">{m.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-[8px] text-slate-500">
                          {m.due_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(m.due_date).toLocaleDateString()}</span>}
                          <span><BarChart3 className="w-3 h-3 inline mr-1" />{m.completion_percentage || 0}%</span>
                          <span><FileText className="w-3 h-3 inline mr-1" />{m.deliverable_count || 0} deliverables</span>
                        </div>
                        <div className="mt-2 w-full bg-primary rounded-full h-1.5 overflow-hidden max-w-xs">
                          <div className={`h-full rounded-full ${m.completion_percentage >= 80 ? "bg-emerald-500" : m.completion_percentage >= 40 ? "bg-amber-500" : "bg-[var(--brand-orange)]"}`}
                            style={{ width: `${m.completion_percentage || 0}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <select value={m.status} onChange={(e) => updateMilestoneStatus(m.id, e.target.value)}
                        className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[8px] font-bold text-[var(--text-primary)] outline-none">
                        {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <button onClick={() => { setSelectedMilestone(m.id); setShowDelModal(true); }}
                        className="p-1.5 bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] rounded-lg hover:brightness-110">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Deliverables */}
                  {isExpanded && (
                    <div className="mt-4 pl-7 space-y-2">
                      {milestoneDels.length === 0 && <p className="text-[10px] text-slate-500 italic">No deliverables yet</p>}
                      {milestoneDels.map((d) => {
                        const dc = DEL_STATUS_CFG[d.status] || DEL_STATUS_CFG.pending;
                        return (
                          <div key={d.id} className="flex items-center justify-between p-3 bg-primary rounded-xl border border-[var(--border-primary)]">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <FileText className="w-4 h-4 text-[var(--brand-orange)] shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-[var(--text-primary)]">{d.title}</span>
                                  <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${dc.color}`}>{dc.label}</span>
                                  {d.approval_status === "approved" && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                                  {d.approval_status === "rejected" && <AlertCircle className="w-3 h-3 text-rose-400" />}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-[8px] text-slate-500">
                                  <span className="capitalize">{d.deliverable_type}</span>
                                  {d.due_date && <span>· Due {new Date(d.due_date).toLocaleDateString()}</span>}
                                  {d.assigned_cid && <span>· Assigned</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              {d.status === "in_progress" && (
                                <button onClick={() => submitDeliverable(d.id)}
                                  className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-[7px] font-black uppercase hover:brightness-110">Submit</button>
                              )}
                              {d.status === "submitted" && (
                                <button onClick={() => { setSelectedDeliverable(d); setShowReviewModal(true); }}
                                  className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[7px] font-black uppercase hover:brightness-110">Review</button>
                              )}
                              {d.rejection_reason && (
                                <span className="text-[7px] text-rose-400 italic max-w-[120px] truncate" title={d.rejection_reason}>{d.rejection_reason}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Milestone Modal ── */}
      {showMilestoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">New Milestone</h2>
              <button onClick={() => setShowMilestoneModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Title *</label>
                <input value={mForm.title} onChange={(e) => setMForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g., MVP Development Phase 1"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea value={mForm.description} onChange={(e) => setMForm((p) => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Priority</label>
                  <select value={mForm.priority} onChange={(e) => setMForm((p) => ({ ...p, priority: e.target.value }))}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Due Date</label>
                  <input type="date" value={mForm.due_date} onChange={(e) => setMForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowMilestoneModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">Cancel</button>
              <button onClick={createMilestone} disabled={saving}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Deliverable Modal ── */}
      {showDelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">New Deliverable</h2>
              <button onClick={() => setShowDelModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Title *</label>
                <input value={dForm.title} onChange={(e) => setDForm((p) => ({ ...p, title: e.target.value }))} placeholder="e.g., Wireframes"
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Type</label>
                  <select value={dForm.deliverable_type} onChange={(e) => setDForm((p) => ({ ...p, deliverable_type: e.target.value }))}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    <option value="document">Document</option><option value="presentation">Presentation</option>
                    <option value="prototype">Prototype</option><option value="source_code">Source Code</option>
                    <option value="report">Report</option><option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Due Date</label>
                  <input type="date" value={dForm.due_date} onChange={(e) => setDForm((p) => ({ ...p, due_date: e.target.value }))}
                    className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Description</label>
                <textarea value={dForm.description} onChange={(e) => setDForm((p) => ({ ...p, description: e.target.value }))} rows={2}
                  className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none resize-none" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowDelModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">Cancel</button>
              <button onClick={createDeliverable} disabled={saving}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Review Modal ── */}
      {showReviewModal && selectedDeliverable && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-[var(--text-primary)]">Review Deliverable</h2>
                <p className="text-[9px] text-slate-500">{selectedDeliverable.title}</p>
              </div>
              <button onClick={() => setShowReviewModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 block">Decision</label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setReviewForm((p) => ({ ...p, decision: "approved" }))}
                  className={`p-4 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all ${reviewForm.decision === "approved" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-primary border-[var(--border-primary)] text-slate-500"}`}>
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-1" /> Approve
                </button>
                <button onClick={() => setReviewForm((p) => ({ ...p, decision: "rejected" }))}
                  className={`p-4 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all ${reviewForm.decision === "rejected" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" : "bg-primary border-[var(--border-primary)] text-slate-500"}`}>
                  <X className="w-6 h-6 mx-auto mb-1" /> Reject
                </button>
              </div>
            </div>
            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">
                {reviewForm.decision === "rejected" ? "Comments (required for rejection) *" : "Comments (optional)"}
              </label>
              <textarea value={reviewForm.comments} onChange={(e) => setReviewForm((p) => ({ ...p, comments: e.target.value }))} rows={3}
                placeholder={reviewForm.decision === "rejected" ? "Explain why this deliverable is rejected..." : "Add review comments..."}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none focus:border-[var(--brand-orange)] resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowReviewModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">Cancel</button>
              <button onClick={reviewDeliverable} disabled={saving || (reviewForm.decision === "rejected" && !reviewForm.comments.trim())}
                className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Submit Review
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
