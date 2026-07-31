"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, User, FileText, BarChart3, CheckCircle2,
  XCircle, RotateCcw, Clock, AlertTriangle, History, Sparkles,
  ChevronDown, ChevronUp, Send, RefreshCw, Eye, Star
} from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const SUB_STATUS = {
  draft: { color: "text-slate-500", bg: "bg-slate-500/10", label: "Draft" },
  submitted: { color: "text-blue-500", bg: "bg-blue-500/10", label: "Submitted" },
  approved: { color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Approved" },
  rejected: { color: "text-rose-500", bg: "bg-rose-500/10", label: "Rejected" },
  revision_requested: { color: "text-amber-500", bg: "bg-amber-500/10", label: "Revision" },
};

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.submissionId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [run, setRun] = useState(null);
  const [form, setForm] = useState(null);
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [evalHistory, setEvalHistory] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [tab, setTab] = useState("overview");
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState(null);
  const [reviewData, setReviewData] = useState({ decision: "approved", comment: "", internal_note: "" });
  const [expandedDims, setExpandedDims] = useState({});

  const notify = (msg) => { setNotif(msg); setTimeout(() => setNotif(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch run with submissions
      const res = await fetch(`/api/platform/form-runs?submission_id=${submissionId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setSubmission(data.submission);
      setRun(data.run);
      setReviews(data.reviews || []);

      // Fetch form structure
      const formRes = await fetch(`/api/platform/forms?id=${data.run.form_id}`);
      const formData = await formRes.json();
      if (formData.success) {
        setForm(formData.form);
        setSections(formData.sections || []);
        setFields(formData.fields || []);
      }

      // Fetch timeline
      const tlRes = await fetch(`/api/platform/form-runs?timeline=${submissionId}`);
      const tlData = await tlRes.json();
      if (tlData.success) setTimeline(tlData.timeline || []);

      // Fetch AI evaluation
      const evalRes = await fetch(`/api/platform/ai/evaluate-submission?submission_id=${submissionId}`);
      const evalData = await evalRes.json();
      if (evalData.success && evalData.evaluation) {
        setEvaluation(evalData.evaluation);
        // Expand all dimensions
        const exp = {};
        (evalData.evaluation.dimensions || []).forEach((d, i) => { exp[i] = true; });
        setExpandedDims(exp);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [submissionId]);

  useEffect(() => { load(); }, [load]);

  const handleReRunAI = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/platform/ai/evaluate-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: parseInt(submissionId) }),
      });
      const data = await res.json();
      if (data.success) {
        notify("AI evaluation complete");
        load(); // Reload everything
      } else {
        notify(data.error || "Evaluation failed");
      }
    } catch (_) { notify("AI evaluation failed"); }
    setSaving(false);
  };

  const handleReview = async () => {
    setSaving(true);
    try {
      // Save evaluation overrides if modified
      if (evaluation?.dimensions) {
        const hasOverrides = evaluation.dimensions.some(d => d.human_score != null);
        if (hasOverrides) {
          // Update evaluation in DB
          await fetch("/api/platform/ai/evaluation-config", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              form_id: run?.form_id,
              framework: { dimensions: evaluation.dimensions },
            }),
          });
        }
      }

      const res = await fetch("/api/platform/form-runs?action=review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: parseInt(submissionId), ...reviewData }),
      });
      const data = await res.json();
      if (data.success) {
        notify("Review submitted");
        load();
      }
    } catch (_) { notify("Failed"); }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-primary flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" /></div>;
  if (error) return <div className="min-h-screen bg-primary flex items-center justify-center"><div className="text-center"><AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" /><p className="text-[var(--text-primary)]">{error}</p><button onClick={() => router.back()} className="mt-4 text-[var(--brand-orange)] text-sm font-bold">← Go back</button></div></div>;

  const subData = submission?.data || {};
  const scores = subData._scores;
  const subStatus = SUB_STATUS[submission?.status] || SUB_STATUS.draft;
  const fieldMap = {};
  fields.forEach(f => { fieldMap[f.id] = f; fieldMap[f.label] = f; });

  // Build applicant summary
  const summaryFields = ["Full Name", "Email", "Phone Number", "Startup Name", "Startup Industry", "Stage of Business", "Country", "City", "Team Size"];
  const summary = summaryFields.map(k => ({ label: k, value: subData[k] })).filter(s => s.value);

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "application", label: "Application", icon: FileText },
    { id: "ai", label: "AI Evaluation", icon: Sparkles },
    { id: "history", label: "History", icon: History },
    { id: "timeline", label: "Timeline", icon: Clock },
  ];

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {notif && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-xs font-black uppercase">{notif}</div>}

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-[var(--border-primary)] bg-secondary shrink-0">
        <button onClick={() => router.back()} className="text-xs font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft className="w-3 h-3 inline mr-1" /> Back</button>
        <span className="text-[var(--text-secondary)] opacity-30">|</span>
        <User className="w-4 h-4 text-[var(--brand-orange)]" />
        <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">{submission?.submitter_name || submission?.submitter_id || "Review"}</h2>
        <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", subStatus.color, subStatus.bg)}>{subStatus.label}</span>
        <div className="flex-1" />
        {evaluation && (
          <button onClick={handleReRunAI} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[9px] font-black uppercase hover:bg-purple-500/20">
            <RefreshCw className={cn("w-3 h-3", saving && "animate-spin")} /> Re-run AI
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-6 border-b border-[var(--border-primary)] bg-secondary shrink-0">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn("flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-black uppercase border-b-2 transition-colors", tab === t.id ? "border-[var(--brand-orange)] text-[var(--brand-orange)]" : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]")}>
            <t.icon className="w-3 h-3" /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ─── OVERVIEW TAB ─── */}
        {tab === "overview" && (
          <div className="max-w-3xl space-y-6">
            {/* Applicant Summary */}
            <div className="card p-6 space-y-4">
              <h3 className="text-sm font-black uppercase text-[var(--text-primary)] flex items-center gap-2"><User className="w-4 h-4 text-[var(--brand-orange)]" /> Applicant Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {summary.map(s => (
                  <div key={s.label}>
                    <p className="text-[9px] font-black uppercase text-[var(--text-secondary)]">{s.label}</p>
                    <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{formatValue(s.value)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Scores */}
            {(scores || evaluation) && (
              <div className="card p-6 space-y-4">
                <h3 className="text-sm font-black uppercase text-[var(--text-primary)] flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[var(--brand-orange)]" /> Assessment Score</h3>
                {evaluation && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                    <Sparkles className="w-6 h-6 text-purple-400" />
                    <div>
                      <p className="text-lg font-black text-purple-400">{evaluation.overall_score}%</p>
                      <p className="text-[10px] text-purple-300">{evaluation.ranking} · {evaluation.recommendation?.substring(0, 100)}</p>
                    </div>
                  </div>
                )}
                {scores && !evaluation && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-[var(--brand-orange)]/5 border border-[var(--brand-orange)]/20">
                    <BarChart3 className="w-6 h-6 text-[var(--brand-orange)]" />
                    <div>
                      <p className={cn("text-lg font-black", scores.overall >= 80 ? "text-emerald-500" : scores.overall >= 60 ? "text-amber-500" : "text-rose-500")}>{scores.overall}%</p>
                      <p className="text-[10px] text-[var(--text-secondary)]">{scores.ranking}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Decision */}
            <div className="card p-6 space-y-4">
              <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">Decision</h3>
              <div className="flex gap-3">
                {["approved", "rejected", "revision_requested"].map(d => (
                  <button key={d} onClick={() => setReviewData({ ...reviewData, decision: d })} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all", reviewData.decision === d ? (d === "approved" ? "bg-emerald-500/10 border-emerald-500 text-emerald-400" : d === "rejected" ? "bg-rose-500/10 border-rose-500 text-rose-400" : "bg-amber-500/10 border-amber-500 text-amber-400") : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]")}>
                    {d === "approved" ? <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> : d === "rejected" ? <XCircle className="w-3.5 h-3.5 inline mr-1" /> : <RotateCcw className="w-3.5 h-3.5 inline mr-1" />}
                    {d === "revision_requested" ? "Revision" : d}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                <textarea value={reviewData.comment} onChange={e => setReviewData({ ...reviewData, comment: e.target.value })} rows={2} placeholder="Comment (visible to applicant)..." className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none" />
                <textarea value={reviewData.internal_note} onChange={e => setReviewData({ ...reviewData, internal_note: e.target.value })} rows={2} placeholder="Internal note (private)..." className="w-full rounded-xl px-4 py-3 text-sm font-bold outline-none bg-amber-500/5 border border-amber-500/20 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none" />
              </div>
              <button onClick={handleReview} disabled={saving} className="w-full py-3 rounded-xl bg-[var(--brand-orange)] text-black text-xs font-black uppercase hover:brightness-110 disabled:opacity-50">
                {saving ? "Saving..." : "Submit Review"}
              </button>
            </div>
          </div>
        )}

        {/* ─── APPLICATION TAB ─── */}
        {tab === "application" && (
          <div className="max-w-3xl space-y-8">
            {sections.map(sec => {
              const secFields = fields.filter(f => String(f.section_id) === String(sec.id));
              if (secFields.length === 0) return null;
              return (
                <div key={sec.id} className="card p-6 space-y-4">
                  <h3 className="text-sm font-black uppercase text-[var(--text-primary)] pb-2 border-b border-[var(--border-primary)]">{sec.title}</h3>
                  <div className="space-y-4">
                    {secFields.map(f => {
                      const val = subData[f.label] ?? subData[f.id];
                      if (val === undefined || val === null || val === "") return null;
                      return (
                        <div key={f.id}>
                          <p className="text-[10px] font-black uppercase text-[var(--text-secondary)] mb-1">{f.label}</p>
                          <p className="text-sm text-[var(--text-primary)] font-bold leading-relaxed">{formatValue(val)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── AI EVALUATION TAB ─── */}
        {tab === "ai" && (
          <div className="max-w-4xl space-y-6">
            {!evaluation && (
              <div className="card p-6 text-center">
                <Sparkles className="w-10 h-10 text-purple-400 mx-auto mb-3" />
                <p className="text-sm font-bold text-[var(--text-primary)]">No AI evaluation yet</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Set up an evaluation framework for this form first</p>
                <button onClick={handleReRunAI} disabled={saving} className="mt-4 px-4 py-2 rounded-xl bg-purple-500 text-white text-xs font-black uppercase hover:bg-purple-600">
                  Run AI Evaluation
                </button>
              </div>
            )}
            {evaluation?.dimensions?.map((dim, di) => {
              const isExp = expandedDims[di] !== false;
              return (
                <div key={di} className="card p-5 space-y-3">
                  <button onClick={() => setExpandedDims(prev => ({ ...prev, [di]: !prev[di] }))} className="w-full flex items-center justify-between text-left">
                    <div className="flex items-center gap-3">
                      <span className={cn("text-lg font-black", (dim.final_score ?? dim.ai_score) >= 7 ? "text-emerald-400" : (dim.final_score ?? dim.ai_score) >= 5 ? "text-amber-400" : "text-rose-400")}>{dim.final_score ?? dim.ai_score}</span>
                      <span className="text-sm font-black uppercase text-[var(--text-primary)]">{dim.name}</span>
                    </div>
                    {isExp ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                  </button>

                  {isExp && (
                    <div className="space-y-3 pt-2">
                      {/* AI vs Human */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                          <p className="text-[8px] font-black uppercase text-purple-400 mb-1">AI Score</p>
                          <p className="text-xl font-black text-purple-400">{dim.ai_score}</p>
                          {dim.confidence != null && <p className="text-[9px] text-purple-300 mt-0.5">{(dim.confidence * 100).toFixed(0)}% confidence</p>}
                        </div>
                        <div className="p-3 rounded-xl bg-[var(--brand-orange)]/5 border border-[var(--brand-orange)]/20">
                          <p className="text-[8px] font-black uppercase text-[var(--text-secondary)] mb-1">Your Score</p>
                          <input type="number" min={0} max={10} step={0.5} value={dim.human_score ?? ""} placeholder={String(dim.ai_score)}
                            onChange={e => {
                              const val = e.target.value === "" ? null : parseFloat(e.target.value);
                              const dims = [...evaluation.dimensions];
                              dims[di] = { ...dims[di], human_score: val, final_score: val ?? dim.ai_score };
                              setEvaluation({ ...evaluation, dimensions: dims });
                            }}
                            className="w-20 px-2 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-lg font-black text-[var(--text-primary)] outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>
                      </div>

                      {/* AI Reasoning */}
                      {dim.ai_reasoning && (
                        <div className="p-3 rounded-xl bg-tertiary">
                          <p className="text-[8px] font-black uppercase text-[var(--text-secondary)] mb-1">AI Reasoning</p>
                          <p className="text-xs text-[var(--text-primary)] leading-relaxed">{dim.ai_reasoning}</p>
                        </div>
                      )}

                      {/* Evidence */}
                      {dim.ai_evidence?.length > 0 && (
                        <div className="p-3 rounded-xl bg-tertiary">
                          <p className="text-[8px] font-black uppercase text-[var(--text-secondary)] mb-1">Evidence</p>
                          {dim.ai_evidence.map((e, i) => <p key={i} className="text-[10px] text-[var(--text-secondary)] leading-relaxed">"{e}"</p>)}
                        </div>
                      )}

                      {/* Strengths & Weaknesses */}
                      <div className="grid grid-cols-2 gap-3">
                        {dim.ai_strengths?.length > 0 && (
                          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                            <p className="text-[8px] font-black uppercase text-emerald-400 mb-1">Strengths</p>
                            {dim.ai_strengths.map((s, i) => <p key={i} className="text-[10px] text-emerald-300">+ {s}</p>)}
                          </div>
                        )}
                        {dim.ai_weaknesses?.length > 0 && (
                          <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                            <p className="text-[8px] font-black uppercase text-rose-400 mb-1">Weaknesses</p>
                            {dim.ai_weaknesses.map((w, i) => <p key={i} className="text-[10px] text-rose-300">− {w}</p>)}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ─── HISTORY TAB ─── */}
        {tab === "history" && (
          <div className="max-w-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black uppercase text-[var(--text-primary)]">Evaluation History</h3>
              <button onClick={handleReRunAI} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[9px] font-black uppercase hover:bg-purple-500/20">
                <RefreshCw className={cn("w-3 h-3", saving && "animate-spin")} /> New Evaluation
              </button>
            </div>
            {evalHistory.length === 0 && !evaluation && (
              <div className="card p-6 text-center">
                <History className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-2" />
                <p className="text-xs text-[var(--text-secondary)]">No evaluation history</p>
              </div>
            )}
            {(evaluation || evalHistory.length > 0) && (
              <div className="space-y-3">
                {evaluation && (
                  <div className="card p-4 border border-purple-500/30 bg-purple-500/5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-black uppercase text-purple-400">Latest · {new Date(evaluation.evaluated_at).toLocaleString()}</p>
                        <p className="text-sm font-bold text-[var(--text-primary)] mt-1">Score: {evaluation.overall_score}% · {evaluation.ranking}</p>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[8px] font-black uppercase">Active</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TIMELINE TAB ─── */}
        {tab === "timeline" && (
          <div className="max-w-2xl space-y-3">
            {timeline.map((entry, idx) => (
              <div key={idx} className="flex items-start gap-3">
                <div className={cn("w-2 h-2 mt-1.5 rounded-full shrink-0",
                  entry.action === "submitted" ? "bg-blue-500" :
                  entry.action === "approved" ? "bg-emerald-500" :
                  entry.action === "rejected" ? "bg-rose-500" :
                  entry.action === "ai_evaluated" ? "bg-purple-500" :
                  "bg-[var(--brand-orange)]"
                )} />
                <div>
                  <p className="text-xs font-black uppercase text-[var(--text-primary)]">{entry.action}</p>
                  {entry.actor_name && <p className="text-[10px] text-[var(--text-secondary)]">by {entry.actor_name}</p>}
                  <p className="text-[9px] text-[var(--text-secondary)]">{new Date(entry.created_at).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {timeline.length === 0 && <p className="text-xs text-[var(--text-secondary)] text-center py-8">No activity recorded</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function formatValue(val) {
  if (val === undefined || val === null || val === "") return "—";
  const s = String(val);
  if (s.startsWith("{") && s.includes('"code"')) {
    try {
      const p = JSON.parse(s);
      if (p.code && p.number) return `${p.code} ${p.number}`;
    } catch (_) {}
  }
  return s;
}
