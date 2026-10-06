"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { Loader2, AlertTriangle } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useSafeBack } from "@/lib/useSafeBack";
import { useApi } from "@/lib/hooks/useApi";

import ReviewHeader from "@/components/platform/runs/review/ReviewHeader";
import ApplicantSection from "@/components/platform/runs/review/ApplicantSection";
import ApplicationSection from "@/components/platform/runs/review/ApplicationSection";
import AIEvaluationSection from "@/components/platform/runs/review/AIEvaluationSection";
import DecisionSection from "@/components/platform/runs/review/DecisionSection";
import HistorySection from "@/components/platform/runs/review/HistorySection";

// ─── Module-scope readers ────────────────────────────────────────────────────
// The reading hook keys its internal work on these, so they are made once here
// rather than rebuilt on every render.

const EMPTY_LIST = [];
const EMPTY_OBJECT = {};

/** A payload that keeps its shape, or nothing when the read was refused. */
const pickMain = (response) => (response?.success ? response : null);
const pickList = (listKey) => (response) => (response?.success ? response[listKey] || [] : []);
const pickEvaluation = (response) =>
  response?.success && response.evaluation ? response.evaluation : null;
import { usePermissions } from "@/lib/PermissionProvider";

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
  // Running the AI evaluation is the `runs.review` capability — it can
  // auto-approve the applicant and send the decision email. Reading a STORED
  // evaluation needs only runs.view, so the panel stays visible while the
  // trigger controls do not.
  const { can } = usePermissions();
  const canReview = can("runs", "review");

  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [reviewData, setReviewData] = useState({ decision: "approved", comment: "", internal_note: "" });
  const [expandedDims, setExpandedDims] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState({});

  const notify = (message) => { setNotification(message); setTimeout(() => setNotification(null), 3000); };

  // ─── The submission and everything around it ────────────────────────────────
  //
  // Four reads: the submission with its run, the form that run uses, the
  // submission's timeline, and its stored evaluation. Each address is derived from
  // the value the read above it returned, so an unknown value is simply an address
  // that is not known yet.
  const {
    data: main,
    loading: mainLoading,
    error: mainError,
    status: mainStatus,
    refresh: refreshMain,
  } = useApi(`/api/platform/form-runs?submission_id=${submissionId}`, {
    defaultValue: null,
    transform: pickMain,
    deps: [submissionId],
  });
  const submission = main?.submission || null;
  const run = main?.run || null;

  const {
    data: formPayload,
    loading: formLoading,
    error: formError,
    status: formStatus,
    refresh: refreshForm,
  } = useApi(run?.form_id ? `/api/platform/forms?id=${run.form_id}` : null, {
    defaultValue: null,
    transform: pickMain,
    deps: [run?.form_id],
  });
  const sections = formPayload?.sections ?? EMPTY_LIST;
  const fields = formPayload?.fields ?? EMPTY_LIST;
  // The form's workflow settings, which the panel's controls are shown from.
  const workflow = formPayload?.form?.settings?.workflow
    ? { ...DEFAULT_WORKFLOW, ...formPayload.form.settings.workflow }
    : DEFAULT_WORKFLOW;

  const {
    data: timeline,
    loading: timelineLoading,
    error: timelineError,
    refresh: refreshTimeline,
  } = useApi(`/api/platform/form-runs?timeline=${submissionId}`, {
    defaultValue: EMPTY_LIST,
    transform: pickList("timeline"),
    deps: [submissionId],
  });

  const {
    data: storedEvaluation,
    loading: evaluationLoading,
    error: evaluationError,
    refresh: refreshEvaluation,
  } = useApi(
    `/api/platform/ai/evaluate-submission?submission_id=${submissionId}`,
    { defaultValue: null, transform: pickEvaluation, deps: [submissionId] },
  );

  // ─── The reviewer's own scoring, layered over the stored one ────────────────
  //
  // Recorded against the dimension it changes AND the evaluation it was made in,
  // so nothing is copied into state and a re-run - which stores a NEW row - starts
  // the reviewer clean rather than carrying over scores given to the previous one.
  const [dimEdits, setDimEdits] = useState({ evalId: null, byDim: EMPTY_OBJECT });
  const editsHere =
    dimEdits.evalId === storedEvaluation?.id ? dimEdits.byDim : EMPTY_OBJECT;
  const evaluation = useMemo(
    () =>
      storedEvaluation
        ? {
            ...storedEvaluation,
            dimensions: (storedEvaluation.dimensions || []).map((dimension, index) =>
              editsHere[index] ? { ...dimension, ...editsHere[index] } : dimension,
            ),
          }
        : null,
    [storedEvaluation, editsHere],
  );

  const editDimension = (index, patch) => {
    const current = dimEdits.evalId === storedEvaluation?.id ? dimEdits.byDim : EMPTY_OBJECT;
    setDimEdits({
      evalId: storedEvaluation?.id ?? null,
      byDim: { ...current, [index]: { ...(current[index] || {}), ...patch } },
    });
  };

  // The read's outcome, derived. A payload that says it failed carries its own
  // message, and a request that never got an answer is the network's.
  const readError = mainError || formError || timelineError || evaluationError;
  const error = readError
    ? t(readError) || t("platformMisc.runReview.loadFailed")
    : mainStatus !== null && !submission
      ? t("platformMisc.runReview.loadFailed")
      : null;

  // One render passes with the run known and its form not yet asked for: the hook's
  // flag rises in the effect, which is after that render.
  const formPending = Boolean(run?.form_id) && formStatus === null && !formError;
  const loading = mainLoading || formLoading || formPending || timelineLoading || evaluationLoading;

  // Every action below re-reads what it changed.
  const reload = useCallback(() => {
    refreshMain();
    refreshForm();
    refreshTimeline();
    refreshEvaluation();
  }, [refreshMain, refreshForm, refreshTimeline, refreshEvaluation]);

  // Lock all editing once a review decision has been submitted (email sent to applicant)
  const isReviewLocked = ["approved", "rejected", "revision_requested"].includes(submission?.status);

  // Live-recalculate overall % whenever human overrides any dimension score
  const computedOverall = useMemo(() => {
    if (!evaluation?.dimensions?.length) return evaluation?.overall_score ?? null;
    const dimensions = evaluation.dimensions;
    const totalWeight = dimensions.reduce((sum, dimension) => sum + (dimension.weight ?? 1), 0);
    const weighted = dimensions.reduce((sum, dimension) => {
      const score = dimension.final_score ?? dimension.score ?? 0;
      return sum + (score * (dimension.weight ?? 1));
    }, 0);
    return Math.round((weighted / totalWeight) * 10);
  }, [evaluation]);

  // Helper: update a single dimension's human score
  const updateDimScore = (dimensionIndex, value) => {
    if (isReviewLocked) return;
    editDimension(dimensionIndex, {
      human_score: value,
      human_comment: evaluation.dimensions[dimensionIndex].human_comment || "",
      final_score: value ?? evaluation.dimensions[dimensionIndex].score,
    });
  };

  // Helper: update a single dimension's human comment
  const updateDimComment = (dimensionIndex, value) => {
    if (isReviewLocked) return;
    editDimension(dimensionIndex, { human_comment: value });
  };

  const handleReRunAI = async () => {
    if (!canReview) return;
    if (isReviewLocked) return;
    setSaving(true);
    try {
      const response = await fetch("/api/platform/ai/evaluate-submission", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submission_id: parseInt(submissionId) }) });
      const data = await response.json();
      if (data.success) { notify(t("platformMisc.runReview.aiEvalComplete")); reload(); }
      else notify(t((data.error || t("platformMisc.runReview.evalFailed")) || "") || (data.error || t("platformMisc.runReview.evalFailed")));
    } catch (_) { notify(t("platformMisc.runReview.aiEvalFailed")); }
    setSaving(false);
  };

  const handleReview = async () => {
    setSaving(true);
    try {
      // Build dimension overrides from evaluation state
      const dimensionOverrides = evaluation?.dimensions
        ?.filter(dimension => dimension.human_score != null)
        .map(dimension => ({ name: dimension.name, human_score: dimension.human_score, human_comment: dimension.human_comment || "", final_score: dimension.final_score })) || [];

      const response = await fetch("/api/platform/form-runs?action=review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: parseInt(submissionId),
          ...reviewData,
          dimension_overrides: dimensionOverrides,
        }),
      });
      const data = await response.json();
      if (data.success) { notify(t("platformMisc.runReview.reviewSubmitted")); reload(); }
      else notify(t((data.error || t("platformMisc.runReview.failed")) || "") || (data.error || t("platformMisc.runReview.failed")));
    } catch (_) { notify(t("platformMisc.runReview.failed")); }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-primary flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--brand-orange)]" /></div>;
  if (error) return <div className="min-h-screen bg-primary flex items-center justify-center"><div className="text-center"><AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" /><p className="text-[var(--text-primary)]">{error}</p><button onClick={goBack} className="mt-4 text-[var(--brand-orange)] text-sm font-bold">← {t("platformMisc.runReview.goBack")}</button></div></div>;

  const submissionData = submission?.data || {};
  const statusLabel = (t(STATUS_LABEL_KEYS[submission?.status] || "") || workflow.statusLabels[submission?.status]) || submission?.status || t("platformMisc.runReview.unknown");
  const statusColor = { draft: "text-slate-500", submitted: "text-blue-500", approved: "text-emerald-500", rejected: "text-rose-500", revision_requested: "text-amber-500" }[submission?.status] || "";
  const decisionMeta = workflow.decisions.find(decision => decision.id === reviewData.decision) || workflow.decisions[0];
  const decisionLabel = t(DECISION_LABEL_KEYS[decisionMeta.id] || "") || decisionMeta.label;

  // Get field value
  const getFieldValue = (field) => submissionData[field.label] ?? submissionData[String(field.id)] ?? submissionData[field.id];

  // Format display value
  const formatValue = (value, field) => {
    if (value === undefined || value === null || value === "") return null;
    const text = String(value);
    if (field?.field_type === "phone" && text.startsWith("{") && text.includes('"code"')) {
      try { const parsed = JSON.parse(text); if (parsed.code && parsed.number) return `${parsed.code} ${parsed.number}`; } catch (_) {}
    }
    return text;
  };

  const sectionsWithFields = sections.map(section => ({
    ...section,
    fields: fields.filter(field => String(field.section_id) === String(section.id)),
  }));

  return (
    <div className="min-h-screen bg-primary">
      {notification && <div className="fixed bottom-6 right-6 z-[500] px-5 py-3 rounded-xl bg-emerald-500 text-black text-xs font-bold uppercase shadow-lg">{notification}</div>}

      <ReviewHeader
        goBack={goBack}
        submission={submission}
        evaluation={evaluation}
        computedOverall={computedOverall}
        t={t}
        canReview={canReview}
        saving={saving}
        isReviewLocked={isReviewLocked}
        onReRunAI={handleReRunAI}
        statusLabel={statusLabel}
        statusColor={statusColor}
      />

      <div className="max-w-3xl mx-auto p-6 pb-24 space-y-6">
        <ApplicantSection
          submission={submission}
          run={run}
          sectionsWithFields={sectionsWithFields}
          fields={fields}
          getFieldValue={getFieldValue}
          formatValue={formatValue}
          lang={lang}
          t={t}
        />

        <ApplicationSection
          sectionsWithFields={sectionsWithFields}
          getFieldValue={getFieldValue}
          formatValue={formatValue}
          collapsedSections={collapsedSections}
          setCollapsedSections={setCollapsedSections}
          t={t}
        />

        {(() => {
          const AIEvaluationSection = require("@/components/platform/runs/review/AIEvaluationSection").default;
          return (
            <AIEvaluationSection
              evaluation={evaluation}
              computedOverall={computedOverall}
              expandedDims={expandedDims}
              setExpandedDims={setExpandedDims}
              fields={fields}
              submissionData={submissionData}
              isReviewLocked={isReviewLocked}
              onReRunAI={handleReRunAI}
              updateDimScore={updateDimScore}
              updateDimComment={updateDimComment}
              saving={saving}
              canReview={canReview}
              t={t}
            />
          );
        })()}

        <DecisionSection
          isReviewLocked={isReviewLocked}
          reviewData={reviewData}
          setReviewData={setReviewData}
          workflow={workflow}
          statusLabel={statusLabel}
          statusColor={statusColor}
          saving={saving}
          onSubmit={handleReview}
          decisionLabel={decisionLabel}
          t={t}
        />

        <HistorySection
          showHistory={showHistory}
          setShowHistory={setShowHistory}
          timeline={timeline}
          t={t}
        />
      </div>
    </div>
  );
}
