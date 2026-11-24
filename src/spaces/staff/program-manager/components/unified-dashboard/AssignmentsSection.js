"use client";

import { Target } from "lucide-react";
import { cn } from "./constants";

/**
 * "Assigned to me" — tasks handed to the current user, with the accept /
 * decline / complete actions. Shown above the sections when there is anything
 * to act on.
 */
export default function AssignmentsSection({
  t,
  lang,
  assignments,
  actionLoading,
  onAction,
  onViewAll,
}) {
  return (
    <div className="card border-l-4 border-l-amber-500">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-amber-400" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-amber-400">
          {t("dashboard.assignedToMe", "ASSIGNÉES À MOI")}
        </span>
        <span className="text-[10px] font-bold text-[var(--text-secondary)] ml-auto">
          {assignments.filter((assignment) => assignment.status === "pending").length}{" "}
          {t("dashboard.awaitingAction", "en attente d'action")}
        </span>
      </div>
      <div className="space-y-1.5">
        {assignments.slice(0, 5).map((task) => {
          const isPending = task.status === "pending";
          return (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border",
                isPending
                  ? "border-amber-500/20 bg-amber-500/[0.03]"
                  : "border-[var(--border-primary)] bg-secondary",
              )}
            >
              <div className="w-7 h-7 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                {(task.user_name || "?").charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                    {task.title}
                  </span>
                  {task.priority && task.priority !== "medium" && (
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${task.priority === "critical"
                          ? "bg-red-500/10 text-red-400"
                          : task.priority === "high"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-secondary text-[var(--text-secondary)]"
                        }`}
                    >
                      {task.priority}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                  {t("dashboard.assignedBy", "Assigné par:")} {task.user_name || "System"}
                  {task.end_date
                    ? ` \u00B7 ${t("common.due", "Échéance:")} ${new Date(task.end_date).toLocaleDateString(lang)}`
                    : ""}
                </p>
              </div>
              {isPending ? (
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() =>
                      onAction(task.id, "accepted")
                    }
                    disabled={actionLoading === task.id}
                    className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-50"
                  >
                    {actionLoading === task.id ? "..." : t("common.accept", "Accepter")}
                  </button>
                  <button
                    onClick={() =>
                      onAction(task.id, "declined")
                    }
                    disabled={actionLoading === task.id}
                    className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 disabled:opacity-50"
                  >
                    {actionLoading === task.id ? "..." : t("common.decline", "Refuser")}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() =>
                    onAction(
                      task.id,
                      "completed_assignment",
                    )
                  }
                  disabled={actionLoading === task.id}
                  className="px-3 py-1.5 bg-tertiary border border-[var(--border-primary)] text-[var(--text-secondary)] rounded-lg text-[10px] font-bold uppercase tracking-widest hover:text-emerald-400 hover:border-emerald-500/30 transition-all shrink-0 disabled:opacity-50"
                >
                  {actionLoading === task.id ? "..." : t("common.complete", "Terminé")}
                </button>
              )}
            </div>
          );
        })}
        {assignments.length > 5 && (
          <button
            onClick={onViewAll}
            className="w-full text-center py-1.5 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest hover:text-[var(--text-primary)] transition-all"
          >
            {t("common.viewAll", "Voir Tout")} ({assignments.length})
          </button>
        )}
      </div>
    </div>
  );
}
