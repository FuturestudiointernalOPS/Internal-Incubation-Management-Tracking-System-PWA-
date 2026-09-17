"use client";

import { useI18n } from "@/lib/i18n";
import { useApiMulti } from "@/lib/hooks/useApi";
import { FileText, BarChart3, FolderKanban, CheckCircle2, Clock, Activity } from "lucide-react";

function cn(...classes) { return classes.filter(Boolean).join(" "); }

// Module scope on purpose: the hook keys its internal callback on this array and
// on the transforms it carries, so inline values would give them a new identity
// on every render and refetch in a loop.
const pickPlatformStats = (d) => (d?.success ? d.stats : null);
const pickPlatformActivity = (d) => (d?.success ? d.activity || [] : []);
const PLATFORM_DASHBOARD_ENDPOINTS = [
  { key: "stats", url: "/api/platform/form-runs?dashboard=true", transform: pickPlatformStats },
  { key: "activity", url: "/api/platform/form-runs?activity=true", transform: pickPlatformActivity },
];

export default function PlatformDashboard() {
  const { t } = useI18n();
  // Both reads — including the cache-first paint that only fires once *both*
  // snapshots are fresh — belong to the hook, so the screen keeps no data state
  // of its own and never sets state from an effect.
  const { data, loading } = useApiMulti(PLATFORM_DASHBOARD_ENDPOINTS);
  const operationalStats = data.stats;
  const recentActivity = data.activity || [];

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
