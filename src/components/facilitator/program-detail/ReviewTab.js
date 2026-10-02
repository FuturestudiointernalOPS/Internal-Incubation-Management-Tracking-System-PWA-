"use client";

import { Loader2, Send } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FACILITATOR_REVIEW_OPTIONS } from "@/lib/constants";
import ReviewField from "./ReviewField";
import ReviewSelect from "./ReviewSelect";
import ReviewSummaryRow from "./ReviewSummaryRow";

/**
 * The review tab: the weekly review form and the reviews already submitted.
 * Extracted verbatim from FacilitatorProgram.
 */
export default function ReviewTab({
  review,
  onReviewChange,
  reviewWeek,
  onWeekChange,
  onSubmit,
  savingReview,
  myReviews,
}) {
  const { t } = useI18n();

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
  const reviewStatusLabel = (reviewItem) => {
    if (reviewItem.pm_decision === "changes_requested")
      return t("pmMisc.facilitators.weeklyReview.status_changes_requested");
    if (reviewItem.status === "decided")
      return t("pmMisc.facilitators.weeklyReview.status_decided");
    return t("pmMisc.facilitators.weeklyReview.status_submitted");
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-5 space-y-3">
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.weeklyReview.title")}
          </h2>
          <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
            {t("pmMisc.facilitators.weeklyReview.subtitle")}
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border-primary)] px-3 py-1.5 bg-primary">
            <span className="text-[10px] font-bold uppercase text-[var(--text-secondary)]">
              {t("pmMisc.facilitators.weeklyReview.week")}
            </span>
            <input
              type="number"
              min="1"
              value={reviewWeek}
              onChange={(event) => onWeekChange(parseInt(event.target.value) || 1)}
              className="w-16 bg-transparent text-center text-[11px] font-black text-[var(--text-primary)] outline-none"
            />
          </div>
        </div>

        <ReviewSelect
          label={t("pmMisc.facilitators.weeklyReview.q1")}
          value={review.overall_rating}
          onChange={(value) => onReviewChange({ ...review, overall_rating: value })}
          options={FACILITATOR_REVIEW_OPTIONS.ratings.map((option) => ({
            value: option,
            label: t(`pmMisc.facilitators.weeklyReview.rating_${option}`),
          }))}
        />

        <ReviewField
          label={t("pmMisc.facilitators.weeklyReview.q2")}
          value={review.went_well}
          onChange={(value) => onReviewChange({ ...review, went_well: value })}
        />

        <ReviewField
          label={t("pmMisc.facilitators.weeklyReview.q3")}
          value={review.struggles}
          onChange={(value) => onReviewChange({ ...review, struggles: value })}
        />

        <ReviewSelect
          label={t("pmMisc.facilitators.weeklyReview.q4")}
          value={review.engagement}
          onChange={(value) => onReviewChange({ ...review, engagement: value })}
          options={FACILITATOR_REVIEW_OPTIONS.engagement.map((option) => ({
            value: option,
            label: t(`pmMisc.facilitators.weeklyReview.engagement_${option}`),
          }))}
        />

        <ReviewSelect
          label={t("pmMisc.facilitators.weeklyReview.q5")}
          value={review.needs_attention_type}
          onChange={(value) => onReviewChange({ ...review, needs_attention_type: value })}
          options={FACILITATOR_REVIEW_OPTIONS.attention.map((option) => ({
            value: option,
            label: t(`pmMisc.facilitators.weeklyReview.attention_${option}`),
          }))}
        />

        {review.needs_attention_type &&
          review.needs_attention_type !== "nothing" && (
            <ReviewField
              label={t("pmMisc.facilitators.weeklyReview.q5note")}
              value={review.needs_attention_note}
              onChange={(value) =>
                onReviewChange({ ...review, needs_attention_note: value })
              }
            />
          )}

        <ReviewField
          label={t("pmMisc.facilitators.weeklyReview.q6")}
          value={review.focus_next_week}
          onChange={(value) => onReviewChange({ ...review, focus_next_week: value })}
        />

        <ReviewField
          label={t("pmMisc.facilitators.weeklyReview.q7")}
          value={review.additional_notes}
          onChange={(value) => onReviewChange({ ...review, additional_notes: value })}
        />

        <button
          disabled={savingReview}
          onClick={onSubmit}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--brand-orange)] text-white text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
        >
          {savingReview ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          {t("pmMisc.facilitators.weeklyReview.submit")}
        </button>
      </div>

      {myReviews.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">
            {t("pmMisc.facilitators.weeklyReview.myReviews")}
          </h2>
          {myReviews.map((reviewItem) => (
            <div
              key={reviewItem.id}
              className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                  {t("pmMisc.facilitators.weeklyReview.submittedAt", {
                    date: new Date(reviewItem.created_at).toLocaleDateString(),
                  })}
                  {reviewItem.week_number
                    ? ` · ${t("pmMisc.facilitators.weeklyReview.week")} ${reviewItem.week_number}`
                    : ""}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    reviewItem.pm_decision === "changes_requested"
                      ? "bg-rose-500/15 text-rose-400"
                      : reviewItem.status === "decided"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {reviewStatusLabel(reviewItem)}
                </span>
              </div>
              <ReviewSummaryRow
                label={t("pmMisc.facilitators.weeklyReview.overall")}
                value={
                  reviewRatingLabel(reviewItem.overall_rating) ||
                  reviewItem.participant_progress
                }
              />
              <ReviewSummaryRow
                label={t("pmMisc.facilitators.weeklyReview.engagement")}
                value={reviewEngagementLabel(reviewItem.engagement)}
              />
              <ReviewSummaryRow
                label={t("pmMisc.facilitators.weeklyReview.wentWell")}
                value={reviewItem.went_well}
              />
              <ReviewSummaryRow
                label={t("pmMisc.facilitators.weeklyReview.struggles")}
                value={reviewItem.struggles || reviewItem.challenges}
              />
              <ReviewSummaryRow
                label={t("pmMisc.facilitators.weeklyReview.needsAttention")}
                value={
                  reviewAttentionLabel(reviewItem.needs_attention_type) ||
                  reviewItem.needs_attention
                }
                note={reviewItem.needs_attention_note}
              />
              <ReviewSummaryRow
                label={t("pmMisc.facilitators.weeklyReview.focusNextWeek")}
                value={reviewItem.focus_next_week || reviewItem.recommendations}
              />
              <ReviewSummaryRow
                label={t("pmMisc.facilitators.weeklyReview.additionalNotes")}
                value={reviewItem.additional_notes}
              />
              {reviewItem.pm_decision && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-[10px] font-bold uppercase text-emerald-400 mb-1">
                    {t("pmMisc.facilitators.weeklyReview.decision")}
                  </p>
                  <p className="text-[10px] font-medium text-[var(--text-primary)]">
                    {reviewItem.pm_decision}
                  </p>
                  {reviewItem.pm_decision_note && (
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                      {reviewItem.pm_decision_note}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
