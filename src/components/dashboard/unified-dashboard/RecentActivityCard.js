"use client";

import { CheckCircle2, Shield, Sparkles, Zap } from "lucide-react";
import { ACTIVITY_LABELS } from "./constants";

/**
 * RECENT ACTIVITY — the audit feed, one glyph per kind of action.
 *
 * Extracted verbatim from UnifiedDashboard.
 */
export default function RecentActivityCard({ t, lang, activity, onViewAll }) {
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[var(--brand-orange)]" />
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("dashboard.recentActivity", "Activité Récente")}
          </span>
        </div>
        <button
          onClick={onViewAll}
          className="text-[10px] font-bold text-[var(--brand-orange)] uppercase tracking-wide hover:underline"
        >
          {t("common.viewAll", "Voir Tout")}
        </button>
      </div>
      <div className="space-y-1.5">
        {activity.slice(0, 5).map((activityEntry, index) => (
          <div
            key={index}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-tertiary transition-all border border-transparent hover:border-[var(--border-primary)]"
          >
            <div className="w-7 h-7 rounded-lg bg-primary border border-[var(--border-primary)] flex items-center justify-center shrink-0">
              {activityEntry.action?.includes("completed") ||
              activityEntry.action?.includes("resolved") ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              ) : activityEntry.action?.includes("blocker") ? (
                <Shield className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[var(--text-primary)] capitalize truncate">
                {t(ACTIVITY_LABELS[activityEntry.action] || "") ||
                  activityEntry.action?.replace(/_/g, " ")}
              </p>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] truncate">
                {activityEntry.description}
              </p>
            </div>
            <span className="text-[10px] font-medium text-[var(--text-secondary)] shrink-0">
              {activityEntry.timestamp
                ? new Date(activityEntry.timestamp).toLocaleDateString(lang)
                : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
