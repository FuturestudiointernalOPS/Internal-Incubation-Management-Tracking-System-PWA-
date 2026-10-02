"use client";

import { AlertTriangle, Clock, Shield } from "lucide-react";
import { cn } from "./constants";

/**
 * "Attention required" — the overdue tasks, the critical blockers (each one
 * resolvable in place) and what is due today.
 *
 * Extracted verbatim from UnifiedDashboard. Navigation and the blocker write
 * stay with the screen: `onOpenRoleAwareReport` / `onOpenStaffReport` are its
 * routes, `onResolveBlocker` its write.
 */
export default function AttentionSection({
  t,
  lang,
  attention,
  resolvingBlocker,
  onOpenRoleAwareReport,
  onOpenStaffReport,
  onResolveBlocker,
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-rose-400" />
        <span className="text-sm font-black uppercase tracking-tight text-rose-400">
          {t("dashboard.attentionRequired", "Attention Requise")}
        </span>
      </div>

      {attention.overdueTasks?.length > 0 && (
        <div className="card border-l-4 border-l-rose-500">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-rose-500">
              {t("dashboard.overdueTasks", "Tâches en retard")} ({attention.overdueTasks.length})
            </span>
          </div>
          <div className="space-y-1">
            {attention.overdueTasks.slice(0, 5).map((task) => (
              <div
                key={task.id}
                onClick={onOpenRoleAwareReport}
                className="flex items-center gap-2 p-2 rounded-lg bg-rose-500/5 border border-rose-500/10 cursor-pointer hover:brightness-110 transition-all"
              >
                <span className="text-[10px] font-bold text-[var(--text-primary)] flex-1 truncate">
                  {task.title}
                </span>
                {task.priority && (
                  <span
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded",
                      task.priority === "high" || task.priority === "critical"
                        ? "bg-rose-500/10 text-rose-500"
                        : "bg-secondary text-[var(--text-secondary)]",
                    )}
                  >
                    {task.priority}
                  </span>
                )}
                <span className="text-[10px] font-medium text-[var(--text-secondary)] shrink-0">
                  {task.due_date
                    ? new Date(task.due_date).toLocaleDateString(lang)
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {attention.criticalBlockers?.length > 0 && (
        <div className="card border-l-4 border-l-rose-500">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-rose-500">
              {t("dashboard.criticalBlockers", "Bloqueurs critiques")} ({attention.criticalBlockers.length})
            </span>
          </div>
          <div className="space-y-1">
            {attention.criticalBlockers.slice(0, 5).map((blocker) => (
              <div
                key={blocker.id}
                className="flex items-center gap-3 p-2 rounded-xl bg-rose-500/[0.03] border border-rose-500/10"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[var(--text-primary)]">
                      {blocker.title}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500">
                      {blocker.severity}
                    </span>
                  </div>
                  {blocker.project_id && (
                    <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                      {t("common.project", "Projet:")} #{blocker.project_id}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onResolveBlocker(blocker.id)}
                  disabled={resolvingBlocker === blocker.id}
                  className="px-3 py-1.5 bg-emerald-500 text-black rounded-lg text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all disabled:opacity-50 shrink-0"
                >
                  {resolvingBlocker === blocker.id ? "..." : t("common.resolve", "Résoudre")}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {attention.dueToday?.length > 0 && (
        <div className="card border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-wide text-amber-400">
              {t("dashboard.dueToday", "À rendre aujourd'hui")} ({attention.dueToday.length})
            </span>
          </div>
          <div className="space-y-1">
            {attention.dueToday.map((task) => (
              <div
                key={task.id}
                onClick={onOpenStaffReport}
                className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 cursor-pointer hover:brightness-110 transition-all"
              >
                <span className="text-[10px] font-bold text-[var(--text-primary)] flex-1 truncate">
                  {task.title}
                </span>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">
                  {task.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
