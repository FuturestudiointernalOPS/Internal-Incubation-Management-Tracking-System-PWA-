"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, User, FileText, CheckCircle2, XCircle,
  RotateCcw, Clock, AlertTriangle, Sparkles, ChevronDown,
  ChevronUp, RefreshCw, ExternalLink, History, Mail, Phone, Globe, Star
} from "lucide-react";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const DEFAULT_WORKFLOW = {
  decisions: [
    { id: "approved", label: "Approve", color: "emerald" },
    { id: "rejected", label: "Reject", color: "rose" },
    { id: "revision_requested", label: "Request Revision", color: "amber" },
  ],
  statusLabels: { draft: "Draft", submitted: "Submitted", approved: "Approved", rejected: "Rejected", revision_requested: "Revision" },
};

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
  const [collapsedSections, setCollapsedSections] = useState({});

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
      } else {
        // No evaluation yet — auto-trigger AI evaluation if form is configured for it
        try {
          const triggerRes = await fetch("/api/platform/ai/evaluate-submission", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ submission_id: parseInt(submissionId) }),
          });
          const triggerData = await triggerRes.json();
          if (triggerData.success && triggerData.evaluation) {
            setEvaluation(triggerData.evaluation);
            setEvalHistory([triggerData.evaluation]);
          }
        } catch (_) {}
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
      // Build dimension overrides from evaluation state
      const dimensionOverrides = evaluation?.dimensions
        ?.filter(d => d.human_score != null)
        .map(d => ({ name: d.name, human_score: d.human_score, human_comment: d.human_comment || "", final_score: d.final_score })) || [];

      const res = await fetch("/api/platform/form-runs?action=review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: parseInt(submissionId),
          ...reviewData,
          dimension_overrides: dimensionOverrides,
        }),
      });
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

  // Get field value
  const getVal = (f) => subData[f.label] ?? subData[String(f.id)] ?? subData[f.id];

  // Format display value
  const fmt = (val, field) => {
    if (val === undefined || val === null || val === "") return null;
    const s = String(val);
    if (field?.field_type === "phone" && s.startsWith("{") && s.includes('"code"')) {
      try { const p = JSON.parse(s); if (p.code && p.number) return `${p.code} ${p.number}`; } catch (_) {}
    }
    return s;
  };

  const sectionsWithFields = sections.map(sec => ({
    ...sec,
    fields: fields.filter(f => String(f.section_id) === String(sec.id)),
  }));

  return (
    <div className="min-h-screen bg-primary">
      {notif && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-xs font-black uppercase shadow-lg">{notif}</div>}

      {/* Top Bar */}
      <div className="sticky top-0 z-[100] flex items-center gap-4 px-6 py-3 border-b border-[var(--border-primary)] bg-secondary">
        <button onClick={() => router.back()} className="text-xs font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"><ArrowLeft className="w-3 h-3 inline mr-1" /> Back</button>
        <span className="text-[var(--text-secondary)] opacity-20">|</span>
        <h2 className="text-sm font-black uppercase text-[var(--text-primary)] truncate">{submission?.submitter_name || "Review"}</h2>
        <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", statusColor)}>{statusLabel}</span>
        <div className="flex-1" />
        {evaluation && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-xs font-black text-purple-400">{evaluation.overall_score}%</span>
          </div>
        )}
        <button onClick={handleReRunAI} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] font-black uppercase hover:bg-purple-500/20 transition-colors">
          <RefreshCw className={cn("w-3 h-3", saving && "animate-spin")} /> Re-run AI
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-6 pb-24 space-y-6">

        {/* ── APPLICANT ── */}
        <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-primary)] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-orange)]/10 flex items-center justify-center">
              <User className="w-5 h-5 text-[var(--brand-orange)]" />
            </div>
            <div>
              <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">
                {(() => {
                  const firstSec = sectionsWithFields[0];
                  // Find personal name field: contains "name" but not "startup"/"business"/"company"/"project"/"team"
                  const nameField = firstSec?.fields.find(f => {
                    const l = (f.label || "").toLowerCase();
                    return l.includes("name") && !l.includes("startup") && !l.includes("business") && !l.includes("company") && !l.includes("project") && !l.includes("team") && !l.includes("brand");
                  });
                  const nameVal = nameField ? fmt(getVal(nameField)) : submission?.submitter_name;
                  return nameVal || "Applicant";
                })()}
              </h2>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {submission?.submitted_at ? `Submitted ${new Date(submission.submitted_at).toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}` : "Submission"}
                {run?.name ? ` · ${run.name}` : ""}
              </p>
            </div>
          </div>
          <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Quick stats from first section fields */}
            {(() => {
              const firstSec = sectionsWithFields[0];
              const items = firstSec ? firstSec.fields.slice(0, 4) : fields.slice(0, 4);
              return items.map(f => {
                const val = fmt(getVal(f));
                if (!val) return null;
                return (
                  <div key={f.id}>
                    <p className="text-[9px] font-bold uppercase text-[var(--text-secondary)] tracking-wider">{f.label}</p>
                    <p className="text-xs font-bold text-[var(--text-primary)] mt-1 truncate">{val}</p>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        {/* ── APPLICATION ── */}
        <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-primary)] flex items-center gap-3">
            <FileText className="w-5 h-5 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-black uppercase text-[var(--text-primary)] flex-1">Application</h2>
            {sectionsWithFields.filter(s => s.fields.some(f => fmt(getVal(f)))).length > 2 && (
              <button
                onClick={() => {
                  const allIds = {};
                  const hasCollapsed = Object.values(collapsedSections).some(v => v);
                  sectionsWithFields.forEach(s => { allIds[s.id] = !hasCollapsed; });
                  setCollapsedSections(hasCollapsed ? {} : allIds);
                }}
                className="text-[9px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] uppercase"
              >
                {Object.values(collapsedSections).some(v => v) ? "Expand All" : "Collapse All"}
              </button>
            )}
          </div>
          <div className="divide-y divide-[var(--border-primary)]">
            {sectionsWithFields.map(sec => {
              const answered = sec.fields.filter(f => fmt(getVal(f)));
              if (answered.length === 0) return null;
              return (
                <div key={sec.id} className="px-6 py-4">
                  <button
                    onClick={() => setCollapsedSections(p => ({ ...p, [sec.id]: !p[sec.id] }))}
                    className="flex items-center gap-2 w-full text-left"
                  >
                    <h3 className="text-[10px] font-black uppercase text-[var(--brand-orange)] tracking-wider flex-1">{sec.title}</h3>
                    <span className="text-[9px] text-[var(--text-secondary)]">{answered.length} answered</span>
                    {collapsedSections[sec.id] ? <ChevronDown className="w-3.5 h-3.5 text-[var(--text-secondary)]" /> : <ChevronUp className="w-3.5 h-3.5 text-[var(--text-secondary)]" />}
                  </button>
                  {!collapsedSections[sec.id] && (
                    <div className="mt-3 space-y-3">
                      {answered.map(f => {
                        const val = fmt(getVal(f));
                        return (
                          <div key={f.id}>
                            <p className="text-[10px] font-bold text-[var(--text-secondary)] mb-1">{f.label}</p>
                            <p className="text-xs text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{val}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── AI EVALUATION ── */}
        {evaluation?.dimensions && (
          <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[var(--border-primary)] flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">AI Evaluation</h2>
              {evaluation.recommendation && (
                <span className="ml-auto text-[10px] text-[var(--text-secondary)] italic">
                  {evaluation.recommendation.substring(0, 60)}{evaluation.recommendation.length > 60 ? "…" : ""}
                </span>
              )}
            </div>
            <div className="divide-y divide-[var(--border-primary)]">
              {evaluation.dimensions.map((dim, di) => {
                const isExp = expandedDims[di];
                return (
                  <div key={di}>
                    <div
                      onClick={() => setExpandedDims(p => ({ ...p, [di]: !p[di] }))}
                      className="px-6 py-3 flex items-center gap-4 cursor-pointer hover:bg-tertiary/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[var(--text-primary)]">{dim.name}</span>
                          {dim.confidence != null && (
                            <span className="text-[9px] text-[var(--text-secondary)]">{(dim.confidence * 100).toFixed(0)}% confident</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-center w-12">
                          <p className="text-[8px] font-black uppercase text-[var(--text-secondary)]">AI</p>
                          <p className="text-sm font-black text-purple-400">{dim.score ?? dim.ai_score ?? "—"}</p>
                        </div>
                        <div className="text-center w-14">
                          <p className="text-[8px] font-black uppercase text-[var(--text-secondary)]">You</p>
                          {dim.human_score != null ? (
                            <p className="text-sm font-black text-[var(--brand-orange)]">{dim.human_score}</p>
                          ) : (
                            <input
                              type="number" min={0} max={10} step={0.5}
                              value=""
                              placeholder={String(dim.score ?? "—")}
                              onClick={e => e.stopPropagation()}
                              onChange={e => {
                                const val = e.target.value === "" ? null : parseFloat(e.target.value);
                                const dims = [...evaluation.dimensions];
                                dims[di] = { ...dims[di], human_score: val, human_comment: dims[di].human_comment || "", final_score: val ?? dim.score };
                                setEvaluation({ ...evaluation, dimensions: dims });
                              }}
                              className="w-12 px-1.5 py-1 rounded-lg bg-primary border border-[var(--border-primary)] text-xs font-black text-[var(--text-primary)] outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          )}
                        </div>
                        <div className="text-center w-12">
                          <p className="text-[8px] font-black uppercase text-[var(--text-secondary)]">Final</p>
                          <p className={cn("text-sm font-black", (dim.final_score ?? dim.score) >= 7 ? "text-emerald-400" : (dim.final_score ?? dim.score) >= 5 ? "text-amber-400" : "text-rose-400")}>
                            {dim.final_score ?? dim.score ?? "—"}
                          </p>
                        </div>
                        {isExp ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                      </div>
                    </div>
                    {isExp && (
                      <div className="px-6 py-4 bg-tertiary/30 border-t border-[var(--border-primary)]">
                        <div className="space-y-3 max-w-2xl">
                          {dim.ai_reasoning && (
                            <div>
                              <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-1">Reasoning</p>
                              <p className="text-[11px] text-[var(--text-primary)] leading-relaxed">{dim.ai_reasoning}</p>
                            </div>
                          )}
                          {dim.ai_evidence?.length > 0 && (
                            <div>
                              <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-1">Evidence</p>
                              <div className="space-y-1">
                                {dim.ai_evidence.map((e, i) => (
                                  <p key={i} className="text-[11px] text-[var(--text-secondary)] italic pl-3 border-l-2 border-[var(--border-primary)]">"{e}"</p>
                                ))}
                              </div>
                            </div>
                          )}
                          {(dim.ai_strengths?.length > 0 || dim.ai_weaknesses?.length > 0) && (
                            <div className="grid grid-cols-2 gap-3">
                              {dim.ai_strengths?.length > 0 && (
                                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                  <p className="text-[9px] font-black uppercase text-emerald-400 mb-1">Strengths</p>
                                  {dim.ai_strengths.map((s, i) => <p key={i} className="text-[10px] text-emerald-300">+ {s}</p>)}
                                </div>
                              )}
                              {dim.ai_weaknesses?.length > 0 && (
                                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                                  <p className="text-[9px] font-black uppercase text-rose-400 mb-1">Weaknesses</p>
                                  {dim.ai_weaknesses.map((w, i) => <p key={i} className="text-[10px] text-rose-300">− {w}</p>)}
                                </div>
                              )}
                            </div>
                          )}
                          {/* Human override justification */}
                          {dim.human_score != null && (
                            <div className="p-3 rounded-xl bg-[var(--brand-orange)]/5 border border-[var(--brand-orange)]/20">
                              <p className="text-[9px] font-black uppercase text-[var(--brand-orange)] mb-1">Human Override</p>
                              <textarea
                                value={dim.human_comment || ""}
                                onChange={e => {
                                  const dims = [...evaluation.dimensions];
                                  dims[di] = { ...dims[di], human_comment: e.target.value };
                                  setEvaluation({ ...evaluation, dimensions: dims });
                                }}
                                onClick={e => e.stopPropagation()}
                                rows={2}
                                placeholder="Why did you override the AI score?"
                                className="w-full rounded-lg px-3 py-2 text-[10px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── DECISION ── */}
        <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--border-primary)] flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--brand-orange)]" />
            <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">Decision</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="flex gap-2">
              {workflow.decisions.map(d => (
                <button key={d.id} onClick={() => setReviewData({ ...reviewData, decision: d.id })}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase border transition-all text-center",
                    reviewData.decision === d.id
                      ? `bg-${d.color}-500/10 border-${d.color}-500 text-${d.color}-400`
                      : "bg-tertiary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]"
                  )}>
                  {d.label}
                </button>
              ))}
            </div>
            <textarea value={reviewData.comment} onChange={e => setReviewData({ ...reviewData, comment: e.target.value })} rows={2}
              placeholder="Comment visible to applicant..."
              className="w-full rounded-xl px-4 py-3 text-xs font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none" />
            <textarea value={reviewData.internal_note} onChange={e => setReviewData({ ...reviewData, internal_note: e.target.value })} rows={2}
              placeholder="Internal note (private)..."
              className="w-full rounded-xl px-4 py-3 text-xs font-bold outline-none bg-amber-500/5 border border-amber-500/20 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none" />
            <button onClick={handleReview} disabled={saving}
              className="w-full py-3 rounded-xl bg-[var(--brand-orange)] text-black text-xs font-black uppercase hover:brightness-110 disabled:opacity-50 transition-all">
              {saving ? "Saving..." : `Submit Review — ${decisionMeta.label}`}
            </button>
          </div>
        </div>

        {/* ── HISTORY ── */}
        <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
          <button onClick={() => setShowHistory(!showHistory)} className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-tertiary/30 transition-colors">
            <History className="w-5 h-5 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-black uppercase text-[var(--text-primary)] flex-1">History</h2>
            {showHistory ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
          </button>
          {showHistory && (
            <div className="px-6 py-4 border-t border-[var(--border-primary)] space-y-3">
              {timeline.length === 0 ? (
                <p className="text-[10px] text-[var(--text-secondary)] text-center py-4">No activity recorded yet</p>
              ) : (
                timeline.map((entry, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className={cn("w-2 h-2 mt-1.5 rounded-full shrink-0",
                      entry.action === "submitted" ? "bg-blue-500" :
                      entry.action === "approved" ? "bg-emerald-500" :
                      entry.action === "rejected" ? "bg-rose-500" :
                      entry.action === "ai_evaluated" ? "bg-purple-500" : "bg-[var(--brand-orange)]"
                    )} />
                    <div>
                      <p className="text-[10px] font-black uppercase text-[var(--text-primary)]">{entry.action}</p>
                      <p className="text-[9px] text-[var(--text-secondary)]">{new Date(entry.created_at).toLocaleString()}{entry.actor_name ? ` · ${entry.actor_name}` : ""}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
