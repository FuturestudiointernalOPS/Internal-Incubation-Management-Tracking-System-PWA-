"use client";

import React from "react";
import {
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  X,
  Shield,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function ReviewModal({
  submission,
  feedback,
  setFeedback,
  loading,
  onClose,
  onReview,
}) {
  const { t } = useI18n();

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg space-y-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--brand-orange)]" />
            <h3 className="text-sm font-black uppercase tracking-tight">
              {t("pmMisc.submissions.reviewSubmission")}
            </h3>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("pmMisc.submissions.participant")}
            </p>
            <p className="text-sm font-bold mt-0.5">
              {submission.participant_name || submission.participant_id}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-tertiary border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("pmMisc.submissions.deliverable")}
            </p>
            <p className="text-sm font-bold mt-0.5">
              {submission.deliverable_title ||
                t("pmMisc.submissions.deliverableWithId", {
                  id: submission.deliverable_id,
                })}
            </p>
          </div>
          {submission.file_url && (
            <a
              href={submission.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-blue-400 hover:brightness-110 transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              <span className="text-[10px] font-bold">
                {t("pmMisc.submissions.viewSubmissionFile")}
              </span>
            </a>
          )}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("pmMisc.submissions.feedback")}
            </label>
            <textarea
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              rows={3}
              placeholder={t("pmMisc.submissions.feedbackPlaceholder")}
              className="w-full bg-primary border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand-orange)] transition-all resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          {submission.grading_mode === "graded" ? (
            <>
              <button
                onClick={() => onReview(submission.id, "approved")}
                disabled={loading}
                className="flex-1 py-3 bg-emerald-500 text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />{" "}
                {t("pmMisc.submissions.approve")}
              </button>
              <button
                onClick={() =>
                  onReview(submission.id, "revision_requested")
                }
                disabled={loading}
                className="flex-1 py-3 bg-blue-500 text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />{" "}
                {t("pmMisc.submissions.requestRevision")}
              </button>
              <button
                onClick={() => onReview(submission.id, "rejected")}
                disabled={loading}
                className="flex-1 py-3 bg-rose-500 text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" /> {t("pmMisc.submissions.reject")}
              </button>
            </>
          ) : (
            <button
              onClick={() => onReview(submission.id, "reviewed")}
              disabled={loading}
              className="flex-1 py-3 bg-emerald-500 text-black rounded-xl text-sm font-bold uppercase tracking-wide hover:brightness-110 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />{" "}
              {t("pmMisc.submissions.submitFeedback")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
