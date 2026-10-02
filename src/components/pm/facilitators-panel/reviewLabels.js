import { FACILITATOR_REVIEW_OPTIONS } from "@/lib/constants";

/** Localized labels for a facilitator weekly review. */

export function reviewStatusLabel(review, t) {
  if (review?.pm_decision === "changes_requested")
    return t("pmMisc.facilitators.weeklyReview.status_changes_requested");
  if (review?.status === "decided")
    return t("pmMisc.facilitators.weeklyReview.status_decided");
  return t("pmMisc.facilitators.weeklyReview.status_submitted");
}

export function reviewRatingLabel(value, t) {
  return FACILITATOR_REVIEW_OPTIONS.ratings.includes(value)
    ? t(`pmMisc.facilitators.weeklyReview.rating_${value}`)
    : value || "";
}

export function reviewEngagementLabel(value, t) {
  return FACILITATOR_REVIEW_OPTIONS.engagement.includes(value)
    ? t(`pmMisc.facilitators.weeklyReview.engagement_${value}`)
    : value || "";
}

export function reviewAttentionLabel(value, t) {
  return FACILITATOR_REVIEW_OPTIONS.attention.includes(value)
    ? t(`pmMisc.facilitators.weeklyReview.attention_${value}`)
    : value || "";
}
