"use client";

import { BarChart3, CheckCircle2, Eye, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { levelLabel } from "./constants";

/**
 * The five most recent active blockers, each with the button that resolves it,
 * or the reassurance shown when there are none.
 * Extracted verbatim from app/admin/page.js.
 */
export function LatestBlockersCard({ blockers, resolvingBlocker, onResolve }) {
  const { t } = useI18n();
  return (
    <div className="card">
      <h4 className="text-[11px] font-bold text-rose-500 uppercase tracking-wide mb-4">
        {t("admin.latestBlockers")}
      </h4>
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
                    {t("admin.taskLabel")}: {blocker.task_title}
                  </p>
                )}
                {blocker.task_owner && (
                  <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
                    {t("admin.ownerLabel")}: {blocker.task_owner}
                  </p>
                )}
              </div>
              <button
                disabled={resolvingBlocker !== null}
                onClick={() => onResolve(blocker.id)}
                className="px-3 py-1.5 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
              >
                {resolvingBlocker === blocker.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : null}
                {t("common.resolve")}
              </button>
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