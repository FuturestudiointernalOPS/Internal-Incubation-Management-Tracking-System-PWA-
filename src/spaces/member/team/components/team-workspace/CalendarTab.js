"use client";

import AppCard from "@/components/ui/AppCard";
import AppStatusBadge from "@/components/ui/AppStatusBadge";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "./constants";
import { CheckCircle2, Flag, History } from "lucide-react";

/**
 * The calendar tab: the deadlines still ahead, with a dot marking the urgent
 * ones, and the team's ten most recent submissions.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function CalendarTab({
  upcomingDeadlines,
  submissions,
  deliverables,
  getSubmissionStatus,
}) {
  const { t } = useI18n();

  /** Every submission, newest first, capped at the ten most recent. */
  const recentSubmissions = Object.entries(submissions)
    .flatMap(([deliverableId, submissionList]) =>
      (submissionList || []).map((submission) => ({
        ...submission,
        _delId: deliverableId,
      })),
    )
    .sort((first, second) => new Date(second.created_at) - new Date(first.created_at))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Upcoming Deadlines */}
      <AppCard padding="lg">
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
          <Flag className="w-4 h-4 text-[var(--brand-orange)]" />
          {t("rootMisc.team.upcomingDeadlines")}
        </h3>
        {upcomingDeadlines.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] font-bold">
            {t("rootMisc.team.noUpcomingDeadlines")}
          </p>
        ) : (
          <div className="space-y-3">
            {upcomingDeadlines.map((deliverable) => {
              const submission = getSubmissionStatus(deliverable.id);
              const isUrgent =
                deliverable._date &&
                new Date(deliverable._date) - new Date() < 3 * 24 * 60 * 60 * 1000;
              return (
                <div
                  key={deliverable.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-3)]"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isUrgent ? "bg-rose-500" : "bg-amber-500"
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        {deliverable.title}
                      </p>
                      <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
                        {t("rootMisc.team.week")} {deliverable.week_number || "?"}
                        {deliverable.description
                          ? ` — ${deliverable.description}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {submission ? (
                      <AppStatusBadge
                        status={submission.status}
                        variant="minimal"
                      />
                    ) : (
                      <span className="text-[10px] font-black text-amber-500 uppercase">
                        {t("rootMisc.team.pending")}
                      </span>
                    )}
                    <span className="text-[10px] font-black text-[var(--text-primary)]">
                      {fmtDate(deliverable._date)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </AppCard>

      {/* Past submissions */}
      <AppCard padding="lg">
        <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-[var(--text-secondary)]" />
          {t("rootMisc.team.pastActivity")}
        </h3>
        {recentSubmissions.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)] font-bold">
            {t("rootMisc.team.noSubmissionsYet")}
          </p>
        ) : (
          <div className="space-y-2">
            {recentSubmissions.map((submission, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-primary)]"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <div>
                    <p className="text-xs font-bold text-[var(--text-primary)]">
                      {deliverables.find(
                        (deliverable) => deliverable.id === submission._delId,
                      )?.title || t("rootMisc.team.submission")}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
                      {fmtDate(submission.created_at)}
                    </p>
                  </div>
                </div>
                <AppStatusBadge
                  status={submission.status || "pending"}
                  variant="minimal"
                />
              </div>
            ))}
          </div>
        )}
      </AppCard>
    </div>
  );
}