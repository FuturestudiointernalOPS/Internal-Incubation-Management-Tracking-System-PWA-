"use client";

import React, { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { cacheGet, cacheSet } from "@/lib/hooks/useApi";
import { FileText, BarChart3, FolderKanban, CheckCircle2, Clock, Activity } from "lucide-react";

function cn(...classes) { return classes.filter(Boolean).join(" "); }

export default function PlatformDashboard() {
  const { t } = useI18n();
  const [operationalStats, setOperationalStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadOperationalData(); }, []);

  const loadOperationalData = async (bypassCache = false) => {
    const statsUrl = "/api/platform/form-runs?dashboard=true";
    const activityUrl = "/api/platform/form-runs?activity=true";
    const apply = (statsData, activityData) => {
      if (statsData?.success) setOperationalStats(statsData.stats);
      if (activityData?.success)
        setRecentActivity(activityData.activity || []);
    };
    // Cache-first paint: returning to this page renders instantly when both
    // snapshots are fresh; the network refresh below converges.
    if (!bypassCache) {
      const cachedStats = cacheGet(statsUrl);
      const cachedActivity = cacheGet(activityUrl);
      if (
        cachedStats !== null &&
        cachedStats.success &&
        cachedActivity !== null &&
        cachedActivity.success
      ) {
        apply(cachedStats, cachedActivity);
        setLoading(false);
      }
    }
    try {
      const [statsData, activityData] = await Promise.all(
        [statsUrl, activityUrl].map((u) =>
          fetch(u)
            .then((r) => r.json())
            .catch(() => ({ success: false })),
        ),
      );
      if (statsData?.success) cacheSet(statsUrl, statsData);
      if (activityData?.success) cacheSet(activityUrl, activityData);
      apply(statsData, activityData);
    } catch (_) {}
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-8">
        <h1 className="text-xl font-black uppercase">{t("platformMisc.dashboard.title")}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{t("platformMisc.dashboard.loading")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 animate-in">
      <div>
        <h1 className="text-xl font-black uppercase tracking-tight text-[var(--text-primary)]">{t("platformMisc.dashboard.title")}</h1>
        <p className="text-[10px] text-[var(--text-secondary)] mt-1">{t("platformMisc.dashboard.subtitle")}</p>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          <Activity className="w-4 h-4 text-[var(--brand-orange)]" /> {t("platformMisc.dashboard.overview")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: "platformMisc.dashboard.activeRuns", value: operationalStats?.active_runs ?? 0, icon: FileText, color: "text-emerald-500" },
            { label: "platformMisc.dashboard.assigned", value: operationalStats?.total_assignments ?? 0, icon: FolderKanban, color: "text-blue-500" },
            { label: "platformMisc.dashboard.submissions", value: operationalStats?.total_submissions ?? 0, icon: CheckCircle2, color: "text-indigo-500" },
            { label: "platformMisc.dashboard.pending", value: operationalStats?.pending_reviews ?? 0, icon: Clock, color: "text-amber-500" },
            { label: "platformMisc.dashboard.approval", value: (operationalStats?.approval_rate != null ? Math.round(operationalStats.approval_rate) + "%" : "\u2014"), icon: BarChart3, color: (operationalStats?.approval_rate || 0) > 50 ? "text-emerald-500" : "text-rose-500" },
            { label: "platformMisc.dashboard.overdue", value: operationalStats?.overdue ?? 0, icon: Clock, color: (operationalStats?.overdue ?? 0) > 0 ? "text-rose-500" : "text-slate-500" },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-2xl bg-secondary border border-[var(--border-primary)] text-center">
              <p className={cn("text-xl font-black", s.color)}>{s.value}</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <s.icon className={cn("w-2.5 h-2.5", s.color)} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{t(s.label)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-tight text-[var(--text-primary)] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[var(--brand-orange)]" /> {t("platformMisc.dashboard.recentActivity")}
        </h2>
        {recentActivity.length > 0 ? (
          <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl overflow-hidden">
            {recentActivity.slice(0, 10).map((entry, idx) => (
              <div key={idx} className="flex items-center gap-3 px-5 py-3 border-b border-[var(--border-primary)] last:border-0 text-[11px]">
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0",
                  entry.action === "submitted" ? "bg-blue-500" :
                  entry.action === "approved" ? "bg-emerald-500" :
                  entry.action === "rejected" ? "bg-rose-500" :
                  entry.action === "launched" ? "bg-emerald-500" :
                  "bg-[var(--brand-orange)]"
                )} />
                <span className="font-bold text-[var(--text-primary)] flex-1">{entry.details || entry.action}</span>
                <span className="text-[10px] font-medium text-[var(--text-secondary)]">{entry.created_at ? new Date(entry.created_at).toLocaleDateString() : ""}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-secondary border border-[var(--border-primary)] rounded-2xl p-6 text-center">
            <p className="text-[10px] text-[var(--text-secondary)] font-bold">{t("platformMisc.dashboard.noActivity")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
