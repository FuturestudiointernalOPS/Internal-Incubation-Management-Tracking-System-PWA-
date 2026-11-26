"use client";

import React from "react";
import {
  CheckCircle2,
  ExternalLink,
  Shield,
  Calendar,
  Briefcase,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

function StatusBadge({ status }) {
  const { t } = useI18n();
  const config = {
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    rejected: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    revision_requested: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const labels = {
    pending: t("pmMisc.submissions.statusPending"),
    approved: t("pmMisc.submissions.statusApproved"),
    rejected: t("pmMisc.submissions.statusRejected"),
    revision_requested: t("pmMisc.submissions.statusRevisionRequested"),
  };
  const statusClasses =
    config[status?.toLowerCase()] ||
    "bg-slate-500/10 text-slate-400 border-slate-500/20";
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${statusClasses}`}
    >
      {status
        ? labels[status.toLowerCase()] || status.replace(/_/g, " ")
        : t("pmMisc.submissions.statusDraft")}
    </span>
  );
}

export default function SubmissionsList({
  loading,
  filtered,
  search,
  filterStatus,
  onReview,
  onSchedule,
}) {
  const { t } = useI18n();

  return loading ? (
    <div className="flex items-center justify-center py-20">
      <div
        className="w-6 h-6 border-2 border-t-[var(--brand-orange)] rounded-full animate-spin"
        style={{
          borderColor: "rgba(255,102,0,0.1)",
          borderTopColor: "var(--brand-orange)",
        }}
      />
    </div>
  ) : filtered.length === 0 ? (
    <div className="py-20 flex flex-col items-center justify-center opacity-40">
      <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
      <p className="text-lg font-black text-[var(--text-primary)] uppercase">
        {search || filterStatus !== "all"
          ? t("pmMisc.submissions.noMatches")
          : t("pmMisc.submissions.noSubmissionsYet")}
      </p>
      <p className="text-xs font-bold text-[var(--text-secondary)] mt-1">
        {search || filterStatus !== "all"
          ? t("pmMisc.submissions.tryDifferentFilters")
          : t("pmMisc.submissions.submissionsWillAppear")}
      </p>
    </div>
  ) : (
    <div className="space-y-3">
      {filtered.map((submission) => (
        <div
          key={submission.id}
          className={`ios-card !p-0 overflow-hidden border-[var(--border-primary)] hover:border-brand-orange/30 transition-all ${
            submission.status === "pending"
              ? "border-l-4 border-l-amber-500"
              : ""
          }`}
        >
          <div className="flex flex-col lg:flex-row items-stretch">
            {/* Participant Info */}
            <div className="p-5 lg:w-64 bg-tertiary border-r border-[var(--border-primary)] flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-sm font-black uppercase">
                    {(
                      submission.participant_name ||
                      submission.participant_id ||
                      "?"
                    ).charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {submission.participant_name ||
                        submission.participant_id ||
                        t("pmMisc.submissions.unknown")}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
                      {submission.participant_group || submission.participant_id
                        ? t("pmMisc.submissions.groupWithName", {
                            group: submission.participant_group || "—",
                          })
                        : ""}
                    </p>
                  </div>
                </div>
                <StatusBadge status={submission.status} />
              </div>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-3">
                {t("pmMisc.submissions.submitted")}{" "}
                {submission.created_at
                  ? new Date(submission.created_at).toLocaleDateString()
                  : ""}
              </p>
            </div>

            {/* Submission Details */}
            <div className="flex-1 p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
                  {submission.deliverable_title ||
                    t("pmMisc.submissions.deliverableWithId", {
                      id: submission.deliverable_id,
                    })}
                </h3>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />{" "}
                    {submission.program_name ||
                      t("pmMisc.submissions.programWithId", {
                        id: submission.program_id,
                      })}
                  </span>
                  {submission.deliverable_week && (
                    <span className="text-[10px] font-medium text-[var(--text-secondary)] flex items-center gap-1">
                      <Calendar className="w-3 h-3" />{" "}
                      {t("pmMisc.submissions.week", {
                        week: submission.deliverable_week,
                      })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-[var(--border-primary)]">
                {submission.file_url && (
                  <a
                    href={submission.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-[10px] font-bold uppercase tracking-wide hover:bg-blue-500/20 transition-all"
                  >
                    <ExternalLink className="w-3 h-3" />{" "}
                    {t("pmMisc.submissions.viewFile")}
                  </a>
                )}
                {submission.status === "pending" && (
                  <>
                    <button
                      onClick={() => onReview(submission)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-orange)] text-black rounded-lg text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                    >
                      <Shield className="w-3 h-3" />{" "}
                      {submission.grading_mode === "graded"
                        ? t("pmMisc.submissions.review")
                        : t("pmMisc.submissions.feedback")}
                    </button>
                    <button
                      onClick={() => onSchedule(submission)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 text-black rounded-lg text-[10px] font-bold uppercase tracking-wide hover:brightness-110 transition-all"
                    >
                      <Calendar className="w-3 h-3" />{" "}
                      {t("pmMisc.submissions.scheduleReview")}
                    </button>
                  </>
                )}
                {submission.status !== "pending" && (
                  <span className="text-[10px] font-medium text-[var(--text-secondary)] ml-auto">
                    {t("pmMisc.submissions.reviewed")}{" "}
                    {submission.reviewed_at
                      ? new Date(submission.reviewed_at).toLocaleDateString()
                      : ""}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
