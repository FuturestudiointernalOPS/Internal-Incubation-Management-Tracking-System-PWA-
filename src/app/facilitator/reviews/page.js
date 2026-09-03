"use client";

import React, { useState, useEffect } from "react";
import { ClipboardList, Loader2, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { FACILITATOR_REVIEW_OPTIONS } from "@/lib/constants";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";

export const dynamic = "force-dynamic";

/**
 * FACILITATOR — MY REVIEWS
 * All reviews submitted by this facilitator across their programs,
 * including Program Manager decisions.
 */

export default function FacilitatorReviews() {
  const { t } = useI18n();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const ratingLabel = (v) =>
    FACILITATOR_REVIEW_OPTIONS.ratings.includes(v)
      ? t(`pmMisc.facilitators.weeklyReview.rating_${v}`)
      : v || "";
  const engagementLabel = (v) =>
    FACILITATOR_REVIEW_OPTIONS.engagement.includes(v)
      ? t(`pmMisc.facilitators.weeklyReview.engagement_${v}`)
      : v || "";
  const attentionLabel = (v) =>
    FACILITATOR_REVIEW_OPTIONS.attention.includes(v)
      ? t(`pmMisc.facilitators.weeklyReview.attention_${v}`)
      : v || "";
  const statusLabel = (r) => {
    if (r.pm_decision === "changes_requested")
      return t("pmMisc.facilitators.weeklyReview.status_changes_requested");
    if (r.status === "decided")
      return t("pmMisc.facilitators.weeklyReview.status_decided");
    return t("pmMisc.facilitators.weeklyReview.status_submitted");
  };

  const loadReviews = async (bypassCache = false) => {
    const url = "/api/facilitator-reviews";
    const apply = (data) => {
      if (data.success) setReviews(data.reviews || []);
    };
    let painted = false;
    if (!bypassCache) setLoading(true);
    try {
      // Cache-first paint: returning to this page renders instantly from a
      // fresh snapshot while the network refreshes in the background.
      if (!bypassCache) {
        const cached = cacheGet(url);
        if (cached !== null && cached.success) {
          apply(cached);
          setLoading(false);
          painted = true;
        }
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        cacheSet(url, data);
        apply(data);
      }
    } catch (_) {
      if (!painted) setReviews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            {reviews.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-[var(--border-primary)] bg-secondary p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase">
                    {t("pmMisc.facilitators.weeklyReview.title")} #{r.id}
                  </p>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      r.pm_decision === "changes_requested"
                        ? "bg-rose-500/15 text-rose-400"
                        : r.status === "decided"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-amber-500/15 text-amber-400"
                    }`}
                  >
                    {statusLabel(r)}
                  </span>
                </div>
                <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                  {t("pmMisc.facilitators.weeklyReview.submittedAt", {
                    date: new Date(r.created_at).toLocaleString(),
                  })}{" "}
                  · {t("pmMisc.facilitators.weeklyReview.week")}{" "}
                  {r.week_number || "—"} · Program {r.program_id}
                </p>
                {(r.overall_rating || r.participant_progress) && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.overall")}:
                    </strong>{" "}
                    {ratingLabel(r.overall_rating) || r.participant_progress}
                  </p>
                )}
                {r.engagement && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.engagement")}:
                    </strong>{" "}
                    {engagementLabel(r.engagement)}
                  </p>
                )}
                {(r.went_well || r.completed_work) && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.wentWell")}:
                    </strong>{" "}
                    {r.went_well || r.completed_work}
                  </p>
                )}
                {(r.struggles || r.challenges) && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.struggles")}:
                    </strong>{" "}
                    {r.struggles || r.challenges}
                  </p>
                )}
                {(r.needs_attention_type || r.needs_attention || r.needs_attention_note) && (
                  <div className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <p>
                      <strong className="text-[var(--text-primary)]">
                        {t("pmMisc.facilitators.weeklyReview.needsAttention")}:
                      </strong>{" "}
                      {attentionLabel(r.needs_attention_type) || r.needs_attention}
                    </p>
                    {r.needs_attention_note && (
                      <p className="mt-0.5 pl-1">{r.needs_attention_note}</p>
                    )}
                  </div>
                )}
                {(r.focus_next_week || r.recommendations) && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.focusNextWeek")}:
                    </strong>{" "}
                    {r.focus_next_week || r.recommendations}
                  </p>
                )}
                {r.additional_notes && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("pmMisc.facilitators.weeklyReview.additionalNotes")}:
                    </strong>{" "}
                    {r.additional_notes}
                  </p>
                )}
                {r.pm_decision && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[8px] font-black uppercase text-emerald-400 mb-1">
                      {t("pmMisc.facilitators.weeklyReview.decision")}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--text-primary)]">
                      {r.pm_decision}
                    </p>
                    {r.pm_decision_note && (
                      <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-1">
                        {r.pm_decision_note}
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
