"use client";

import { ListTodo, Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The tasks widget: the three counts by status, linking to the task list.
 * Extracted verbatim from app/admin/page.js.
 */
export function TasksSummaryWidget({ tasks, onOpen }) {
  const { t } = useI18n();
  return (
    <div
      onClick={onOpen}
      className="card cursor-pointer hover:bg-tertiary transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        <ListTodo className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
          {t("reports.tasks")}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-2xl font-black text-blue-400 tracking-tight">
            {
              (tasks || []).filter((task) => task.status === "in_progress")
                .length
            }
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("status.active")}
          </p>
        </div>
        <div>
          <p className="text-2xl font-black text-rose-400 tracking-tight">
            {(tasks || []).filter((task) => task.status === "blocked").length}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("status.blocked")}
          </p>
        </div>
        <div>
          <p className="text-2xl font-black text-emerald-400 tracking-tight">
            {
              (tasks || []).filter((task) => task.status === "completed")
                .length
            }
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("status.done")}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The blockers widget: how many are open and how many of those are severe,
 * linking to the blocker list.
 * Extracted verbatim from app/admin/page.js.
 */
export function BlockersSummaryWidget({ blockers, onOpen }) {
  const { t } = useI18n();
  return (
    <div
      onClick={onOpen}
      className="card cursor-pointer hover:bg-tertiary transition-all"
    >
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-3.5 h-3.5 text-rose-400" />
        <span className="text-[11px] font-bold uppercase tracking-wide text-rose-400">
          {t("reports.blockers")}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div>
          <p className="text-2xl font-black text-rose-400 tracking-tight">
            {blockers.length}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("status.active")}
          </p>
        </div>
        <div>
          <p className="text-2xl font-black text-rose-500 tracking-tight">
            {
              blockers.filter(
                (blocker) =>
                  blocker.severity === "high" ||
                  blocker.severity === "critical",
              ).length
            }
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("status.high")}
          </p>
        </div>
      </div>
    </div>
  );
}