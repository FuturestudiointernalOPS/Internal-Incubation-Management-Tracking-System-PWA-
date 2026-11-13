import { Play, Users, Send, Eye, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "./helpers";

export default function DashboardStats({ dashboardStats, t }) {
  if (!dashboardStats) return null;
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
      {[
        { label: t("platformMisc.runs.activeRuns"), value: dashboardStats.active_runs ?? 0, icon: Play, color: "text-emerald-500" },
        { label: t("platformMisc.runs.totalAssigned"), value: dashboardStats.total_assignments ?? 0, icon: Users, color: "text-blue-500" },
        { label: t("platformMisc.runs.submissions"), value: dashboardStats.total_submissions ?? 0, icon: Send, color: "text-indigo-500" },
        { label: t("platformMisc.runs.pendingReview"), value: dashboardStats.pending_reviews ?? 0, icon: Eye, color: "text-amber-500" },
        { label: t("platformMisc.runs.approvalRate"), value: (dashboardStats.approval_rate != null ? Math.round(dashboardStats.approval_rate) + "%" : "—"), icon: CheckCircle2, color: dashboardStats.approval_rate > 50 ? "text-emerald-500" : "text-rose-500" },
        { label: t("platformMisc.runs.overdue"), value: dashboardStats.overdue ?? 0, icon: AlertTriangle, color: (dashboardStats.overdue ?? 0) > 0 ? "text-rose-500" : "text-slate-500" },
      ].map((statCard) => (
        <div key={statCard.label} className="p-3.5 rounded-2xl bg-secondary border border-[var(--border-primary)] text-center">
          <p className={cn("text-xl font-black", statCard.color)}>{statCard.value}</p>
          <div className="flex items-center justify-center gap-1 mt-0.5">
            <statCard.icon className={cn("w-2.5 h-2.5", statCard.color)} />
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">{statCard.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
