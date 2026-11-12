"use client";

import { Inbox } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The decision queue — the only thing on this screen that is actually the
 * Venture Manager's job: submissions waiting for an approve / request-changes
 * call. Same rows, same actions, same server route as before; only its place on
 * the page changed (it used to be the second of six equal boxes).
 */
export default function CockpitDecisions({ items = [], loading = false, onDecide }) {
  const { t } = useI18n();
  const count = items.length;

  return (
    <div className="card h-full">
      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
        <Inbox className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
        {t("staff.ventureWorkspace.needsAttention", { count })}
      </h3>

      {loading ? (
        <p className="text-xs text-slate-500">{t("common.loading")}</p>
      ) : count === 0 ? (
        <p className="text-xs text-slate-500">{t("staff.ventureWorkspace.nothingToReview")}</p>
      ) : (
        <div className="space-y-2">
          {items.map((submission) => (
            <div
              key={submission.submission_id}
              className="rounded-lg border border-[var(--border-primary)] p-3 flex flex-col md:flex-row md:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[var(--text-primary)] truncate">
                  {submission.task_title}
                </p>
                <p className="text-[10px] text-slate-500">
                  {submission.milestone_title ? `${submission.milestone_title} · ` : ""}
                  {t("staff.ventureWorkspace.submissionMeta", {
                    version: submission.version,
                    name: submission.submitted_by_name || t("venture.label"),
                  })}{" "}
                  · {new Date(submission.created_at).toLocaleDateString()}
                </p>
                {submission.notes && (
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{submission.notes}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {submission.file_url && (
                  <a
                    href={submission.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]"
                  >
                    {t("venture.personal.open")}
                  </a>
                )}
                <button
                  onClick={() => onDecide?.(submission, "approved")}
                  className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                >
                  {t("venture.manager.approveDeliverable")}
                </button>
                <button
                  onClick={() => onDecide?.(submission, "changes_requested")}
                  className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                >
                  {t("venture.manager.requestChanges")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
