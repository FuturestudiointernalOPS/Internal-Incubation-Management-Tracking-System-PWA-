/**
 * Milestone submissions
 *
 * Reading the submissions of a milestone, and the decision to accept or
 * request a change.
 *
 * Cut out of src/components/ventures/JourneyManagerPanel.js as-is: no state of
 * its own, no reads. The panel keeps every state value and every read, and hands
 * this factory what it reads through `values` — plus what the factories above
 * it return. The names it need are listed in the signature — nothing else.
 */



export function submissionWrites({
  ventureId,
  setMilestoneSubmissions,
  setSubmissionsBusy,
  notify,
  t,
  setSubmissionReview,
  setSubmissionComment,
}) {
  /** The Venture's submissions awaiting a decision inside one milestone. */
  const loadMilestoneSubmissions = async (milestoneId) => {
    try {
      const res = await fetch(
        `/api/ventures/${ventureId}/submissions/review-queue?milestone_id=${encodeURIComponent(milestoneId)}`,
      );
      const payload = await res.json();
      setMilestoneSubmissions((prev) => ({ ...prev, [milestoneId]: payload.success ? payload.items || [] : [] }));
    } catch (_) {
      setMilestoneSubmissions((prev) => ({ ...prev, [milestoneId]: [] }));
    }
  };

  const decideSubmission = async (milestoneId, item, decision, comment = "") => {
    setSubmissionsBusy(item.submission_id);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/tasks/${item.task_id}/submissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          submission_id: item.submission_id,
          decision,
          comment: comment.trim() || null,
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        notify(t(decision === "approved" ? "venture.manager.submissionApproved" : "venture.manager.submissionChangesRequested"));
        setSubmissionReview(null);
        setSubmissionComment("");
        await loadMilestoneSubmissions(milestoneId);
      } else {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
      }
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setSubmissionsBusy(null);
    }
  };

  return {
    loadMilestoneSubmissions,
    decideSubmission,
  };
}
