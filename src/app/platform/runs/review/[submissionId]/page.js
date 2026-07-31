"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, User, FileText, CheckCircle2, XCircle,
  RotateCcw, Clock, AlertTriangle, Sparkles, ChevronDown,
  ChevronUp, RefreshCw, ExternalLink, History
} from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const DEFAULT_WORKFLOW = {
  decisions: [
    { id: "approved", label: "Approve", icon: "CheckCircle2", color: "emerald" },
    { id: "rejected", label: "Reject", icon: "XCircle", color: "rose" },
    { id: "revision_requested", label: "Request Revision", icon: "RotateCcw", color: "amber" },
  ],
  statusLabels: { draft: "Draft", submitted: "Submitted", approved: "Approved", rejected: "Rejected", revision_requested: "Revision" },
};

const ICON_MAP = { CheckCircle2, XCircle, RotateCcw };

// Render a single field value based on its type
function FieldValue({ field, value }) {
  if (value === undefined || value === null || value === "") return <span className="text-[var(--text-secondary)] italic">No response</span>;

  const s = String(value);

  switch (field?.field_type) {
    case "phone":
      if (s.startsWith("{") && s.includes('"code"')) {
        try {
          const p = JSON.parse(s);
          if (p.code && p.number) return <span>{p.code} {p.number}</span>;
        } catch (_) {}
      }
      return <span>{s}</span>;
    case "url":
      return <a href={s.startsWith("http") ? s : `https://${s}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">{s}</a>;
    case "email":
      return <a href={`mailto:${s}`} className="text-blue-400 hover:underline">{s}</a>;
    case "rating": {
      const num = parseInt(s);
      if (!isNaN(num)) {
        return (
          <div className="flex gap-1">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={cn("w-5 h-5 rounded text-[10px] flex items-center justify-center font-black", i < num ? "bg-amber-500 text-white" : "bg-tertiary text-[var(--text-secondary)]")}>{i + 1}</div>
            ))}
          </div>
        );
      }
      return <span>{s}</span>;
    }
    case "file":
      return <span className="text-purple-400">📎 File uploaded</span>;
    default:
      return <span className="whitespace-pre-wrap">{s.length > 500 ? s.substring(0, 500) + "..." : s}</span>;
  }
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.submissionId;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [run, setRun] = useState(null);
  const [sections, setSections] = useState([]);
  const [fields, setFields] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [evalHistory, setEvalHistory] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState(null);
  const [reviewData, setReviewData] = useState({ decision: "approved", comment: "", internal_note: "" });
  const [expandedDims, setExpandedDims] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const [workflow, setWorkflow] = useState(DEFAULT_WORKFLOW);

  const notify = (msg) => { setNotif(msg); setTimeout(() => setNotif(null), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/form-runs?submission_id=${submissionId}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setSubmission(data.submission);
      setRun(data.run);

      const formRes = await fetch(`/api/platform/forms?id=${data.run.form_id}`);
      const formData = await formRes.json();
      if (formData.success) {
        setSections(formData.sections || []);
        setFields(formData.fields || []);
        const settings = formData.form?.settings || {};
        if (settings.workflow) setWorkflow({ ...DEFAULT_WORKFLOW, ...settings.workflow });
      }

      const tlRes = await fetch(`/api/platform/form-runs?timeline=${submissionId}`);
      const tlData = await tlRes.json();
      if (tlData.success) setTimeline(tlData.timeline || []);

      const evalRes = await fetch(`/api/platform/ai/evaluate-submission?submission_id=${submissionId}`);
      const evalData = await evalRes.json();
      if (evalData.success && evalData.evaluation) {
        setEvaluation(evalData.evaluation);
        setEvalHistory(evalData.history || [evalData.evaluation]);
        const exp = {};
        (evalData.evaluation.dimensions || []).forEach((d, i) => { exp[i] = false; });
        setExpandedDims(exp);
      }
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [submissionId]);

  useEffect(() => { load(); }, [load]);

  const handleReRunAI = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/platform/ai/evaluate-submission", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submission_id: parseInt(submissionId) }) });
      const data = await res.json();
      if (data.success) { notify("AI evaluation complete"); load(); }
      else notify(data.error || "Evaluation failed");
    } catch (_) { notify("AI evaluation failed"); }
    setSaving(false);
  };

  const handleReview = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/platform/form-runs?action=review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submission_id: parseInt(submissionId), ...reviewData }) });
      const data = await res.json();
      if (data.success) { notify("Review submitted"); load(); }
      else notify(data.error || "Failed");
    } catch (_) { notify("Failed"); }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-primary flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" /></div>;
  if (error) return <div className="min-h-screen bg-primary flex items-center justify-center"><div className="text-center"><AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" /><p className="text-[var(--text-primary)]">{error}</p><button onClick={() => router.back()} className="mt-4 text-[var(--brand-orange)] text-sm font-bold">← Go back</button></div></div>;

  const subData = submission?.data || {};
  const statusLabel = workflow.statusLabels[submission?.status] || submission?.status || "Unknown";
  const statusColor = { draft: "text-slate-500", submitted: "text-blue-500", approved: "text-emerald-500", rejected: "text-rose-500", revision_requested: "text-amber-500" }[submission?.status] || "";
  const decisionMeta = workflow.decisions.find(d => d.id === reviewData.decision) || workflow.decisions[0];

  // Group fields by section for form reconstruction
  const sectionsWithFields = sections.map(sec => ({
    ...sec,
    fields: fields.filter(f => String(f.section_id) === String(sec.id)),
  }));

  return (
    <div className="min-h-screen bg-primary">
      {notif && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-xs font-black uppercase">{notif}</div>}

      {/* Top Bar */}
      <div className="sticky top-0 z-[100] flex items-center gap-4 px-6 py-3 border-b border-[var(--border-primary)] bg-secondary">
        <button onClick={() => router.back()} className="text-xs font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><ArrowLeft className="w-3 h-3 inline mr-1" /> Back</button>
        <span className="text-[var(--text-secondary)] opacity-30">|</span>
        <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">{submission?.submitter_name || "Review"}</h2>
        <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", statusColor)}>{statusLabel}</span>
        <div className="flex-1" />
        <button onClick={handleReRunAI} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[9px] font-black uppercase hover:bg-purple-500/20">
          <RefreshCw className={cn("w-3 h-3", saving && "animate-spin")} /> Re-run AI
        </button>
        <a href="/platform/runs" className="text-[9px] font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Runs <ExternalLink className="w-3 h-3 inline" /></a>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">

        {/* ── 1. WHO IS THIS APPLICANT? ── */}
        <div className="card p-6">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-base font-black uppercase text-[var(--text-primary)] flex items-center gap-2"><User className="w-4 h-4 text-[var(--brand-orange)]" /> Applicant Summary</h3>
            {evaluation && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-500/5 border border-purple-500/20">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-sm font-black text-purple-400">{evaluation.overall_score}%</span>
                <span className="text-[9px] text-purple-300">{evaluation.ranking}</span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Summary: first section's first 6 fields */}
            {(() => {
              const firstSec = sectionsWithFields[0];
              const summaryFields = firstSec ? firstSec.fields.slice(0, 6) : fields.slice(0, 6);
              return summaryFields.map(f => {
                const val = subData[f.label] ?? subData[String(f.id)] ?? subData[f.id];
                if (val === undefined || val === null || val === "") return null;
                return (
                  <div key={f.id}>
                    <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] truncate">{f.label}</p>
                    <p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">
                      <FieldValue field={f} value={val} />
                    </p>
                  </div>
                );
              });
            })()}
            <div><p className="text-[9px] font-black uppercase text-[var(--text-secondary)]">Submitted</p><p className="text-sm font-bold text-[var(--text-primary)] mt-0.5">{submission?.submitted_at ? new Date(submission.submitted_at).toLocaleString() : "—"}</p></div>
          </div>
        </div>

        {/* ── 2. WHAT DID THEY SUBMIT? ── */}
        <div className="card p-6">
          <h3 className="text-base font-black uppercase text-[var(--text-primary)] flex items-center gap-2 mb-6 pb-3 border-b border-[var(--border-primary)]"><FileText className="w-4 h-4 text-[var(--brand-orange)]" /> Application</h3>

          <div className="space-y-8">
            {sectionsWithFields.map(sec => {
              if (sec.fields.length === 0) return null;
              const answeredFields = sec.fields.filter(f => {
                const val = subData[f.label] ?? subData[String(f.id)] ?? subData[f.id];
                return val !== undefined && val !== null && val !== "";
              });
              if (answeredFields.length === 0) return null;

              return (
                <div key={sec.id} className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-[var(--text-primary)] pb-1 border-b border-[var(--border-primary)]">{sec.title}</h4>
                  <div className="space-y-3">
                    {answeredFields.map(f => {
                      const val = subData[f.label] ?? subData[String(f.id)] ?? subData[f.id];
                      return (
                        <div key={f.id} className="space-y-1">
                          <p className="text-[10px] font-bold text-[var(--text-secondary)]">{f.label}</p>
                          <div className="text-xs text-[var(--text-primary)] leading-relaxed">
                            <FieldValue field={f} value={val} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Unmatched data (legacy — should be empty with proper mapping) */}
            {(() => {
              const matchedKeys = new Set();
              fields.forEach(f => {
                matchedKeys.add(String(f.id));
                matchedKeys.add(f.label);
              });
              const unmatched = Object.entries(subData).filter(([k]) => k !== "_scores" && k !== "_evaluation" && !matchedKeys.has(k));
              if (unmatched.length === 0) return null;
              return (
                <div className="space-y-2 pt-4 border-t border-dashed border-amber-500/30">
                  <p className="text-[9px] font-black uppercase text-amber-500/70">Other Responses</p>
                  {unmatched.map(([k, v]) => (
                    <div key={k} className="text-[10px]"><span className="text-[var(--text-secondary)]">{k}:</span> <span className="text-[var(--text-primary)]">{String(v).substring(0, 100)}</span></div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* ── 3. WHAT DOES AI THINK? ── */}
        {evaluation?.dimensions && (
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--border-primary)]">
              <h3 className="text-base font-black uppercase text-[var(--text-primary)] flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-400" /> AI Evaluation</h3>
              <span className="text-[10px] text-[var(--text-secondary)]">{evaluation.recommendation?.substring(0, 80)}{(evaluation.recommendation?.length || 0) > 80 ? "..." : ""}</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-[var(--border-primary)]">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-tertiary text-[9px] font-black uppercase text-[var(--text-secondary)]">
                    <th className="px-4 py-2.5 w-10"></th>
                    <th className="px-4 py-2.5">Dimension</th>
                    <th className="px-4 py-2.5 w-16 text-center">AI</th>
                    <th className="px-4 py-2.5 w-16 text-center">You</th>
                    <th className="px-4 py-2.5 w-16 text-center">Final</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-primary)]">
                  {evaluation.dimensions.map((dim, di) => {
                    const isExp = expandedDims[di];
                    return (
                      <><tr key={di} className="hover:bg-tertiary/30 transition-colors cursor-pointer" onClick={() => setExpandedDims(p => ({ ...p, [di]: !p[di] }))}>
                        <td className="px-4 py-3">{isExp ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-[var(--text-primary)]">{dim.name}</span>
                          {dim.confidence != null && <span className="ml-2 text-[9px] text-[var(--text-secondary)]">{(dim.confidence * 100).toFixed(0)}%</span>}
                        </td>
                        <td className="px-4 py-3 text-center"><span className="text-sm font-black text-purple-400">{dim.ai_score}</span></td>
                        <td className="px-4 py-3 text-center">
                          <input type="number" min={0} max={10} step={0.5} value={dim.human_score ?? ""} placeholder={String(dim.ai_score)}
                            onClick={e => e.stopPropagation()}
                            onChange={e => { const val = e.target.value === "" ? null : parseFloat(e.target.value); const dims = [...evaluation.dimensions]; dims[di] = { ...dims[di], human_score: val, final_score: val ?? dim.ai_score }; setEvaluation({ ...evaluation, dimensions: dims }); }}
                            className="w-14 px-2 py-1.5 rounded-lg bg-primary border border-[var(--border-primary)] text-xs font-black text-[var(--text-primary)] outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("text-sm font-black", (dim.final_score ?? dim.ai_score) >= 7 ? "text-emerald-400" : (dim.final_score ?? dim.ai_score) >= 5 ? "text-amber-400" : "text-rose-400")}>{dim.final_score ?? dim.ai_score}</span>
                        </td>
                      </tr>
                      {isExp && (
                        <tr key={`exp-${di}`}>
                          <td></td>
                          <td colSpan={4} className="px-4 py-3 bg-tertiary/20">
                            <div className="space-y-3">
                              {dim.ai_reasoning && <div><p className="text-[8px] font-black uppercase text-[var(--text-secondary)] mb-1">Reasoning</p><p className="text-xs text-[var(--text-primary)] leading-relaxed">{dim.ai_reasoning}</p></div>}
                              {dim.ai_evidence?.length > 0 && <div><p className="text-[8px] font-black uppercase text-[var(--text-secondary)] mb-1">Evidence</p>{dim.ai_evidence.map((e, i) => <p key={i} className="text-[10px] text-[var(--text-secondary)] italic">"{e}"</p>)}</div>}
                              <div className="grid grid-cols-2 gap-3">
                                {dim.ai_strengths?.length > 0 && <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20"><p className="text-[8px] font-black uppercase text-emerald-400 mb-1">Strengths</p>{dim.ai_strengths.map((s, i) => <p key={i} className="text-[10px] text-emerald-300">+ {s}</p>)}</div>}
                                {dim.ai_weaknesses?.length > 0 && <div className="p-2 rounded-lg bg-rose-500/5 border border-rose-500/20"><p className="text-[8px] font-black uppercase text-rose-400 mb-1">Weaknesses</p>{dim.ai_weaknesses.map((w, i) => <p key={i} className="text-[10px] text-rose-300">− {w}</p>)}</div>}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 4. DO I AGREE? WHAT IS MY DECISION? ── */}
        <div className="card p-6">
          <h3 className="text-base font-black uppercase text-[var(--text-primary)] flex items-center gap-2 mb-4 pb-3 border-b border-[var(--border-primary)]"><CheckCircle2 className="w-4 h-4 text-[var(--brand-orange)]" /> Decision</h3>

          <div className="flex gap-3 mb-4 flex-wrap">
            {workflow.decisions.map(d => {
              const Icon = ICON_MAP[d.icon] || CheckCircle2;
              return (
                <button key={d.id} onClick={() => setReviewData({ ...reviewData, decision: d.id })}
                  className={cn("flex-1 min-w-[120px] py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all flex items-center justify-center gap-1.5",
                    reviewData.decision === d.id
                      ? `bg-${d.color}-500/10 border-${d.color}-500 text-${d.color}-400`
                      : "bg-secondary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]"
                  )}>
                  <Icon className="w-3.5 h-3.5" /> {d.label}
                </button>
              );
            })}
          </div>

          <div className="space-y-3 mb-4">
            <textarea value={reviewData.comment} onChange={e => setReviewData({ ...reviewData, comment: e.target.value })} rows={2} placeholder="Comment visible to applicant..." className="w-full rounded-xl px-4 py-3 text-xs font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none" />
            <textarea value={reviewData.internal_note} onChange={e => setReviewData({ ...reviewData, internal_note: e.target.value })} rows={2} placeholder="Internal note (private)..." className="w-full rounded-xl px-4 py-3 text-xs font-bold outline-none bg-amber-500/5 border border-amber-500/20 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none" />
          </div>

          <button onClick={handleReview} disabled={saving} className="w-full py-3 rounded-xl bg-[var(--brand-orange)] text-black text-xs font-black uppercase hover:brightness-110 disabled:opacity-50">
            {saving ? "Saving..." : `Submit Review — ${decisionMeta.label}`}
          </button>
        </div>

        {/* ── 5. WHAT HAPPENED PREVIOUSLY? ── */}
        <div className="card p-6">
          <button onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-[var(--text-primary)] flex items-center gap-2"><History className="w-4 h-4 text-[var(--text-secondary)]" /> History & Timeline</h3>
            {showHistory ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
          </button>
          {showHistory && (
            <div className="mt-4 pt-4 border-t border-[var(--border-primary)] space-y-4">
              {evaluation && (
                <div className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/20 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-purple-400">Latest AI Evaluation</p>
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Score: {evaluation.overall_score}% · {evaluation.ranking} · {evaluation.dimensions?.length || 0} dimensions</p>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[8px] font-black uppercase">{new Date(evaluation.evaluated_at).toLocaleDateString()}</span>
                </div>
              )}
              <div className="space-y-2">
                {timeline.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className={cn("w-2 h-2 mt-1 rounded-full shrink-0",
                      entry.action === "submitted" ? "bg-blue-500" : entry.action === "approved" ? "bg-emerald-500" :
                      entry.action === "rejected" ? "bg-rose-500" : entry.action === "ai_evaluated" ? "bg-purple-500" : "bg-[var(--brand-orange)]"
                    )} />
                    <div>
                      <p className="text-[10px] font-black uppercase text-[var(--text-primary)]">{entry.action}</p>
                      <p className="text-[9px] text-[var(--text-secondary)]">{new Date(entry.created_at).toLocaleString()}{entry.actor_name ? ` · ${entry.actor_name}` : ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
