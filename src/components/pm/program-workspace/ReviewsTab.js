import { useI18n } from "@/lib/i18n";

export default function ReviewsTab({
  facilitatorReviews,
  onRefreshReviews,
  onReviewDecision,
  onReviewDecisionChangesRequested,
  reviewAttentionLabel,
  reviewEngagementLabel,
  reviewRatingLabel,
  reviewsLoading,
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)]">
          {t("pmMisc.workspace.tabReviews")}
        </h3>
        <button
          onClick={onRefreshReviews}
          className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:underline"
        >
          {t("common.refresh") || "Refresh"}
        </button>
      </div>
      {reviewsLoading ? (
        <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
          Loading…
        </p>
      ) : facilitatorReviews.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)] py-8 text-center">
          No facilitator reviews submitted yet.
        </p>
      ) : (
        facilitatorReviews.map((review) => (
          <div
            key={review.id}
            className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-black uppercase">
                  {review.facilitator_name ||
                    review.facilitator_id ||
                    "Facilitator"}
                </p>
                <p className="text-[10px] text-[var(--text-secondary)]">
                  {t("pmMisc.facilitators.weeklyReview.week")}{" "}
                  {review.week_number || "—"} ·{" "}
                  {t("pmMisc.facilitators.weeklyReview.submittedAt", {
                    date: new Date(review.created_at).toLocaleDateString(),
                  })}
                </p>
              </div>
              <span
                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                  review.pm_decision === "changes_requested"
                    ? "bg-rose-500/15 text-rose-400"
                    : review.status === "decided"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-amber-500/15 text-amber-400"
                }`}
              >
                {review.pm_decision === "changes_requested"
                  ? t(
                      "pmMisc.facilitators.weeklyReview.status_changes_requested",
                    )
                  : review.status === "decided"
                    ? t("pmMisc.facilitators.weeklyReview.status_decided")
                    : t("pmMisc.facilitators.weeklyReview.status_submitted")}
              </span>
            </div>

            {(review.overall_rating || review.participant_progress) && (
              <p className="text-[10px] text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">
                  {t("pmMisc.facilitators.weeklyReview.overall")}:
                </strong>{" "}
                {reviewRatingLabel(review.overall_rating) ||
                  review.participant_progress}
              </p>
            )}
            {review.engagement && (
              <p className="text-[10px] text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">
                  {t("pmMisc.facilitators.weeklyReview.engagement")}:
                </strong>{" "}
                {reviewEngagementLabel(review.engagement)}
              </p>
            )}
            {(review.went_well || review.completed_work) && (
              <p className="text-[10px] text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">
                  {t("pmMisc.facilitators.weeklyReview.wentWell")}:
                </strong>{" "}
                {review.went_well || review.completed_work}
              </p>
            )}
            {(review.struggles || review.challenges) && (
              <p className="text-[10px] text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">
                  {t("pmMisc.facilitators.weeklyReview.struggles")}:
                </strong>{" "}
                {review.struggles || review.challenges}
              </p>
            )}
            {(review.needs_attention_type ||
              review.needs_attention ||
              review.needs_attention_note) && (
              <div className="text-[10px] text-[var(--text-secondary)]">
                <p>
                  <strong className="text-[var(--text-primary)]">
                    {t("pmMisc.facilitators.weeklyReview.needsAttention")}:
                  </strong>{" "}
                  {reviewAttentionLabel(review.needs_attention_type) ||
                    review.needs_attention}
                </p>
                {review.needs_attention_note && (
                  <p className="mt-0.5 pl-1">{review.needs_attention_note}</p>
                )}
              </div>
            )}
            {(review.focus_next_week || review.recommendations) && (
              <p className="text-[10px] text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">
                  {t("pmMisc.facilitators.weeklyReview.focusNextWeek")}:
                </strong>{" "}
                {review.focus_next_week || review.recommendations}
              </p>
            )}
            {review.additional_notes && (
              <p className="text-[10px] text-[var(--text-secondary)]">
                <strong className="text-[var(--text-primary)]">
                  {t("pmMisc.facilitators.weeklyReview.additionalNotes")}:
                </strong>{" "}
                {review.additional_notes}
              </p>
            )}

            {review.pm_decision && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                <p className="text-[10px] font-bold uppercase text-emerald-400 mb-1">
                  {t("pmMisc.facilitators.weeklyReview.decision")}
                </p>
                <p className="text-[10px] font-medium text-[var(--text-primary)]">
                  {review.pm_decision}
                </p>
                {review.pm_decision_note && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                    {review.pm_decision_note}
                  </p>
                )}
              </div>
            )}
            {review.status !== "decided" && (
              <div className="flex gap-2">
                <button
                  onClick={() => onReviewDecision(review.id, "acknowledged")}
                  className="text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                >
                  {t("pmMisc.facilitators.weeklyReview.acknowledge")}
                </button>
                <button
                  onClick={() =>
                    onReviewDecisionChangesRequested(
                      review.id,
                      "changes_requested",
                    )
                  }
                  className="text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                >
                  {t("pmMisc.facilitators.weeklyReview.requestChanges")}
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
