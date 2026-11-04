"use client";

import { BarChart3, CheckCircle2, Eye } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { levelLabel } from "./constants";

/**
 * The current blockers: the five most recent active ones, each with its task,
 * the task's owner and when it was raised, and how many are active in all. A
 * Super Admin monitors blockers but cannot resolve them (only their creator
 * can — see /admin/blockers), so the card links to the list instead.
 */
export function LatestBlockersCard({ blockers, lang, onOpenAll }) {
  const { t } = useI18n();
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-[11px] font-bold text-rose-500 uppercase tracking-wide">
          {t("admin.latestBlockers")} · {blockers.length}
        </h4>
        {blockers.length > 0 && (
          <button
            onClick={onOpenAll}
            className="text-[10px] font-bold text-rose-400 uppercase hover:underline"
          >
            {t("common.viewAll")}
          </button>
        )}
      </div>
      {blockers.length > 0 ? (
        <div className="space-y-2">
          {blockers.slice(0, 5).map((blocker) => (
            <div
              key={blocker.id}
              className="flex items-center gap-3 p-2.5 rounded-xl bg-rose-500/[0.03] border border-rose-500/10"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[var(--text-primary)]">
                    {blocker.title}
                  </span>
                  {blocker.severity && (
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${blocker.severity === "critical" || blocker.severity === "high" ? "bg-rose-500/10 text-rose-500" : "bg-secondary text-[var(--text-secondary)]"}`}
                    >
                      {levelLabel(t, blocker.severity)}
                    </span>
                  )}
                </div>
                {blocker.task_title && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                    {t("admin.taskLabel")} {blocker.task_title}
                  </p>
                )}
                <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                  {t("admin.ownerLabel")} {blocker.task_owner || blocker.user_name || "—"}
                  {blocker.created_at ? ` · ${new Date(blocker.created_at).toLocaleDateString(lang)}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-40" />
          <p className="text-sm text-[var(--text-secondary)]">
            {t("admin.noActiveBlockers")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The two shortcuts of the risks section: the blocker list and the reports
 * that mention blockers.
 * Extracted verbatim from app/admin/page.js.
 */
export function QuickActionsCard({ onNavigate }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="card">
        <h4 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide mb-3">
          {t("admin.quickActions")}
        </h4>
        <div className="space-y-2">
          <button
            onClick={() => onNavigate("/admin/blockers")}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-primary border border-[var(--border-primary)] hover:border-rose-500/30 transition-all"
          >
            <span className="text-[10px] font-bold uppercase tracking-wide">
              {t("admin.viewAllBlockers")}
            </span>
            <Eye className="w-3.5 h-3.5 text-rose-500" />
          </button>
          <button
            onClick={() => onNavigate("/admin/op-reports")}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-primary border border-[var(--border-primary)] hover:border-amber-500/30 transition-all"
          >
            <span className="text-[10px] font-bold uppercase tracking-wide">
              {t("admin.blockerReports")}
            </span>
            <BarChart3 className="w-3.5 h-3.5 text-amber-500" />
          </button>
        </div>
      </div>
    </div>
  );
}