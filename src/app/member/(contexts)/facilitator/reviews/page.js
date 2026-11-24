"use client";

import { ClipboardList, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FACILITATOR_REVIEW_OPTIONS } from "@/lib/constants";
import { useApi } from "@/lib/hooks/useApi";

export const dynamic = "force-dynamic";

/**
 * FACILITATOR — MY REVIEWS
 * All reviews submitted by this facilitator across their programs,
 * including Program Manager decisions.
 */

// Module scope on purpose: the hook keys its internal callback on this function,
// so an inline arrow would give it a new identity on every render and refetch in
// a loop.
const pickReviews = (response) => (response?.success ? response.reviews || [] : []);

export default function FacilitatorReviews() {
  const { t } = useI18n();
  // The loader's work — painting from the cache first, discarding a stale
  // response, the background refresh — belongs to the hook, so the screen keeps
  // no data state of its own and never sets state from an effect.
  const { data: reviews, loading } = useApi("/api/facilitator-reviews", {
    defaultValue: [],
    transform: pickReviews,
  });

  const ratingLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.ratings.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.rating_${value}`)
      : value || "";
  const engagementLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.engagement.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.engagement_${value}`)
      : value || "";
  const attentionLabel = (value) =>
    FACILITATOR_REVIEW_OPTIONS.attention.includes(value)
      ? t(`pmMisc.facilitators.weeklyReview.attention_${value}`)
      : value || "";
  const statusLabel = (review) => {
    if (review.pm_decision === "changes_requested")
      return t("pmMisc.facilitators.weeklyReview.status_changes_requested");
    if (review.status === "decided")
      return t("pmMisc.facilitators.weeklyReview.status_decided");
    return t("pmMisc.facilitators.weeklyReview.status_submitted");
  };

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        <header>
          <h1 className="text-2xl font-black uppercase tracking-tight">
            My Reviews
          </h1>
          <p className="text-[11px] text-[var(--text-secondary)] font-bold mt-1">
            Reviews you submitted to your Program Managers, with their
            decisions.
          </p>
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-10 text-center">
            <ClipboardList className="w-8 h-8 text-[var(--text-secondary)] mx-auto mb-3" />
            <p className="text-[11px] font-black uppercase text-[var(--text-secondary)]">
              No reviews yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase">
                    {t("pmMisc.facilitators.weeklyReview.title")} #{review.id}
                  </p>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      review.pm_decision === "changes_requested"
                        ? "bg-rose-500/15 text-rose-400"
                        : review.status === "decided"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {statusLabel(review)}
                  </span>
                </div>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("pmMisc.facilitators.weeklyReview.submittedAt", {
                    date: new Date(review.created_at).toLocaleString(),
                  })}{" "}
                  · {t("pmMisc.facilitators.weeklyReview.week")}{" "}
                  {review.week_number || "—"} · Program {review.program_id}
                </p>
                {(review.overall_rating || review.participant_progress) && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.overall")}:
                    </strong>{" "}
                    {ratingLabel(review.overall_rating) || review.participant_progress}
                  </p>
                )}
                {review.engagement && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.engagement")}:
                    </strong>{" "}
                    {engagementLabel(review.engagement)}
                  </p>
                )}
                {(review.went_well || review.completed_work) && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.wentWell")}:
                    </strong>{" "}
                    {review.went_well || review.completed_work}
                  </p>
                )}
                {(review.struggles || review.challenges) && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.struggles")}:
                    </strong>{" "}
                    {review.struggles || review.challenges}
                  </p>
                )}
                {(review.needs_attention_type || review.needs_attention || review.needs_attention_note) && (
                  <div className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <p>
                      <strong className="text-[var(--text-primary)]">
                        {t("pmMisc.facilitators.weeklyReview.needsAttention")}:
                      </strong>{" "}
                      {attentionLabel(review.needs_attention_type) || review.needs_attention}
                    </p>
                    {review.needs_attention_note && (
                      <p className="mt-0.5 pl-1">{review.needs_attention_note}</p>
                    )}
                  </div>
                )}
                {(review.focus_next_week || review.recommendations) && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.focusNextWeek")}:
                    </strong>{" "}
                    {review.focus_next_week || review.recommendations}
                  </p>
                )}
                {review.additional_notes && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.additionalNotes")}:
                    </strong>{" "}
                    {review.additional_notes}
                  </p>
                )}
                {review.pm_decision && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[8px] font-black uppercase text-emerald-400 mb-1">
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
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
