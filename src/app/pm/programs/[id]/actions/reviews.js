/**
 * Review actions: grading a submission, asking for a revision, rejecting one,
 * scheduling the follow-up, deciding a facilitator review, opening a submission
 * and the label helpers the reviews tab renders its vocabulary with.
 */
import { FACILITATOR_REVIEW_OPTIONS } from "@/lib/constants";

export function reviewActions({
  t,
  notify,
  selectedSubmission,
  reviewScore,
  reviewFeedback,
  followupDate,
  followupTime,
  followupDuration,
  followupMeetingLink,
  followupNotes,
  setShowReviewModal,
  setSelectedSubmission,
  setReviewScore,
  setIsSaving,

  setShowFollowupFields,
  setReviewFeedback,
  setFollowupDate,
  setFollowupTime,
  setActivePDF,
  refreshReviews,
  fetchProgramData,
}) {
  const handleReviewSubmission = async () => {
    if (!selectedSubmission) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSubmission.id,
          status: "approved",
          score: parseInt(reviewScore) || 0,
          feedback: "Graded via PM Dashboard",
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.submissionGraded"));
        setShowReviewModal(false);
        setShowFollowupFields(false);
        setFollowupDate("");
        setFollowupTime("");
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.gradeFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.gradeFailed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!selectedSubmission) return;
    if (!reviewFeedback.trim()) {
      notify("Written feedback is required", "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSubmission.id,
          status: "revision_requested",
          feedback: reviewFeedback.trim(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.submissionGraded"));
        setShowReviewModal(false);
        setReviewFeedback("");
        fetchProgramData(true);
      } else {
        notify(data.error || t("pmMisc.workspace.gradeFailed"), "error");
      }
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectSubmission = async () => {
    if (!selectedSubmission) return;
    setIsSaving(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSubmission.id,
          status: "rejected",
          rejection_reason: reviewFeedback.trim() || "Rejected",
          feedback: reviewFeedback.trim() || "Rejected",
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.submissionGraded"));
        setShowReviewModal(false);
        setReviewFeedback("");
        fetchProgramData(true);
      } else {
        notify(data.error || t("pmMisc.workspace.gradeFailed"), "error");
      }
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const reviewRatingLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.ratings.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.rating_${value}`)
      : value || "";
  const reviewEngagementLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.engagement.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.engagement_${value}`)
      : value || "";
  const reviewAttentionLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.attention.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.attention_${value}`)
      : value || "";

  const handleReviewDecision = async (reviewId, decision) => {
    try {
      const response = await fetch("/api/facilitator-reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reviewId, pm_decision: decision }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.reviewDecided") || "Review updated");
        refreshReviews();
      } else {
        notify(data.error || "Failed to update review", "error");
      }
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    }
  };

  const handleScheduleFollowup = async () => {
    if (!selectedSubmission) return;
    if (!followupDate || !followupTime) {
      notify(t("pmMisc.workspace.followupDateTimeRequired"), "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/submissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedSubmission.id,
          status: "pending_followup",
          score: parseInt(reviewScore) || 0,
          feedback: followupNotes || "Follow-up scheduled",
          followup_date: followupDate,
          followup_time: followupTime,
          followup_duration: parseInt(followupDuration) || 30,
          meeting_link: followupMeetingLink || null,
          followup_notes: followupNotes || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.followupScheduled"));
        setShowReviewModal(false);
        setShowFollowupFields(false);
        setFollowupDate("");
        setFollowupTime("");
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.followupScheduleFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.followupScheduleFailed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Open a submission's attachment: PDFs open in the built-in viewer, anything else in a new tab.
  const handleViewSubmission = (submission) => {
    const url =
      submission.file_url ||
      submission.submission_url ||
      submission.submission_link ||
      submission.supporting_url ||
      null;
    if (!url) {
      notify(t("pmMisc.workspace.noSubmissionFile"), "error");
      return;
    }
    const path = url.split("?")[0].toLowerCase();
    if (path.endsWith(".pdf")) {
      setActivePDF({
        url,
        name:
          submission.deliverable_title ||
          t("pmMisc.workspace.submissionDocument"),
      });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const handleOpenReviewModal = (submission) => {
    setSelectedSubmission(submission);
    setReviewScore(submission.score || 0);
    setShowReviewModal(true);
  };

  const handleResetFollowupFields = () => {
    setShowFollowupFields(false);
    setFollowupDate("");
    setFollowupTime("");
  };

  return {
    handleReviewSubmission,
    handleRequestRevision,
    handleRejectSubmission,
    reviewRatingLabel,
    reviewEngagementLabel,
    reviewAttentionLabel,
    handleReviewDecision,
    handleScheduleFollowup,
    handleViewSubmission,
    handleOpenReviewModal,
    handleResetFollowupFields,
  };
}
