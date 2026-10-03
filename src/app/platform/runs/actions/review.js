/**
 * Reviewing a submission: decision, comment, re-evaluation, opening.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 16 values this module reads into
 * reviewActions().
 */



export function reviewActions({
  canReview,
  notify,
  openRun,
  reviewData,
  reviewIncludeResultPdf,
  reviewing,
  selectedRun,
  setEvaluation,
  setReviewData,
  setReviewIncludeResultPdf,
  setReviewTimeline,
  setReviewing,
  setRunFormFields,
  setSaving,
  setShowReview,
  t,
}) {
  // Closing always drops the "also send the AI result PDF" opt-in, so a tick
  // never carries over to another submission or to the next opening.
  const closeReview = () => {
    setShowReview(false);
    setReviewIncludeResultPdf(false);
  };

  const handleReview = async () => {
    if (!reviewing) return;
    setSaving(true);
    try {
      const response = await fetch("/api/platform/form-runs?action=review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: reviewing.id,
          ...reviewData,
          ...(reviewIncludeResultPdf && reviewData.decision === "approved" ? { include_result_pdf: true } : {}),
        }),
      });
      const data = await response.json();
      if (data.success) {
        // The decision went through; only the document could not follow. A 409
        // refusal falls into the error branch below and shows data.error as-is.
        if (data.result_pdf?.status === "failed") {
          notify(t("platformMisc.runs.resultPdfSendFailed", { error: data.result_pdf.error || t("platformMisc.runs.failedFallback") }));
        } else {
          notify(data.already_approved ? t("platformMisc.runs.alreadyApproved") : t("platformMisc.runs.reviewSubmitted"));
        }
        closeReview();
        setReviewTimeline([]);
        if (selectedRun) openRun(selectedRun);
      } else {
        notify(t((data.error || t("platformMisc.runs.reviewFailed")) || "") || (data.error || t("platformMisc.runs.reviewFailed")));
      }
    } catch (_) {}
    setSaving(false);
  };

  // Manual Re-evaluate: the ONE deliberate exception to skip-already-evaluated
  const handleReevaluate = async () => {
    if (!canReview) return;
    if (!reviewing) return;
    setSaving(true);
    try {
      const response = await fetch("/api/platform/ai/evaluate-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: reviewing.id, force: true }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.runs.reevaluationComplete"));
        setEvaluation(data.evaluation);
        if (selectedRun) openRun(selectedRun);
      } else {
        notify(t((data.error || t("platformMisc.runs.reevaluationFailed")) || "") || (data.error || t("platformMisc.runs.reevaluationFailed")));
      }
    } catch (_) {
      notify(t("platformMisc.runs.networkError"));
    }
    setSaving(false);
  };

  const openReview = async (submission) => {
    setReviewing(submission);
    setReviewData({ decision: "approved", comment: "", internal_note: "" });
    setReviewIncludeResultPdf(false);
    setShowReview(true);
    setReviewTimeline([]);
    setEvaluation(null);
    // Load timeline
    try {
      const response = await fetch(`/api/platform/form-runs?timeline=${submission.id}`);
      const data = await response.json();
      if (data.success) setReviewTimeline(data.timeline || []);
    } catch (_) {}
    // Load AI evaluation from separate table
    try {
      const evaluationResponse = await fetch(`/api/platform/ai/evaluate-submission?submission_id=${submission.id}`);
      const evaluationData = await evaluationResponse.json();
      if (evaluationData.success && evaluationData.evaluation) setEvaluation(evaluationData.evaluation);
    } catch (_) {}
    // Fetch form fields to map IDs to labels
    if (selectedRun?.form_id) {
      try {
        const formResponse = await fetch(`/api/platform/forms?id=${selectedRun.form_id}`);
        const formData = await formResponse.json();
        if (formData.success) {
          setRunFormFields((formData.fields || []).filter(field => !["hidden"].includes(field.field_type)));
        }
      } catch (_) {}
    }
  };

  return {
    closeReview,
    handleReview,
    handleReevaluate,
    openReview,
  };
}
