/**
 * Batch AI evaluation of a run's submissions, and its progress.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 7 values this module reads into
 * evaluationActions().
 */



export function evaluationActions({
  canReview,
  notify,
  openRun,
  selectedRun,
  setEvalProgress,
  setEvalStats,
  t,
}) {
  const fetchEvalProgress = async (formId) => {
    try {
      const response = await fetch("/api/platform/ai/evaluate-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_id: formId, action: "progress" }),
      });
      const data = await response.json();
      if (data.success) {
        setEvalStats({ approvals: data.approvals || { approved: 0, rejected: 0 }, emails: data.emails || { sent: 0, failed: 0, pending: 0, activation_sent: 0, approval_sent: 0 } });
        return data.progress;
      }
      return null;
    } catch (_) {
      return null;
    }
  };

  const handleBatchEvaluate = async (retryOnly = false) => {
    // Belt and braces: the control is not rendered without the capability, and
    // the server refuses the call too.
    if (!canReview) return;
    if (!selectedRun?.form_id) return notify(t("platformMisc.runs.noFormLinked"));
    const formId = selectedRun.form_id;

    // Initial progress snapshot
    const initial = await fetchEvalProgress(formId);
    if (initial) {
      setEvalProgress({ ...initial, running: true, batch: 0, stopped: false });
      if (initial.remaining === 0) {
        notify(initial.failed > 0 ? t("platformMisc.runs.evalCompleteRetry", { failed: initial.failed }) : t("platformMisc.runs.allEvaluated"));
        setEvalProgress((previousProgress) => previousProgress && { ...previousProgress, running: false, stopped: true });
        return;
      }
    } else {
      notify(t("platformMisc.runs.evalProgressUnreadable"));
      return;
    }

    // Client-driven loop: one request per batch of 20
    let batchNo = 0;
    let stopped = false;
    while (true) {
      batchNo++;
      setEvalProgress((previousProgress) => previousProgress && { ...previousProgress, batch: batchNo });
      let data;
      try {
        const response = await fetch("/api/platform/ai/evaluate-submission", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            form_id: formId,
            action: retryOnly ? "retry_failed" : "batch",
            batch_size: 20,
          }),
        });
        data = await response.json();
      } catch (_) {
        stopped = true;
        setEvalProgress((previousProgress) => previousProgress && { ...previousProgress, running: false, stopped: true });
        notify(t("platformMisc.runs.networkErrorPaused"));
        break;
      }

      if (!data.success) {
        stopped = true;
        setEvalProgress((previousProgress) => previousProgress && { ...previousProgress, running: false, stopped: true });
        notify(t((data.error || t("platformMisc.runs.evalStopped")) || "") || (data.error || t("platformMisc.runs.evalStopped")));
        break;
      }

      const progress = data.progress;
      setEvalProgress({ ...progress, running: true, batch: batchNo, stopped: false });

      if (progress.remaining === 0) {
        setEvalProgress({ ...progress, running: false, batch: batchNo, stopped: true });
        notify(
          t("platformMisc.runs.evalCompleteCount", { evaluated: progress.evaluated, total: progress.total }) +
            (progress.failed > 0 ? t("platformMisc.runs.evalFailedCount", { failed: progress.failed }) : "")
        );
        await fetchEvalProgress(formId); // refresh approval + email stats
        break;
      }

      if (data.processed === 0 && data.evaluated === 0) {
        // Nothing processed this round (all claimed/failed) — avoid infinite loop
        setEvalProgress({ ...progress, running: false, batch: batchNo, stopped: true });
        notify(t("platformMisc.runs.noProgressBatch"));
        break;
      }
    }

    if (selectedRun) openRun(selectedRun);
    return { stopped };
  };

  return {
    fetchEvalProgress,
    handleBatchEvaluate,
  };
}
