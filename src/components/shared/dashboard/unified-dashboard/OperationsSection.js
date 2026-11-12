"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Trophy,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { getWeekNumber } from "./constants";

/**
 * OPERATIONS SECTION — the weekly operations panel for staff/super_admin
 * dashboards: the stand-up and retro status for the current week, and the three
 * counters taken from the dashboard payload.
 *
 * All values are fetched live from the API — no hard-coded numbers. Extracted
 * verbatim from UnifiedDashboard, which keeps the dashboard read.
 */
export default function OperationsSection({ userId, summary }) {
  const { t } = useI18n();
  const router = useRouter();
  const [ops, setOps] = useState(null); // { week, year, standup, retro }

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const now = new Date();
    const week = getWeekNumber(now);
    const year = now.getFullYear();
    Promise.all([
      fetch(
        `/api/op-reports?user_id=${encodeURIComponent(userId)}&type=standup&week=${week}&year=${year}`,
      )
        .then((response) => response.json())
        .catch(() => ({ success: false })),
      fetch(
        `/api/op-reports?user_id=${encodeURIComponent(userId)}&type=retro&week=${week}&year=${year}`,
      )
        .then((response) => response.json())
        .catch(() => ({ success: false })),
    ]).then(([standupData, retroData]) => {
      if (cancelled) return;
      setOps({
        week,
        year,
        standup: standupData.success ? standupData.reports?.[0] || null : null,
        retro: retroData.success ? retroData.reports?.[0] || null : null,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const openTasks = summary?.tasks?.open || 0;
  const overdue = summary?.overdueTasks || 0;
  const activeBlockers = summary?.blockers?.active || 0;

  return (
    <div className="card !p-4 border-l-4 border-l-[var(--brand-orange)] space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-orange/10 flex items-center justify-center">
            <Activity className="w-5 h-5 text-[var(--brand-orange)]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-tight">
              {t("dashboard.weeklyOps")}
            </h3>
            <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5">
              {t("dashboard.weeklyOpsStatus", "Weekly stand-up & retro status")}
              {ops ? ` — ${t("time.week")} ${ops.week}, ${ops.year}` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/staff/op-report")}
          className="text-[10px] font-bold uppercase tracking-wide text-[var(--brand-orange)] hover:underline flex items-center gap-1"
        >
          {t("dashboard.openReport", "Open Report")} <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border-primary)] bg-secondary overflow-hidden">
        {/* Standup status */}
        <button
          onClick={() => router.push("/staff/op-report?tab=standup")}
          className="w-full flex items-center justify-between gap-2 p-3 cursor-pointer hover:bg-tertiary transition-all text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Calendar className="w-4 h-4 text-[var(--brand-orange)] shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                {t("reports.mondayStandup")}
              </p>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5 truncate">
                {ops === null
                  ? t("common.loading")
                  : ops.standup?.status === "submitted"
                    ? t("status.submitted")
                    : t("status.pending", "Pending")}
              </p>
            </div>
          </div>
          {ops?.standup?.status === "submitted" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          )}
        </button>

        <div className="h-px bg-[var(--border-primary)]" />

        {/* Retro status */}
        <button
          onClick={() => router.push("/staff/op-report?tab=retro")}
          className="w-full flex items-center justify-between gap-2 p-3 cursor-pointer hover:bg-tertiary transition-all text-left"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Trophy className="w-4 h-4 text-purple-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                {t("reports.fridayRetro")}
              </p>
              <p className="text-[10px] font-medium text-[var(--text-secondary)] mt-0.5 truncate">
                {ops === null
                  ? t("common.loading")
                  : ops.retro?.status === "submitted"
                    ? t("status.submitted")
                    : t("status.pending", "Pending")}
              </p>
            </div>
          </div>
          {ops?.retro?.status === "submitted" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          )}
        </button>
      </div>

      {/* Mini stats — derived from the dashboard API */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-[var(--border-primary)]">
        <div className="text-center pt-2">
          <p className="text-2xl font-black tracking-tight text-blue-400">{openTasks}</p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("dashboard.openTasks", "Open Tasks")}
          </p>
        </div>
        <div className="text-center pt-2">
          <p className="text-2xl font-black tracking-tight text-amber-400">{overdue}</p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("dashboard.overdue", "Overdue")}
          </p>
        </div>
        <div className="text-center pt-2">
          <p className="text-2xl font-black tracking-tight text-rose-400">
            {activeBlockers}
          </p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("dashboard.activeBlockers", "Blockers")}
          </p>
        </div>
      </div>
    </div>
  );
}
