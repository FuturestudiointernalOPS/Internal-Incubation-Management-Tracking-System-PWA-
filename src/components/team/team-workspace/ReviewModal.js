"use client";

import AppButton from "@/components/ui/AppButton";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import { useI18n } from "@/lib/i18n";
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  History,
  Loader2,
  X,
} from "lucide-react";

/**
 * The coaching review sheet: what was submitted, the feedback to send back, and
 * the four decisions — accept, request a revision, reject, or schedule a
 * follow-up.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function ReviewModal({
  submission,
  feedback,
  onFeedbackChange,
  showFollowUp,
  followUpDate,
  onFollowUpDateChange,
  onScheduleFollowUp,
  reviewing,
  onClose,
  onAction,
}) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[var(--surface-1)] border border-[var(--border-primary)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-primary)]">
          <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider">
            {t("rootMisc.team.reviewSubmission")}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] transition-colors text-[var(--text-secondary)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs font-bold text-[var(--text-primary)]">
              {submission._deliverable?.title || t("rootMisc.team.deliverable")}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <AppStatusBadge
                status={submission.status || "pending"}
                variant="minimal"
              />
              {submission.file_url && (
                <a
                  href={submission.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-[var(--brand-blue)] hover:underline"
                >
                  {t("rootMisc.team.viewFile")} <ExternalLink className="w-3 h-3 inline" />
                </a>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("rootMisc.team.feedback")}
            </label>
            <textarea
              value={feedback}
              onChange={onFeedbackChange}
              placeholder={t("rootMisc.team.feedbackPlaceholder")}
              rows={3}
              className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-brand-orange/60 transition-colors resize-none"
            />
          </div>

          {showFollowUp && (
            <div className="space-y-2 p-3 rounded-xl bg-[var(--surface-3)]">
              <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                {t("rootMisc.team.scheduleFollowUp")}
              </label>
              <input
                type="datetime-local"
                value={followUpDate}
                onChange={onFollowUpDateChange}
                className="w-full bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] outline-none focus:border-brand-orange/60 transition-colors"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 px-6 pb-5 flex-wrap">
          <AppButton
            variant="primary"
            size="sm"
            icon={CheckCircle2}
            onClick={() => onAction("approved")}
            disabled={reviewing}
          >
            {t("rootMisc.team.accept")}
          </AppButton>
          <AppButton
            variant="secondary"
            size="sm"
            icon={History}
            onClick={() => onAction("revision_requested")}
            disabled={reviewing}
          >
            {t("rootMisc.team.requestRevision")}
          </AppButton>
          <AppButton
            variant="secondary"
            size="sm"
            icon={X}
            onClick={() => onAction("rejected")}
            disabled={reviewing}
            style={{ color: "var(--chart-danger)" }}
          >
            {t("rootMisc.team.reject")}
          </AppButton>
          {showFollowUp ? (
            <AppButton
              variant="primary"
              size="sm"
              icon={Calendar}
              onClick={() => onAction("follow_up", true)}
              disabled={reviewing || !followUpDate}
            >
              {reviewing ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" /> {t("rootMisc.team.saving")}
                </>
              ) : (
                t("rootMisc.team.confirmFollowUp")
              )}
            </AppButton>
          ) : (
            <AppButton
              variant="secondary"
              size="sm"
              icon={Calendar}
              onClick={onScheduleFollowUp}
              disabled={reviewing}
            >
              {t("rootMisc.team.scheduleFollowUp")}
            </AppButton>
          )}
        </div>
      </div>
    </div>
  );
}