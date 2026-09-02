"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, CheckCircle2, AlertCircle, X, Plus, DollarSign, Target, Calendar,
  TrendingUp, MessageCircle, Phone, Mail, Users,
} from "lucide-react";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

const STAGES = [
  { key: "prospect", label: "Prospect", color: "bg-slate-500/10 text-slate-400" },
  { key: "contacted", label: "Contacted", color: "bg-blue-500/10 text-blue-400" },
  { key: "meeting_scheduled", label: "Meeting", color: "bg-amber-500/10 text-amber-400" },
  { key: "pitch_delivered", label: "Pitched", color: "bg-purple-500/10 text-purple-400" },
  { key: "due_diligence", label: "Due Diligence", color: "bg-emerald-500/10 text-emerald-400" },
  { key: "negotiation", label: "Negotiation", color: "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]" },
  { key: "term_sheet", label: "Term Sheet", color: "bg-rose-500/10 text-rose-400" },
  { key: "closed_won", label: "Won", color: "bg-emerald-500/20 text-emerald-500" },
  { key: "closed_lost", label: "Lost", color: "bg-slate-500/10 text-slate-500" },
];

const ACTIVITY_ICONS = { email: Mail, call: Phone, meeting: Users, demo: Target, reminder: Calendar, follow_up: MessageCircle, task: CheckCircle2 };

export default function VentureFundraisingPage() {
  const { id } = useParams();
  const router = useRouter();
  const [venture, setVenture] = useState(null);
  const [opportunities, setOpportunities] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("kanban");
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [oForm, setOForm] = useState({ investor_name: "", expected_amount: "", probability: "10", stage: "prospect", expected_close_date: "", next_action: "" });
  const [noteText, setNoteText] = useState("");
  const [activityForm, setActivityForm] = useState({ activity_type: "email", title: "" });

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async (bypassCache = false) => {
    const urls = [
      `/api/ventures/${id}`,
      `/api/ventures/${id}/fundraising`,
      `/api/ventures/${id}/fundraising?type=analytics`,
    ];
    const apply = (v, o, a) => {
      if (v.success) setVenture(v.venture);
      if (o.success) setOpportunities(o.opportunities || []);
      if (a.success) setAnalytics(a);
    };
    let painted = false;
    setLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from
      // fresh snapshots; mutation flows pass bypassCache=true so the
      // pipeline always reflects the last action.
      if (!bypassCache) {
        const cached = urls.map((u) => cacheGet(u));
        if (cached.every((c) => c !== null && c.success)) {
          apply(cached[0], cached[1], cached[2]);
          setLoading(false);
          painted = true;
        }
      }
      const [vRes, oRes, aRes] = await Promise.all([
        fetch(urls[0]),
        fetch(urls[1]),
        fetch(urls[2]),
      ]);
      const v = await vRes.json(); const o = await oRes.json(); const a = await aRes.json();
      if (v.success) cacheSet(urls[0], v);
      if (o.success) cacheSet(urls[1], o);
      if (a.success) cacheSet(urls[2], a);
      apply(v, o, a);
    } catch (e) {
      if (!painted) console.error("Failed to load fundraising data:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (oppId, bypassCache = false) => {
    const url = `/api/ventures/${id}/fundraising?type=detail&opportunity_id=${oppId}`;
    const apply = (d) => {
      if (d.success) { setSelectedOpp(d.opportunity); setShowDetail(true); }
    };
    let painted = false;
    try {
      // Cache-first paint: re-opening the same opportunity renders instantly
      // from a fresh snapshot; mutation flows pass bypassCache=true so the
      // drawer always reflects the last action.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          painted = true;
        }
      }
      const res = await fetch(url);
      const d = await res.json();
      if (d.success) cacheSet(url, d);
      apply(d);
    } catch (e) {
      if (!painted) console.error("Failed to load opportunity detail:", e);
    }
  };

  const updateStage = async (oppId, newStage) => {
    await fetch(`/api/ventures/${id}/fundraising`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", opportunity_id: oppId, updates: { stage: newStage } }),
    });
    fetchAll(true);
  };

  const createOpp = async () => {
    if (!oForm.investor_name.trim()) return;
    setSaving(true);
    await fetch(`/api/ventures/${id}/fundraising`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...oForm, expected_amount: oForm.expected_amount ? parseFloat(oForm.expected_amount) : null, probability: parseInt(oForm.probability) }),
    });
    setSaving(false); setShowCreateModal(false);
    setOForm({ investor_name: "", expected_amount: "", probability: "10", stage: "prospect", expected_close_date: "", next_action: "" });
    fetchAll(true);
  };

  const addNote = async () => {
    if (!noteText.trim() || !selectedOpp) return;
    await fetch(`/api/ventures/${id}/fundraising`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_note", opportunity_id: selectedOpp.id, content: noteText.trim() }),
    });
    setNoteText(""); loadDetail(selectedOpp.id, true);
  };

  const addActivity = async () => {
    if (!activityForm.title.trim() || !selectedOpp) return;
    await fetch(`/api/ventures/${id}/fundraising`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_activity", opportunity_id: selectedOpp.id, ...activityForm }),
    });
    setActivityForm({ activity_type: "email", title: "" }); loadDetail(selectedOpp.id, true);
  };

  const progressBar = (pct) => (
    <div className="w-full bg-tertiary rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-[var(--brand-orange)]"}`} style={{ width: `${pct}%` }} />
    </div>
  );

  if (loading) return (
    <><div className="flex items-center justify-center h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></>
  );

  const byStage = {};
  for (const s of STAGES) byStage[s.key] = opportunities.filter((o) => o.stage === s.key);

  const totalValue = opportunities.reduce((s, o) => s + (parseFloat(o.expected_amount) || 0), 0);

  return (
    <>
      <div className="space-y-8 pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <button onClick={() => router.push(`/admin/ventures/${id}/dashboard`)}
              className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-[var(--text-primary)] transition-all mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Dashboard
            </button>
            <h1 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-[var(--brand-orange)]" /> Fundraising Pipeline
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">{venture?.company_name||""} · {opportunities.length} opportunities · ${totalValue.toLocaleString()} total</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="px-4 py-2.5 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center gap-2">
            <Plus className="w-3.5 h-3.5" /> Add Opportunity
          </button>
        </div>

        {/* Pipeline Value Cards */}
        {analytics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[7px] font-black text-slate-500 uppercase">Pipeline</p>
              <p className="text-lg font-black">${(analytics.total_pipeline_value||0).toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[7px] font-black text-slate-500 uppercase">Opps</p>
              <p className="text-lg font-black">{analytics.total_opportunities||0}</p>
            </div>
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[7px] font-black text-slate-500 uppercase">Won</p>
              <p className="text-lg font-black text-emerald-400">{analytics.won||0}</p>
            </div>
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[7px] font-black text-slate-500 uppercase">Lost</p>
              <p className="text-lg font-black text-rose-400">{analytics.lost||0}</p>
            </div>
            <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
              <p className="text-[7px] font-black text-slate-500 uppercase">Win Rate</p>
              <p className="text-lg font-black">{analytics.win_rate||0}%</p>
            </div>
          </div>
        )}

        {/* View Toggle */}
        <div className="flex gap-1">
          {["kanban", "list"].map((v) => (
            <button key={v} onClick={() => setActiveView(v)}
              className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider ${activeView===v?"bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]":"text-slate-500 hover:bg-tertiary"}`}>{v}</button>
          ))}
        </div>

        {/* Kanban Board */}
        {activeView === "kanban" && (
          <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "50vh" }}>
            {STAGES.map((stage) => {
              const items = byStage[stage.key] || [];
              return (
                <div key={stage.key} className="flex-shrink-0 w-64">
                  <div className="rounded-2xl border border-[var(--border-primary)] bg-tertiary">
                    <div className="flex items-center justify-between p-3 border-b border-[var(--border-primary)]">
                      <div className="flex items-center gap-2">
                        <span className={`text-[8px] font-black uppercase tracking-wider ${stage.color}`}>{stage.label}</span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-500 bg-primary px-1.5 py-0.5 rounded">{items.length}</span>
                    </div>
                    <div className="p-2 space-y-2 min-h-[120px]">
                      {items.length === 0 && <p className="text-[8px] text-slate-600 text-center py-4">Empty</p>}
                      {items.map((opp) => (
                        <div key={opp.id} onClick={() => loadDetail(opp.id)}
                          className="p-3 rounded-xl bg-primary border border-[var(--border-primary)] cursor-pointer hover:border-[var(--brand-orange)]/30 transition-all">
                          <p className="text-[10px] font-bold text-[var(--text-primary)]">{opp.investor_name || "Unknown"}</p>
                          {opp.expected_amount && <p className="text-[9px] font-black text-[var(--brand-orange)] mt-1">${parseFloat(opp.expected_amount).toLocaleString()}</p>}
                          <div className="flex items-center gap-2 mt-1.5 text-[7px] text-slate-500">
                            <span>{opp.probability||0}%</span>
                            {opp.expected_close_date && <span>Due {new Date(opp.expected_close_date).toLocaleDateString()}</span>}
                          </div>
                          {progressBar(opp.probability||0)}
                          {opp.next_action && <p className="text-[7px] text-amber-400 mt-1">Next: {opp.next_action}</p>}
                        </div>
                      ))}
                      {/* Quick stage move */}
                      <div className="flex gap-1 pt-1">
                        {stage.key !== "prospect" && <button onClick={() => {/* This would need opp selection */}} className="text-[6px] text-slate-500 hover:text-[var(--text-primary)]">←</button>}
                        {stage.key !== "closed_lost" && stage.key !== "closed_won" && <button onClick={() => {/* Quick advance would need opp selection */}} className="text-[6px] text-slate-500 hover:text-[var(--text-primary)] ml-auto">→</button>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {activeView === "list" && (
          <div className="space-y-1">
            {opportunities.length === 0 ? (
              <div className="text-center py-16"><TrendingUp className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-sm text-slate-500">No opportunities</p></div>
            ) : (
              opportunities.map((opp) => {
                const sc = STAGES.find((s) => s.key === opp.stage) || STAGES[0];
                return (
                  <div key={opp.id} onClick={() => loadDetail(opp.id)}
                    className="flex items-center gap-4 p-4 rounded-xl bg-tertiary border border-[var(--border-primary)] cursor-pointer hover:border-[var(--brand-orange)]/30 transition-all">
                    <span className={`w-2 h-2 rounded-full ${sc.color.split(" ")[0].replace("text-", "bg-")} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[var(--text-primary)]">{opp.investor_name || "Unknown"}</p>
                      <div className="flex items-center gap-3 text-[8px] text-slate-500 mt-0.5">
                        <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded ${sc.color}`}>{sc.label}</span>
                        {opp.expected_amount && <span>${parseFloat(opp.expected_amount).toLocaleString()}</span>}
                        <span>{opp.probability||0}%</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <select value={opp.stage} onChange={(e) => updateStage(opp.id, e.target.value)} onClick={(e) => e.stopPropagation()}
                        className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[8px] font-bold text-[var(--text-primary)] outline-none">
                        {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] rounded-3xl p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-[var(--text-primary)]">New Opportunity</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Investor Name *</label>
                  <input value={oForm.investor_name} onChange={(e) => setOForm((p) => ({ ...p, investor_name: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Stage</label>
                  <select value={oForm.stage} onChange={(e) => setOForm((p) => ({ ...p, stage: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                    {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Expected Amount ($)</label>
                  <input type="number" value={oForm.expected_amount} onChange={(e) => setOForm((p) => ({ ...p, expected_amount: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Probability (%)</label>
                  <input type="number" min={0} max={100} value={oForm.probability} onChange={(e) => setOForm((p) => ({ ...p, probability: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Expected Close</label>
                  <input type="date" value={oForm.expected_close_date} onChange={(e) => setOForm((p) => ({ ...p, expected_close_date: e.target.value }))} className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
                <div>
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block">Next Action</label>
                  <input value={oForm.next_action} onChange={(e) => setOForm((p) => ({ ...p, next_action: e.target.value }))} placeholder="e.g., Send follow-up" className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none" />
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCreateModal(false)} className="flex-1 py-3 rounded-xl border border-[var(--border-primary)] text-[9px] font-black uppercase tracking-widest hover:bg-tertiary">Cancel</button>
              <button onClick={createOpp} disabled={saving} className="flex-1 py-3 bg-[var(--brand-orange)] text-black rounded-xl text-[9px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-30 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Drawer ── */}
      {showDetail && selectedOpp && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowDetail(false)} />
          <div className="relative w-full max-w-lg bg-[var(--bg-tertiary)] border-l border-[var(--border-primary)] overflow-y-auto">
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black text-[var(--text-primary)]">{selectedOpp.investor_name || "Unknown"}</h2>
                  <p className="text-[9px] text-slate-500">{selectedOpp.investor_email}</p>
                </div>
                <button onClick={() => setShowDetail(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-4 h-4 text-slate-500" /></button>
              </div>

              {/* Stage selector */}
              <select value={selectedOpp.stage} onChange={(e) => { updateStage(selectedOpp.id, e.target.value); setSelectedOpp((p) => ({ ...p, stage: e.target.value })); }}
                className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text-primary)] outline-none">
                {STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>

              <div className="grid grid-cols-2 gap-3 text-[10px]">
                {selectedOpp.expected_amount && <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">Amount</p><p className="font-bold mt-0.5 text-[var(--brand-orange)]">${parseFloat(selectedOpp.expected_amount).toLocaleString()}</p></div>}
                <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">Probability</p><p className="font-bold mt-0.5">{selectedOpp.probability||0}%</p></div>
                {selectedOpp.expected_close_date && <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">Close Date</p><p className="font-bold mt-0.5">{new Date(selectedOpp.expected_close_date).toLocaleDateString()}</p></div>}
                {selectedOpp.next_action && <div className="p-3 bg-primary rounded-xl"><p className="text-[7px] font-black text-slate-500 uppercase">Next Action</p><p className="font-bold mt-0.5 text-amber-400">{selectedOpp.next_action}</p></div>}
              </div>

              {/* Stage History */}
              {(selectedOpp.stage_history||[]).length > 0 && (
                <div>
                  <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Stage History</p>
                  <div className="space-y-1">
                    {selectedOpp.stage_history.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 p-2 bg-primary rounded-lg text-[8px]">
                        <span className="font-bold">{h.previous_stage||"Start"}</span>
                        <span>→</span>
                        <span className="font-bold text-[var(--brand-orange)]">{h.new_stage}</span>
                        <span className="text-slate-500 ml-auto">{new Date(h.created_at).toLocaleDateString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Activities */}
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Activities</p>
                <div className="flex gap-2 mb-2">
                  <select value={activityForm.activity_type} onChange={(e) => setActivityForm((p) => ({ ...p, activity_type: e.target.value }))}
                    className="bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[8px] font-bold outline-none">
                    <option value="email">Email</option><option value="call">Call</option><option value="meeting">Meeting</option>
                    <option value="demo">Demo</option><option value="reminder">Reminder</option><option value="follow_up">Follow-up</option><option value="task">Task</option>
                  </select>
                  <input value={activityForm.title} onChange={(e) => setActivityForm((p) => ({ ...p, title: e.target.value }))} placeholder="Activity..." className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[9px] font-bold outline-none" />
                  <button onClick={addActivity} disabled={!activityForm.title.trim()} className="px-2 py-1.5 bg-[var(--brand-orange)] text-black rounded-lg text-[7px] font-black uppercase disabled:opacity-30"><Plus className="w-3 h-3" /></button>
                </div>
                {(selectedOpp.activities||[]).length === 0 && <p className="text-[9px] text-slate-500 italic">No activities</p>}
                {(selectedOpp.activities||[]).map((a) => {
                  const Icon = ACTIVITY_ICONS[a.activity_type] || MessageCircle;
                  return (
                    <div key={a.id} className="flex items-center gap-2 p-2 bg-primary rounded-lg mb-1">
                      <Icon className="w-3.5 h-3.5 text-[var(--brand-orange)] shrink-0" />
                      <span className="text-[9px] font-bold flex-1">{a.title}</span>
                      <span className="text-[7px] text-slate-500">{new Date(a.activity_date).toLocaleDateString()}</span>
                      {a.completed && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    </div>
                  );
                })}
              </div>

              {/* Notes */}
              <div>
                <p className="text-[9px] font-black text-slate-500 uppercase mb-2">Notes</p>
                {(selectedOpp.notes||[]).map((n) => (
                  <div key={n.id} className="p-3 bg-primary rounded-xl mb-2 border border-[var(--border-primary)]">
                    <p className="text-[9px] text-[var(--text-secondary)]">{n.content}</p>
                    <p className="text-[7px] text-slate-500 mt-1">{n.author_name} · {new Date(n.created_at).toLocaleString()}</p>
                  </div>
                ))}
                <div className="flex gap-2 mt-2">
                  <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note..." className="flex-1 bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] outline-none" />
                  <button onClick={addNote} disabled={!noteText.trim()} className="px-3 py-2 bg-[var(--brand-orange)] text-black rounded-lg text-[8px] font-black uppercase disabled:opacity-30">Add</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
