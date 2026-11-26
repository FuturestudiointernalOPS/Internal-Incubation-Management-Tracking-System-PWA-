"use client";

import { ClipboardList, Check, RotateCcw } from "lucide-react";
import {
  reviewStatusLabel,
  reviewRatingLabel,
  reviewEngagementLabel,
  reviewAttentionLabel,
} from "./reviewLabels";

/** One facilitator weekly review, with the PM decision and its note field. */
export default function FacilitatorReviewCard({ review, t, note, onNoteChange, onDecision }) {
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] p-4 bg-secondary space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[var(--brand-orange)]" />
          <p className="text-[11px] font-bold uppercase tracking-wide">
            {review.facilitator_name || review.facilitator_id}
          </p>
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
          review.pm_decision === "changes_requested"
            ? "bg-rose-500/15 text-rose-400"
            : review.status === "decided"
              ? "bg-emerald-500/15 text-emerald-400"
              : "bg-amber-500/15 text-amber-400"
        }`}>
          {reviewStatusLabel(review, t)}
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 text-[10px]">
        {(review.overall_rating || review.participant_progress) && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.overall")}</strong> {reviewRatingLabel(review.overall_rating, t) || review.participant_progress}</p>}
        {review.engagement && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.engagement")}</strong> {reviewEngagementLabel(review.engagement, t)}</p>}
        {(review.went_well || review.completed_work) && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.wentWell")}</strong> {review.went_well || review.completed_work}</p>}
        {(review.struggles || review.challenges) && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.struggles")}</strong> {review.struggles || review.challenges}</p>}
        {(review.needs_attention_type || review.needs_attention || review.needs_attention_note) && <div className="text-[var(--text-secondary)]"><p><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.needsAttention")}</strong> {reviewAttentionLabel(review.needs_attention_type, t) || review.needs_attention}</p>{review.needs_attention_note && <p className="mt-0.5 pl-1">{review.needs_attention_note}</p>}</div>}
        {(review.focus_next_week || review.recommendations) && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.focusNextWeek")}</strong> {review.focus_next_week || review.recommendations}</p>}
        {review.additional_notes && <p className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{t("pmMisc.facilitators.weeklyReview.additionalNotes")}</strong> {review.additional_notes}</p>}
      </div>
      {review.pm_decision ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">
            {t("pmMisc.facilitators.pmDecision", { pm: review.pm_decision_by || t("pmMisc.facilitators.pmShort") })}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-primary)]">{review.pm_decision}</p>
          {review.pm_decision_note && (
            <p className="text-sm text-[var(--text-secondary)] mt-1">{review.pm_decision_note}</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            placeholder={t("pmMisc.facilitators.pmActionNote")}
            rows={2}
            className="w-full bg-primary border border-[var(--border-primary)] rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-[var(--brand-orange)] resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onDecision("acknowledged")}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
            >
              <Check className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.weeklyReview.acknowledge")}
            </button>
            <button
              onClick={() => onDecision("changes_requested")}
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase px-3 py-1.5 rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
            >
              <RotateCcw className="w-3.5 h-3.5" /> {t("pmMisc.facilitators.weeklyReview.requestChanges")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
