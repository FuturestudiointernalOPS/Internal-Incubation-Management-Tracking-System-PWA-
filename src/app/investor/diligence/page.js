"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft, Loader2, Building2, FileText, Send, Plus,
  MessageSquare, CheckCircle2, Clock, AlertCircle, ClipboardList,
  Target, Shield, TrendingUp, BarChart3, X, Users, AlertTriangle,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import GlobalToast from "@/components/ui/GlobalToast";

const REQUEST_CATEGORIES = [
  { id: "general", label: "General", color: "bg-slate-500/10 text-slate-400" },
  { id: "financial", label: "Financial", color: "bg-emerald-500/10 text-emerald-400" },
  { id: "legal", label: "Legal", color: "bg-purple-500/10 text-purple-400" },
  { id: "product", label: "Product", color: "bg-blue-500/10 text-blue-400" },
  { id: "team", label: "Team", color: "bg-amber-500/10 text-amber-400" },
  { id: "market", label: "Market", color: "bg-rose-500/10 text-rose-400" },
];

export default function DueDiligencePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pipelineId = searchParams.get("pipeline_id");

  const [workspace, setWorkspace] = useState(null);
  const [requests, setRequests] = useState([]);
  const [notes, setNotes] = useState([]);
  const [pipeline, setPipeline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  // New request form
  const [newReq, setNewReq] = useState({ title: "", description: "", category: "general" });
  const [showReqForm, setShowReqForm] = useState(false);

  // New note form
  const [newNote, setNewNote] = useState("");
  const [noteType, setNoteType] = useState("private");

  // Founder & Risk
  const [founders, setFounders] = useState([]);
  const [risks, setRisks] = useState([]);
  const [showFounderForm, setShowFounderForm] = useState(false);
  const [founderForm, setFounderForm] = useState({ founder_name:"", role:"", experience_score:0, leadership_score:0, domain_expertise_score:0, overall_rating:0, notes:"" });
  const [showRiskForm, setShowRiskForm] = useState(false);
  const [riskForm, setRiskForm] = useState({ risk_category:"market", risk_description:"", severity:"medium", mitigation:"", status:"open" });

  useEffect(() => {
    if (pipelineId) fetchData();
  }, [pipelineId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/investor/diligence?pipeline_id=${pipelineId}`);
      const data = await res.json();
      if (data.success) {
        setWorkspace(data.workspace);
        setRequests(data.requests || []);
        setNotes(data.notes || []);
        setPipeline(data.pipeline);
      }
      // Also fetch evaluations
      try {
        const evalRes = await fetch(`/api/investor/evaluation?pipeline_id=${pipelineId}`);
        const evalData = await evalRes.json();
        if (evalData.success) {
          setFounders(evalData.founder_evaluations || []);
          setRisks(evalData.risk_assessments || []);
        }
      } catch (_) {}
    } catch (_) {}
    setLoading(false);
  };

  const createWorkspace = async () => {
    try {
      const res = await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, action: "create_workspace" }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: "Due Diligence workspace created" });
        fetchData();
      }
    } catch (_) {}
  };

  const addRequest = async () => {
    if (!newReq.title.trim()) return;
    try {
      const res = await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, action: "add_request", ...newReq }),
      });
      const data = await res.json();
      if (data.success) {
        setToast({ type: "success", message: "Request submitted" });
        setNewReq({ title: "", description: "", category: "general" });
        setShowReqForm(false);
        fetchData();
      }
    } catch (_) {}
  };

  const updateRequest = async (reqId, status) => {
    try {
      await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, action: "update_request", request_id: reqId, status }),
      });
      fetchData();
    } catch (_) {}
  };

  const addNote = async () => {
    if (!newNote.trim()) return;
    try {
      const res = await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, action: "add_note", content: newNote, note_type: noteType }),
      });
      if (res.ok) { setNewNote(""); fetchData(); }
    } catch (_) {}
  };

  const completeDiligence = async () => {
    try {
      await fetch("/api/investor/diligence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, action: "complete" }),
      });
      setToast({ type: "success", message: "Diligence completed" });
      fetchData();
    } catch (_) {}
  };

  const saveFounder = async () => {
    if (!founderForm.founder_name) return;
    try {
      await fetch("/api/investor/evaluation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, type: "founder", ...founderForm }),
      });
      setToast({ type: "success", message: "Founder evaluation saved" });
      setShowFounderForm(false);
      setFounderForm({ founder_name:"", role:"", experience_score:0, leadership_score:0, domain_expertise_score:0, overall_rating:0, notes:"" });
      fetchData();
    } catch (_) {}
  };

  const saveRisk = async () => {
    if (!riskForm.risk_description) return;
    try {
      await fetch("/api/investor/evaluation", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipeline_id: pipelineId, type: "risk", ...riskForm }),
      });
      setToast({ type: "success", message: "Risk assessment saved" });
      setShowRiskForm(false);
      setRiskForm({ risk_category:"market", risk_description:"", severity:"medium", mitigation:"", status:"open" });
      fetchData();
    } catch (_) {}
  };

  const completedReqs = requests.filter(r => r.status === "responded" || r.status === "closed").length;
  const progress = requests.length > 0 ? Math.round((completedReqs / requests.length) * 100) : 0;

  if (loading) {
    return <DashboardLayout role="investor"><div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" /></div></DashboardLayout>;
  }

  return (
    <DashboardLayout role="investor">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        <GlobalToast toast={toast} onClose={() => setToast(null)} />

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:text-[var(--brand-orange)]"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <h1 className="text-xl font-black text-[var(--text-primary)] uppercase tracking-tighter">
              Due Diligence: {pipeline?.venture_name || "Venture"}
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">{pipeline?.industry} · {pipeline?.country} · {pipeline?.business_stage}</p>
          </div>
          {workspace && workspace.status !== "completed" && (
            <AppButton variant="primary" icon={CheckCircle2} onClick={completeDiligence}>Complete</AppButton>
          )}
        </div>

        {/* No Workspace */}
        {!workspace ? (
          <div className="text-center py-20">
            <Shield className="w-16 h-16 text-[var(--text-tertiary)] mx-auto mb-4" />
            <h2 className="text-lg font-black text-[var(--text-primary)] uppercase mb-2">Start Due Diligence</h2>
            <p className="text-sm text-[var(--text-secondary)] max-w-md mx-auto mb-6">
              Create a secure due diligence workspace to evaluate this venture.
            </p>
            <AppButton variant="primary" icon={Shield} onClick={createWorkspace}>Begin Due Diligence</AppButton>
          </div>
        ) : (
          <>
            {/* Progress */}
            {requests.length > 0 && (
              <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-primary)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-black text-[var(--text-secondary)] uppercase tracking-widest">Progress</span>
                  <span className="text-xs font-bold text-[var(--brand-orange)]">{progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--brand-orange)] transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-[10px] text-[var(--text-tertiary)] mt-2">{completedReqs}/{requests.length} items resolved</p>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 border-b border-[var(--border-primary)]">
              {[
                { id: "overview", label: "Overview", icon: Building2 },
                { id: "requests", label: `Requests (${requests.length})`, icon: ClipboardList },
                { id: "founders", label: "Founders", icon: Users },
                { id: "risks", label: "Risks", icon: AlertTriangle },
                { id: "notes", label: `Notes (${notes.length})`, icon: MessageSquare },
              ].map(tab => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-[10px] font-black uppercase tracking-wider relative ${
                    activeTab === tab.id ? "text-[var(--brand-orange)]" : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}>
                  <tab.icon className="w-3.5 h-3.5" />{tab.label}
                  {activeTab === tab.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-orange)]" />}
                </button>
              ))}
            </div>

            {/* Overview */}
            {activeTab === "overview" && (
              <div className="space-y-4">
                <AppCard padding="lg">
                  <div className="space-y-4">
                    <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Venture Overview</h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{pipeline?.venture_description || "No description available."}</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: "Industry", value: pipeline?.industry || "—" },
                        { label: "Country", value: pipeline?.country || "—" },
                        { label: "Stage", value: pipeline?.business_stage || "—" },
                        { label: "Status", value: workspace.status || "active" },
                      ].map((m, i) => (
                        <div key={i} className="p-3 rounded-xl bg-[var(--surface-3)]">
                          <p className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest">{m.label}</p>
                          <p className="text-xs font-bold text-[var(--text-primary)] mt-1">{m.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </AppCard>
              </div>
            )}

            {/* Requests */}
            {activeTab === "requests" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Information Requests</h3>
                  <AppButton variant="primary" size="sm" icon={Plus} onClick={() => setShowReqForm(true)}>New Request</AppButton>
                </div>

                {showReqForm && (
                  <AppCard padding="md">
                    <div className="space-y-3">
                      <input value={newReq.title} onChange={e => setNewReq({...newReq, title: e.target.value})}
                        placeholder="What information do you need?"
                        className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none" />
                      <textarea value={newReq.description} onChange={e => setNewReq({...newReq, description: e.target.value})}
                        rows={2} placeholder="Additional details..."
                        className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none" />
                      <div className="flex gap-2 flex-wrap">
                        {REQUEST_CATEGORIES.map(c => (
                          <button key={c.id} onClick={() => setNewReq({...newReq, category: c.id})}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${newReq.category === c.id ? "bg-[var(--brand-orange)] text-white" : c.color}`}>
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <AppButton variant="secondary" size="sm" onClick={() => setShowReqForm(false)}>Cancel</AppButton>
                        <AppButton variant="primary" size="sm" icon={Send} onClick={addRequest}>Submit</AppButton>
                      </div>
                    </div>
                  </AppCard>
                )}

                {requests.length === 0 && !showReqForm ? (
                  <div className="text-center py-12">
                    <ClipboardList className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
                    <p className="text-sm font-bold text-[var(--text-secondary)]">No requests yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requests.map(r => {
                      const cat = REQUEST_CATEGORIES.find(c => c.id === r.category) || REQUEST_CATEGORIES[0];
                      return (
                        <AppCard key={r.id} padding="md">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${cat.color}`}>{cat.label}</span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                  r.status === "responded" || r.status === "closed" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                                }`}>{r.status}</span>
                              </div>
                              <p className="text-sm font-bold text-[var(--text-primary)]">{r.title}</p>
                              {r.description && <p className="text-xs text-[var(--text-secondary)] mt-1">{r.description}</p>}
                              {r.response_text && (
                                <div className="mt-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                                  <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Response:</p>
                                  <p className="text-xs text-[var(--text-secondary)]">{r.response_text}</p>
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 shrink-0">
                              {r.status === "pending" && (
                                <>
                                  <AppButton variant="secondary" size="sm" onClick={() => updateRequest(r.id, "responded")}><CheckCircle2 className="w-3 h-3" /></AppButton>
                                  <AppButton variant="secondary" size="sm" onClick={() => updateRequest(r.id, "closed")}><X className="w-3 h-3" /></AppButton>
                                </>
                              )}
                            </div>
                          </div>
                        </AppCard>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Founder Evaluation */}
            {activeTab === "founders" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Founder Evaluations</h3><AppButton variant="primary" size="sm" icon={Plus} onClick={()=>setShowFounderForm(true)}>Evaluate Founder</AppButton></div>
                {showFounderForm && (<AppCard padding="md"><div className="space-y-3">
                  <input value={founderForm.founder_name} onChange={e=>setFounderForm({...founderForm,founder_name:e.target.value})} placeholder="Founder name *" className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"/>
                  <input value={founderForm.role} onChange={e=>setFounderForm({...founderForm,role:e.target.value})} placeholder="Role (e.g. CEO, CTO)" className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"/>
                  <div className="grid grid-cols-4 gap-2">
                    {[{key:"experience_score",label:"Experience"},{key:"leadership_score",label:"Leadership"},{key:"domain_expertise_score",label:"Domain"},{key:"overall_rating",label:"Overall"}].map(s=>(<div key={s.key}><label className="text-[7px] font-black text-[var(--text-secondary)] uppercase">{s.label} (0-10)</label><input type="number" min={0} max={10} value={founderForm[s.key]} onChange={e=>setFounderForm({...founderForm,[s.key]:parseInt(e.target.value)||0})} className="w-full mt-0.5 px-2 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-xs font-bold text-[var(--text-primary)] outline-none"/></div>))}
                  </div>
                  <textarea value={founderForm.notes} onChange={e=>setFounderForm({...founderForm,notes:e.target.value})} rows={2} placeholder="Evaluation notes..." className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/>
                  <div className="flex justify-end gap-2"><AppButton variant="secondary" size="sm" onClick={()=>setShowFounderForm(false)}>Cancel</AppButton><AppButton variant="primary" size="sm" icon={Save} onClick={saveFounder}>Save</AppButton></div>
                </div></AppCard>)}
                {founders.length===0&&!showFounderForm?<div className="text-center py-12"><Users className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3"/><p className="text-sm font-bold text-[var(--text-secondary)]">No founder evaluations yet</p></div>:<div className="space-y-3">{founders.map(f=>(<AppCard key={f.id} padding="md"><div className="flex items-start justify-between"><div><p className="text-sm font-bold text-[var(--text-primary)]">{f.founder_name}{f.role?` — ${f.role}`:""}</p><div className="flex gap-4 mt-2 text-[10px]"><span className="text-[var(--text-secondary)]">Exp: <b className="text-[var(--text-primary)]">{f.experience_score}/10</b></span><span className="text-[var(--text-secondary)]">Leadership: <b className="text-[var(--text-primary)]">{f.leadership_score}/10</b></span><span className="text-[var(--text-secondary)]">Domain: <b className="text-[var(--text-primary)]">{f.domain_expertise_score}/10</b></span></div><div className="mt-1"><span className="text-[10px] font-black text-[var(--brand-orange)]">Overall: {f.overall_rating}/10</span></div>{f.notes&&<p className="text-[10px] text-[var(--text-tertiary)] mt-2">{f.notes}</p>}</div></div></AppCard>))}</div>}
              </div>
            )}

            {/* Risk Assessment */}
            {activeTab === "risks" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center"><h3 className="text-sm font-black text-[var(--text-primary)] uppercase">Risk Assessments</h3><AppButton variant="primary" size="sm" icon={Plus} onClick={()=>setShowRiskForm(true)}>Add Risk</AppButton></div>
                {showRiskForm && (<AppCard padding="md"><div className="space-y-3">
                  <div className="flex gap-2">{["market","product","financial","operational","legal"].map(c=>(<button key={c} onClick={()=>setRiskForm({...riskForm,risk_category:c})} className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase ${riskForm.risk_category===c?"bg-[var(--brand-orange)] text-white":"bg-[var(--surface-3)] text-[var(--text-secondary)]"}`}>{c}</button>))}</div>
                  <textarea value={riskForm.risk_description} onChange={e=>setRiskForm({...riskForm,risk_description:e.target.value})} rows={2} placeholder="Describe the risk *" className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none"/>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="text-[7px] font-black text-[var(--text-secondary)] uppercase">Severity</label><select value={riskForm.severity} onChange={e=>setRiskForm({...riskForm,severity:e.target.value})} className="w-full mt-0.5 px-2 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-xs font-bold outline-none"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
                    <div><label className="text-[7px] font-black text-[var(--text-secondary)] uppercase">Status</label><select value={riskForm.status} onChange={e=>setRiskForm({...riskForm,status:e.target.value})} className="w-full mt-0.5 px-2 py-2 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg text-xs font-bold outline-none"><option value="open">Open</option><option value="mitigated">Mitigated</option><option value="accepted">Accepted</option></select></div>
                    <div/>
                  </div>
                  <input value={riskForm.mitigation} onChange={e=>setRiskForm({...riskForm,mitigation:e.target.value})} placeholder="Mitigation strategy (optional)" className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"/>
                  <div className="flex justify-end gap-2"><AppButton variant="secondary" size="sm" onClick={()=>setShowRiskForm(false)}>Cancel</AppButton><AppButton variant="primary" size="sm" onClick={saveRisk}>Save</AppButton></div>
                </div></AppCard>)}
                {risks.length===0&&!showRiskForm?<div className="text-center py-12"><AlertTriangle className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3"/><p className="text-sm font-bold text-[var(--text-secondary)]">No risks assessed yet</p></div>:<div className="space-y-3">{risks.map(r=>{const sevColors={low:"bg-blue-500/10 text-blue-400",medium:"bg-amber-500/10 text-amber-400",high:"bg-orange-500/10 text-orange-400",critical:"bg-rose-500/10 text-rose-400"};return(<AppCard key={r.id} padding="md"><div className="flex items-start justify-between"><div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-purple-500/10 text-purple-400">{r.risk_category}</span><span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${sevColors[r.severity]||sevColors.medium}`}>{r.severity}</span><span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${r.status==="open"?"bg-amber-500/10 text-amber-400":r.status==="mitigated"?"bg-emerald-500/10 text-emerald-400":"bg-slate-500/10 text-slate-400"}`}>{r.status}</span></div><p className="text-xs text-[var(--text-primary)]">{r.risk_description}</p>{r.mitigation&&<p className="text-[10px] text-emerald-400 mt-1">Mitigation: {r.mitigation}</p>}</div></div></AppCard>)})}</div>}
              </div>
            )}

            {/* Notes */}
            {activeTab === "notes" && (
              <div className="space-y-4">
                <AppCard padding="md">
                  <div className="space-y-3">
                    <textarea value={newNote} onChange={e => setNewNote(e.target.value)}
                      rows={2} placeholder="Write an investment note..."
                      className="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl text-sm font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none resize-none" />
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {["private", "shared", "advisor", "decision"].map(t => (
                          <button key={t} onClick={() => setNoteType(t)}
                            className={`px-2 py-1 rounded text-[8px] font-black uppercase ${noteType === t ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)]"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                      <AppButton variant="primary" size="sm" icon={Send} onClick={addNote}>Save</AppButton>
                    </div>
                  </div>
                </AppCard>

                {notes.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-3" />
                    <p className="text-sm font-bold text-[var(--text-secondary)]">No notes yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {notes.map(n => (
                      <AppCard key={n.id} padding="md">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                                n.note_type === "private" ? "bg-slate-500/10 text-slate-400" :
                                n.note_type === "shared" ? "bg-blue-500/10 text-blue-400" :
                                n.note_type === "advisor" ? "bg-purple-500/10 text-purple-400" : "bg-[var(--brand-orange)]/10 text-[var(--brand-orange)]"
                              }`}>{n.note_type}</span>
                            </div>
                            <p className="text-xs text-[var(--text-primary)]">{n.content}</p>
                            <p className="text-[10px] text-[var(--text-tertiary)] mt-2">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      </AppCard>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
