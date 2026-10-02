"use client";

import { Target, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The "assigned to me" panel: the pending and in-progress assignments waiting
 * on the reader, each with the button that answers it, and its pagination.
 * Extracted verbatim from app/admin/page.js.
 */
export default function AssignmentsPanel({
  assignments,
  assignmentsLoading,
  processingId,
  page,
  perPage,
  lang,
  onAction,
  onPageChange,
}) {
  const { t } = useI18n();
  const open = assignments.filter((assignment) => assignment.status !== "completed");
  const pageCount = Math.ceil(open.length / perPage);
  if (open.length === 0 || assignmentsLoading) return null;

  return (
    <div className="card border-l-4 border-l-amber-500">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-amber-400" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-400">
          {t("admin.assignedToMe")}
        </span>
        <span className="text-[10px] font-bold text-[var(--text-secondary)] ml-auto">
          {assignments.filter((assignment) => assignment.status === "pending")
            .length}{" "}
          {t("admin.awaitingAction")}
        </span>
      </div>
      <div className="space-y-1.5">
        {open
          .slice((page - 1) * perPage, page * perPage)
          .map((task) => {
            const isPending = task.status === "pending";
            return (
              <div
                key={task.id}
                className={`flex items-center gap-3 p-3 rounded-xl border ${isPending ? "border-amber-500/20 bg-amber-500/[0.03]" : "border-[var(--border-primary)] bg-secondary"}`}
              >
                <div className="w-7 h-7 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                  {(task.user_name || task.assigned_to || "?").charAt(
                    0,
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] truncate block">
                    {task.title}
                  </span>
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                    {t("admin.assignedBy")}:{" "}
                    {task.user_name || t("adminMisc.dashboard.system")}
                    {task.end_date
                      ? ` · ${t("time.due")}: ${new Date(task.end_date).toLocaleDateString(lang)}`
                      : ""}
                  </p>
                </div>
                {isPending ? (
                  <div className="flex gap-1.5 shrink-0">
                    <button
                      disabled={processingId !== null}
                      onClick={() => onAction(task, "accepted")}
                      className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      {processingId === task.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : null}
                      {t("common.accept")}
                    </button>
                    <button
                      disabled={processingId !== null}
                      onClick={() => onAction(task, "declined")}
                      className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                    >
                      {processingId === task.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : null}
                      {t("common.decline")}
                    </button>
                  </div>
                ) : (
                  <button
                    disabled={processingId !== null}
                    onClick={() => onAction(task, "completed_assignment")}
                    className="px-3 py-1.5 bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] rounded-lg text-[10px] font-bold uppercase tracking-widest hover:text-emerald-400 hover:border-emerald-500/30 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                  >
                    {processingId === task.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : null}
                    {t("common.complete")}
                  </button>
                )}
              </div>
            );
          })}
      </div>

      {/* Pagination Controls */}
      {open.length > perPage && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[var(--border-primary)]">
          <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("common.page")} {page} {t("common.of")} {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => onPageChange(Math.min(pageCount, page + 1))}
              disabled={page === pageCount}
              className="p-1.5 rounded-lg border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-tertiary transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}