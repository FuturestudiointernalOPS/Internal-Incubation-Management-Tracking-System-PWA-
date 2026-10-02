"use client";

import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { STATUS_CONFIG, levelLabel, statusLabel } from "./constants";

/**
 * The drawer opened by clicking a calendar entry: the task's status, its
 * dates, its priority, its description and its open blockers.
 * Extracted verbatim from app/admin/page.js.
 */
export default function TaskDetailDrawer({ task, lang, onClose }) {
  const { t } = useI18n();
  if (!task) return null;
  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg space-y-5 border-brand-orange/30 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${(STATUS_CONFIG[task.status] || STATUS_CONFIG.pending).bg} ${(STATUS_CONFIG[task.status] || STATUS_CONFIG.pending).color}`}
              >
                {statusLabel(t, task.status || "pending")}
              </span>
              {task.end_date &&
                !["completed", "pending"].includes(task.status) &&
                new Date(task.end_date) <
                  new Date(new Date().toDateString()) && (
                  <span className="text-[10px] font-bold text-rose-400 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded">
                    {t("status.overdue")}
                  </span>
                )}
            </div>
            <h3 className="text-lg font-black text-[var(--text-primary)] tracking-tight">
              {task.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-tertiary rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {task.start_date && (
            <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                {t("time.start")}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {new Date(task.start_date).toLocaleDateString(lang)}
              </p>
            </div>
          )}
          {task.end_date && (
            <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
              <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
                {t("time.due")}
              </p>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                {new Date(task.end_date).toLocaleDateString(lang)}
              </p>
            </div>
          )}
          <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
              {t("time.created")}
            </p>
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {task.created_at
                ? new Date(task.created_at).toLocaleDateString(lang)
                : "—"}
            </p>
          </div>
          <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
              {t("adminMisc.dashboard.priority")}
            </p>
            <p
              className={`text-sm font-bold ${task.priority === "critical" ? "text-red-400" : task.priority === "high" ? "text-amber-400" : "text-[var(--text-secondary)]"}`}
            >
              {levelLabel(t, task.priority)}
            </p>
          </div>
        </div>
        {task.description && (
          <div className="p-3 bg-tertiary rounded-xl border border-[var(--border-primary)]">
            <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest mb-1">
              {t("adminMisc.dashboard.description")}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">
              {task.description}
            </p>
          </div>
        )}
        {(task.blockers || []).filter(
          (blocker) => blocker.status === "active",
        ).length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">
              {t("adminMisc.dashboard.blockers")}
            </p>
            {task.blockers
              .filter((blocker) => blocker.status === "active")
              .map((blocker) => (
                <div
                  key={blocker.id}
                  className="p-2 rounded bg-rose-500/10 text-[10px] text-rose-400 font-bold"
                >
                  {blocker.title}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}