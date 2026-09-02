"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft, Loader2, User, FileText, CheckCircle2,
  AlertTriangle, Sparkles, ChevronDown,
  ChevronUp, RefreshCw, History, Lock
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { formatLocaleDate } from "@/lib/constants";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

const cn = (...classes) => classes.filter(Boolean).join(" ");

const DEFAULT_WORKFLOW = {
  decisions: [
    { id: "approved", label: "Approve", color: "emerald" },
    { id: "rejected", label: "Reject", color: "rose" },
    { id: "revision_requested", label: "Request Revision", color: "amber" },
  ],
  statusLabels: { draft: "Draft", submitted: "Submitted", approved: "Approved", rejected: "Rejected", revision_requested: "Revision" },
};

const DECISION_LABEL_KEYS = {
  approved: "platformMisc.runReview.decisionApprove",
  rejected: "platformMisc.runReview.decisionReject",
  revision_requested: "platformMisc.runReview.decisionRevision",
};

const STATUS_LABEL_KEYS = {
  draft: "platformMisc.runReview.statusDraft",
  submitted: "platformMisc.runReview.statusSubmitted",
  approved: "platformMisc.runReview.statusApproved",
  rejected: "platformMisc.runReview.statusRejected",
  revision_requested: "platformMisc.runReview.statusRevision",
};

export default function ReviewPage() {
  const params = useParams();
  const goBack = useSafeBack("/admin/platform/runs");
  const submissionId = params.submissionId;
  const { t, lang } = useI18n();

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

  const load = useCallback(async (bypassCache = false) => {
    setLoading(true);
    const mainUrl = `/api/platform/form-runs?submission_id=${submissionId}`;
    const timelineUrl = `/api/platform/form-runs?timeline=${submissionId}`;
    const evalUrl = `/api/platform/ai/evaluate-submission?submission_id=${submissionId}`;
    const applyMain = (data) => {
      setSubmission(data.submission);
      setRun(data.run);
    };
    const applyForm = (formData) => {
      if (formData.success) {
        setSections(formData.sections || []);
        setFields(formData.fields || []);
        const settings = formData.form?.settings || {};
        if (settings.workflow) setWorkflow({ ...DEFAULT_WORKFLOW, ...settings.workflow });
      }
    };
    const applyTimeline = (tlData) => {
      if (tlData.success) setTimeline(tlData.timeline || []);
    };
    const applyEval = (evalData) => {
      if (evalData.success && evalData.evaluation) {
        setEvaluation(evalData.evaluation);
        setEvalHistory(evalData.history || [evalData.evaluation]);
      }
    };
    let painted = false;
    try {
      // Cache-first paint: revisiting the same submission renders instantly
      // from fresh snapshots when every GET in the chain is cached; review
      // mutations pass bypassCache=true so the page reflects the last action.
      if (!bypassCache) {
        const cachedMain = cacheGet(mainUrl);
        const cachedForm =
          cachedMain !== null && cachedMain.success
            ? cacheGet(`/api/platform/forms?id=${cachedMain.run?.form_id}`)
            : null;
        const cachedTimeline = cacheGet(timelineUrl);
        const cachedEval = cacheGet(evalUrl);
        if (
          cachedMain !== null && cachedMain.success &&
          cachedForm !== null && cachedForm.success &&
          cachedTimeline !== null && cachedTimeline.success &&
          cachedEval !== null && cachedEval.success && cachedEval.evaluation
        ) {
          applyMain(cachedMain);
          applyForm(cachedForm);
          applyTimeline(cachedTimeline);
          applyEval(cachedEval);
          setLoading(false);
          painted = true;
        }
      }
      const res = await fetch(mainUrl);
      if (!res.ok) throw new Error(t("platformMisc.runReview.loadFailed"));
      const data = await res.json();
      if (!data.success) throw new Error(t(data.error || "") || data.error);
      cacheSet(mainUrl, data);
      applyMain(data);

      const formUrl = `/api/platform/forms?id=${data.run.form_id}`;
      const formRes = await fetch(formUrl);
      const formData = await formRes.json();
      if (formData.success) {
        cacheSet(formUrl, formData);
        applyForm(formData);
      }

      const tlRes = await fetch(timelineUrl);
      const tlData = await tlRes.json();
      if (tlData.success) {
        cacheSet(timelineUrl, tlData);
        applyTimeline(tlData);
      }

      const evalRes = await fetch(evalUrl);
      const evalData = await evalRes.json();
      if (evalData.success && evalData.evaluation) {
        cacheSet(evalUrl, evalData);
        applyEval(evalData);
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
    } catch (e) { if (!painted) setError(t(e.message || "") || e.message); }
    setLoading(false);
  }, [submissionId]);

  useEffect(() => { load(); }, [load]);

  // Lock all editing once a review decision has been submitted (email sent to applicant)
  const isReviewLocked = ["approved", "rejected", "revision_requested"].includes(submission?.status);

  // Live-recalculate overall % whenever human overrides any dimension score
  const computedOverall = useMemo(() => {
    if (!evaluation?.dimensions?.length) return evaluation?.overall_score ?? null;
    const dims = evaluation.dimensions;
    const totalWeight = dims.reduce((s, d) => s + (d.weight ?? 1), 0);
    const weighted = dims.reduce((s, d) => {
      const score = d.final_score ?? d.score ?? 0;
      return s + (score * (d.weight ?? 1));
    }, 0);
    return Math.round((weighted / totalWeight) * 10);
  }, [evaluation]);

  // Helper: update a single dimension's human score
  const updateDimScore = (di, val) => {
    if (isReviewLocked) return;
    setEvaluation(prev => {
      const dims = [...prev.dimensions];
      dims[di] = { ...dims[di], human_score: val, human_comment: dims[di].human_comment || "", final_score: val ?? dims[di].score };
      return { ...prev, dimensions: dims };
    });
  };

  // Helper: update a single dimension's human comment
  const updateDimComment = (di, val) => {
    if (isReviewLocked) return;
    setEvaluation(prev => {
      const dims = [...prev.dimensions];
      dims[di] = { ...dims[di], human_comment: val };
      return { ...prev, dimensions: dims };
    });
  };

  const handleReRunAI = async () => {
    if (isReviewLocked) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platform/ai/evaluate-submission", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submission_id: parseInt(submissionId) }) });
      const data = await res.json();
      if (data.success) { notify(t("platformMisc.runReview.aiEvalComplete")); load(true); }
      else notify(t((data.error || t("platformMisc.runReview.evalFailed")) || "") || (data.error || t("platformMisc.runReview.evalFailed")));
    } catch (_) { notify(t("platformMisc.runReview.aiEvalFailed")); }
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
      if (data.success) { notify(t("platformMisc.runReview.reviewSubmitted")); load(true); }
      else notify(t((data.error || t("platformMisc.runReview.failed")) || "") || (data.error || t("platformMisc.runReview.failed")));
    } catch (_) { notify(t("platformMisc.runReview.failed")); }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-primary flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" /></div>;
  if (error) return <div className="min-h-screen bg-primary flex items-center justify-center"><div className="text-center"><AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" /><p className="text-[var(--text-primary)]">{error}</p><button onClick={goBack} className="mt-4 text-[var(--brand-orange)] text-sm font-bold">← {t("platformMisc.runReview.goBack")}</button></div></div>;

  const subData = submission?.data || {};
  const statusLabel = (t(STATUS_LABEL_KEYS[submission?.status] || "") || workflow.statusLabels[submission?.status]) || submission?.status || t("platformMisc.runReview.unknown");
  const statusColor = { draft: "text-slate-500", submitted: "text-blue-500", approved: "text-emerald-500", rejected: "text-rose-500", revision_requested: "text-amber-500" }[submission?.status] || "";
  const decisionMeta = workflow.decisions.find(d => d.id === reviewData.decision) || workflow.decisions[0];
  const decisionLabel = t(DECISION_LABEL_KEYS[decisionMeta.id] || "") || decisionMeta.label;

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
        <button onClick={goBack} className="text-xs font-black uppercase text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"><ArrowLeft className="w-3 h-3 inline mr-1" /> {t("platformMisc.runReview.back")}</button>
        <span className="text-[var(--text-secondary)] opacity-20">|</span>
        <h2 className="text-sm font-black uppercase text-[var(--text-primary)] truncate">{submission?.submitter_name || t("platformMisc.runReview.reviewTitle")}</h2>
        <span className={cn("px-2 py-0.5 rounded text-[8px] font-black uppercase", statusColor)}>{statusLabel}</span>
        {isReviewLocked && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 text-[8px] font-black uppercase border border-slate-500/20">
            <Lock className="w-2.5 h-2.5" /> {t("platformMisc.runReview.locked")}
          </span>
        )}
        <div className="flex-1" />
        {evaluation && (
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-xs font-black text-purple-400">{computedOverall ?? evaluation.overall_score}%</span>
            {computedOverall !== null && computedOverall !== evaluation.overall_score && (
              <span className="text-[8px] text-slate-400 font-bold">{t("platformMisc.runReview.adjusted")}</span>
            )}
          </div>
        )}
        <button onClick={handleReRunAI} disabled={saving || isReviewLocked} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[9px] font-black uppercase hover:bg-purple-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <RefreshCw className={cn("w-3 h-3", saving && "animate-spin")} /> {t("platformMisc.runReview.rerunAi")}
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
                  return nameVal || t("platformMisc.runReview.applicant");
                })()}
              </h2>
              <p className="text-[10px] text-[var(--text-secondary)]">
                {submission?.submitted_at ? t("platformMisc.runReview.submittedOn", { date: formatLocaleDate(submission.submitted_at, { weekday: "short", month: "short", day: "numeric", year: "numeric" }, lang) }) : t("platformMisc.runReview.submissionLabel")}
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
            <h2 className="text-sm font-black uppercase text-[var(--text-primary)] flex-1">{t("platformMisc.runReview.application")}</h2>
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
                {Object.values(collapsedSections).some(v => v) ? t("platformMisc.runReview.expandAll") : t("platformMisc.runReview.collapseAll")}
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
                    <span className="text-[9px] text-[var(--text-secondary)]">{t("platformMisc.runReview.answered", { count: answered.length })}</span>
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
              <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runReview.aiEvaluation")}</h2>
              <div className="ml-auto flex items-center gap-3">
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runReview.overall")}</p>
                  <div className="flex items-baseline gap-1.5">
                    <p className={cn("text-base font-black", (computedOverall ?? evaluation.overall_score) >= 80 ? "text-emerald-400" : (computedOverall ?? evaluation.overall_score) >= 60 ? "text-amber-400" : "text-rose-400")}>{computedOverall ?? evaluation.overall_score}%</p>
                    {computedOverall !== null && computedOverall !== evaluation.overall_score && (
                      <span className="text-[8px] text-slate-400 font-bold">{t("platformMisc.runReview.adjusted")}</span>
                    )}
                  </div>
                </div>
                {evaluation.ranking && (
                  <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] font-black text-purple-400">{evaluation.ranking}</span>
                )}
              </div>
            </div>

            {evaluation.recommendation && (
              <div className="px-6 py-3 bg-purple-500/5 border-b border-purple-500/10">
                <p className="text-[9px] font-black uppercase text-purple-400 mb-1">{t("platformMisc.runReview.aiRecommendation")}</p>
                <p className="text-[11px] text-[var(--text-primary)] leading-relaxed">{evaluation.recommendation}</p>
              </div>
            )}

            <div className="divide-y divide-[var(--border-primary)]">
              {evaluation.dimensions.map((dim, di) => {
                const isExp = expandedDims[di];
                const aiScore = dim.score ?? dim.ai_score;
                const finalScore = dim.final_score ?? aiScore;
                const scoreLabel = finalScore >= 9 ? t("platformMisc.runReview.scoreExcellent") : finalScore >= 7 ? t("platformMisc.runReview.scoreStrong") : finalScore >= 5 ? t("platformMisc.runReview.scoreAdequate") : finalScore >= 3 ? t("platformMisc.runReview.scoreWeak") : t("platformMisc.runReview.scorePoor");
                const scoreColor = finalScore >= 7 ? "text-emerald-400" : finalScore >= 5 ? "text-amber-400" : "text-rose-400";
                const scoreBg = finalScore >= 7 ? "bg-emerald-500/10 border-emerald-500/20" : finalScore >= 5 ? "bg-amber-500/10 border-amber-500/20" : "bg-rose-500/10 border-rose-500/20";

                // Match evidence quotes to actual form fields
                const relevantFields = fields.filter(f => {
                  const val = subData[f.label] ?? subData[String(f.id)] ?? subData[f.id];
                  if (!val) return false;
                  const valStr = String(val).toLowerCase();
                  // Check if any evidence quote references this field's label or content
                  return (dim.evidence || []).some(ev =>
                    ev.toLowerCase().includes(f.label.toLowerCase().substring(0, 15)) ||
                    valStr.slice(0, 60).split(' ').filter(w => w.length > 5).some(word => ev.toLowerCase().includes(word.toLowerCase()))
                  );
                }).slice(0, 4);

                // If no matched fields, show top 3 long-form answers as fallback
                const qaFields = relevantFields.length > 0 ? relevantFields : fields.filter(f => {
                  const val = subData[f.label] ?? subData[String(f.id)] ?? subData[f.id];
                  return val && String(val).length > 30 && (f.field_type === "textarea" || f.field_type === "richtext" || f.field_type === "text");
                }).slice(0, 3);

                return (
                  <div key={di}>
                    {/* Row header — click to expand */}
                    <div
                      onClick={() => setExpandedDims(p => ({ ...p, [di]: !p[di] }))}
                      className="px-6 py-4 flex items-center gap-4 cursor-pointer hover:bg-tertiary/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-[var(--text-primary)]">{dim.name}</span>
                          {dim.confidence != null && (
                            <span className="text-[9px] text-[var(--text-secondary)]">{t("platformMisc.runReview.confident", { pct: (dim.confidence * 100).toFixed(0) })}</span>
                          )}
                        </div>
                        {!isExp && dim.reasoning && (
                          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 truncate max-w-xs">{dim.reasoning}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-center">
                          <p className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runReview.aiShort")}</p>
                          <p className="text-sm font-black text-purple-400">{aiScore ?? "—"}</p>
                        </div>
                      <div className="text-center">
                          <p className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runReview.you")}</p>
                          <input
                            type="number" min={0} max={10} step={0.5}
                            value={dim.human_score ?? ""}
                            placeholder={String(aiScore ?? "—")}
                            disabled={isReviewLocked}
                            onClick={e => e.stopPropagation()}
                            onChange={e => updateDimScore(di, e.target.value === "" ? null : parseFloat(e.target.value))}
                            className={cn(
                              "w-12 px-1.5 py-1 rounded-lg border text-xs font-black outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                              dim.human_score != null ? "bg-[var(--brand-orange)]/10 border-[var(--brand-orange)]/40 text-[var(--brand-orange)]" : "bg-primary border-[var(--border-primary)] text-[var(--text-primary)]",
                              isReviewLocked && "opacity-50 cursor-not-allowed"
                            )}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-[8px] font-black uppercase text-[var(--text-secondary)]">{t("platformMisc.runReview.final")}</p>
                          <p className={cn("text-sm font-black", scoreColor)}>{finalScore ?? "—"}</p>
                        </div>
                        {isExp ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
                      </div>
                    </div>

                    {/* Expanded panel */}
                    {isExp && (
                      <div className="bg-tertiary/20 border-t border-[var(--border-primary)] px-6 py-5 space-y-5">

                        {/* Score verdict */}
                        <div className={cn("flex items-center gap-4 p-4 rounded-xl border", scoreBg)}>
                          <div>
                            <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-0.5">{t("platformMisc.runReview.scoreVerdict")}</p>
                            <div className="flex items-baseline gap-2">
                              <span className={cn("text-3xl font-black", scoreColor)}>{finalScore}</span>
                              <span className="text-sm text-[var(--text-secondary)] font-bold">/ 10</span>
                              <span className={cn("text-xs font-black uppercase ml-1", scoreColor)}>— {scoreLabel}</span>
                            </div>
                          </div>
                          {dim.confidence != null && (
                            <div className="ml-auto text-right">
                              <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] mb-0.5">{t("platformMisc.runReview.confidence")}</p>
                              <p className="text-sm font-black text-[var(--text-primary)]">{(dim.confidence * 100).toFixed(0)}%</p>
                            </div>
                          )}
                        </div>

                        {/* AI Reasoning */}
                        {dim.reasoning && (
                          <div>
                            <p className="text-[9px] font-black uppercase text-purple-400 tracking-wider mb-2">{t("platformMisc.runReview.whyThisScore")}</p>
                            <p className="text-[12px] text-[var(--text-primary)] leading-relaxed">{dim.reasoning}</p>
                          </div>
                        )}

                        {/* Strengths & Weaknesses */}
                        {(dim.strengths?.length > 0 || dim.weaknesses?.length > 0) && (
                          <div className="grid grid-cols-2 gap-3">
                            {dim.strengths?.length > 0 && (
                              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                                <p className="text-[9px] font-black uppercase text-emerald-400 mb-2">{t("platformMisc.runReview.strengths")}</p>
                                <div className="space-y-1.5">
                                  {dim.strengths.map((s, i) => (
                                    <p key={i} className="text-[11px] text-emerald-300 leading-snug">+ {s}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                            {dim.weaknesses?.length > 0 && (
                              <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
                                <p className="text-[9px] font-black uppercase text-rose-400 mb-2">{t("platformMisc.runReview.areasToImprove")}</p>
                                <div className="space-y-1.5">
                                  {dim.weaknesses.map((w, i) => (
                                    <p key={i} className="text-[11px] text-rose-300 leading-snug">− {w}</p>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Evidence quotes from AI */}
                        {dim.evidence?.length > 0 && (
                          <div>
                            <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider mb-2">{t("platformMisc.runReview.evidenceFromApplicant")}</p>
                            <div className="space-y-2">
                              {dim.evidence.map((ev, i) => (
                                <p key={i} className="text-[11px] text-[var(--text-secondary)] italic pl-4 border-l-2 border-purple-500/30 leading-relaxed">"{ev}"</p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Relevant Q&A from the form */}
                        {qaFields.length > 0 && (
                          <div>
                            <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider mb-2">{t("platformMisc.runReview.relevantQA")}</p>
                            <div className="space-y-3">
                              {qaFields.map(f => {
                                const val = subData[f.label] ?? subData[String(f.id)] ?? subData[f.id];
                                if (!val) return null;
                                return (
                                  <div key={f.id} className="rounded-xl bg-secondary border border-[var(--border-primary)] p-4">
                                    <p className="text-[9px] font-black uppercase text-[var(--text-secondary)] tracking-wider mb-2">{f.label}</p>
                                    <p className="text-[12px] text-[var(--text-primary)] leading-relaxed whitespace-pre-wrap">{String(val)}</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Human override */}
                        <div className="pt-2 border-t border-[var(--border-primary)]">
                          {isReviewLocked ? (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-500/5 border border-slate-500/20">
                              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <p className="text-[10px] text-slate-400 font-bold">{t("platformMisc.runReview.scoreLockedNotice")}</p>
                            </div>
                          ) : (
                            <>
                              <p className="text-[9px] font-black uppercase text-[var(--brand-orange)] tracking-wider mb-2">{t("platformMisc.runReview.overrideScore")}</p>
                              <div className="flex items-start gap-3">
                                <input
                                  type="number" min={0} max={10} step={0.5}
                                  value={dim.human_score ?? ""}
                                  placeholder={String(aiScore ?? "—")}
                                  onClick={e => e.stopPropagation()}
                                  onChange={e => updateDimScore(di, e.target.value === "" ? null : parseFloat(e.target.value))}
                                  className="w-20 px-3 py-2 rounded-xl bg-primary border border-[var(--border-primary)] text-sm font-black text-[var(--text-primary)] outline-none text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shrink-0"
                                />
                                <textarea
                                  value={dim.human_comment || ""}
                                  onChange={e => updateDimComment(di, e.target.value)}
                                  onClick={e => e.stopPropagation()}
                                  rows={2}
                                  placeholder={t("platformMisc.runReview.overridePlaceholder")}
                                  className="flex-1 rounded-xl px-3 py-2 text-[11px] font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none"
                                />
                              </div>
                            </>
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
            <h2 className="text-sm font-black uppercase text-[var(--text-primary)]">{t("platformMisc.runReview.decisionTitle")}</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            {isReviewLocked ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-500/5 border border-slate-500/20">
                <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                <div>
                  <p className="text-xs font-black text-[var(--text-primary)] uppercase">{t("platformMisc.runReview.decisionLocked")}</p>
                  <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {t("platformMisc.runReview.decisionLockedPart1")}{" "}
                    <strong className={statusColor}>{statusLabel}</strong>{" "}
                    {t("platformMisc.runReview.decisionLockedPart2")}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  {workflow.decisions.map(d => (
                    <button key={d.id} onClick={() => setReviewData({ ...reviewData, decision: d.id })}
                      className={cn(
                        "flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase border transition-all text-center",
                        reviewData.decision === d.id
                          ? `bg-${d.color}-500/10 border-${d.color}-500 text-${d.color}-400`
                          : "bg-tertiary border-[var(--border-primary)] text-[var(--text-secondary)] hover:border-[var(--text-primary)]"
                      )}>
                      {t(DECISION_LABEL_KEYS[d.id] || "") || d.label}
                    </button>
                  ))}
                </div>
                <textarea value={reviewData.comment} onChange={e => setReviewData({ ...reviewData, comment: e.target.value })} rows={2}
                  placeholder={t("platformMisc.runReview.commentPlaceholder")}
                  className="w-full rounded-xl px-4 py-3 text-xs font-bold outline-none bg-primary border border-[var(--border-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none" />
                <textarea value={reviewData.internal_note} onChange={e => setReviewData({ ...reviewData, internal_note: e.target.value })} rows={2}
                  placeholder={t("platformMisc.runReview.internalNotePlaceholder")}
                  className="w-full rounded-xl px-4 py-3 text-xs font-bold outline-none bg-amber-500/5 border border-amber-500/20 text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] resize-none" />
                <button onClick={handleReview} disabled={saving}
                  className="w-full py-3 rounded-xl bg-[var(--brand-orange)] text-black text-xs font-black uppercase hover:brightness-110 disabled:opacity-50 transition-all">
                  {saving ? t("platformMisc.runReview.saving") : t("platformMisc.runReview.submitReview", { decision: decisionLabel })}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── HISTORY ── */}
        <div className="rounded-2xl bg-secondary border border-[var(--border-primary)] overflow-hidden">
          <button onClick={() => setShowHistory(!showHistory)} className="w-full px-6 py-4 flex items-center gap-3 text-left hover:bg-tertiary/30 transition-colors">
            <History className="w-5 h-5 text-[var(--text-secondary)]" />
            <h2 className="text-sm font-black uppercase text-[var(--text-primary)] flex-1">{t("platformMisc.runReview.history")}</h2>
            {showHistory ? <ChevronUp className="w-4 h-4 text-[var(--text-secondary)]" /> : <ChevronDown className="w-4 h-4 text-[var(--text-secondary)]" />}
          </button>
          {showHistory && (
            <div className="px-6 py-4 border-t border-[var(--border-primary)] space-y-3">
              {timeline.length === 0 ? (
                <p className="text-[10px] text-[var(--text-secondary)] text-center py-4">{t("platformMisc.runReview.noActivity")}</p>
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
