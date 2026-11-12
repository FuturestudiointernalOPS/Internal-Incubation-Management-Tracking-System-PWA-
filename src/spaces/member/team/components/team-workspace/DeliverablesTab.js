"use client";

import AppCard from "@/components/ui/AppCard";
import AppButton from "@/components/ui/AppButton";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import EmptyState from "./EmptyState";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "./constants";
import { ClipboardCheck, ExternalLink, FileText, History } from "lucide-react";

/**
 * The deliverables tab: one card per deliverable with its latest submission,
 * its version history, and the actions to submit or review it.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function DeliverablesTab({
  deliverables,
  submissions,
  getSubmissionStatus,
  canReview,
  onReview,
  onSubmit,
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      {deliverables.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-6 h-6 text-[var(--text-tertiary)]" />}
          title={t("rootMisc.team.noDeliverables")}
          description={t("rootMisc.team.noDeliverablesDesc")}
        />
      ) : (
        deliverables.map((deliverable) => {
          const submission = getSubmissionStatus(deliverable.id);
          const versions = submissions[deliverable.id];
          const isOverdue =
            !submission &&
            deliverable.due_date &&
            new Date(deliverable.due_date) < new Date();

          return (
            <AppCard key={deliverable.id} padding="lg" hover>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-black text-[var(--text-primary)]">
                      {deliverable.title}
                    </h4>
                    {isOverdue && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-500/10 text-[10px] font-bold uppercase text-rose-500">
                        {t("rootMisc.team.overdue")}
                      </span>
                    )}
                  </div>
                  {deliverable.description && (
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
                      {deliverable.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase">
                      {t("rootMisc.team.week")} {deliverable.week_number || "?"}
                    </span>
                    {deliverable.due_date && (
                      <span className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase">
                        {t("rootMisc.team.dueDate")}: {fmtDate(deliverable.due_date)}
                      </span>
                    )}
                  </div>

                  {/* Submission status */}
                  {submission && (
                    <div className="mt-3">
                      <AppStatusBadge status={submission.status || "pending"} />
                      {submission.file_url && (
                        <a
                          href={submission.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 ml-3 text-[10px] font-bold text-[var(--brand-blue)] hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {t("rootMisc.team.viewSubmission")}
                        </a>
                      )}
                      {submission.feedback && (
                        <p className="text-[10px] text-[var(--text-secondary)] mt-2">
                          {t("rootMisc.team.feedback")}: {submission.feedback}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Version history */}
                  {versions && versions.length > 1 && (
                    <details className="mt-3">
                      <summary className="text-[10px] font-bold text-[var(--text-tertiary)] cursor-pointer hover:text-[var(--brand-orange)] transition-colors uppercase tracking-wider flex items-center gap-1">
                        <History className="w-3 h-3" />
                        {t("rootMisc.team.versionHistory")} ({versions.length})
                      </summary>
                      <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-[var(--border-primary)]">
                        {versions.map((version, versionIndex) => (
                          <div
                            key={versionIndex}
                            className="text-[10px] text-[var(--text-secondary)] flex items-center gap-2"
                          >
                            <span className="text-[var(--text-tertiary)]">
                              v{versions.length - versionIndex}
                            </span>
                            <span>{fmtDate(version.created_at)}</span>
                            {version.file_url && (
                              <a
                                href={version.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--brand-blue)] hover:underline"
                              >
                                {t("rootMisc.team.view")}
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>

                {/* Action */}
                <div className="shrink-0 flex items-center gap-2">
                  {/* Review button */}
                  {canReview && submission && (
                    <AppButton
                      variant="secondary"
                      size="sm"
                      onClick={() => onReview(deliverable)}
                      title={t("rootMisc.team.reviewSubmissionTitle")}
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                    </AppButton>
                  )}
                  <AppButton
                    variant={submission ? "secondary" : "primary"}
                    size="sm"
                    onClick={() => onSubmit(deliverable)}
                  >
                    {submission
                      ? t("rootMisc.team.resubmit")
                      : t("rootMisc.team.submit")}
                  </AppButton>
                </div>
              </div>
            </AppCard>
          );
        })
      )}
    </div>
  );
}