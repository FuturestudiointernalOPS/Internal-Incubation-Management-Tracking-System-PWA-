import {
  ListTodo,
  CheckCircle2,
  TrendingUp,
  Shield,
  Users,
  Briefcase,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

export default function AnalyticsRow({ analytics }) {
  const { t } = useI18n();
  return (
    <>
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="card flex items-center gap-3 p-3">
          <div className="p-2 rounded-xl bg-white/5">
            <ListTodo className="w-3.5 h-3.5 text-[var(--text-primary)]" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("reports.tasks")}
            </p>
            <p className="text-base font-black">
              {analytics.tasks.total}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3">
          <div className="p-2 rounded-xl bg-emerald-500/10">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("reports.completed")}
            </p>
            <p className="text-base font-black text-emerald-500">
              {analytics.completionRate}%
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3">
          <div className="p-2 rounded-xl bg-amber-500/10">
            <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("reports.carriedOver")}
            </p>
            <p className="text-base font-black text-amber-500">
              {analytics.carryoverRate}%
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3">
          <div className="p-2 rounded-xl bg-rose-500/10">
            <Shield className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("reports.active")}
            </p>
            <p className="text-base font-black text-rose-500">
              {analytics.blockers.active}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <Users className="w-3.5 h-3.5 text-blue-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("reports.teamMembers")}
            </p>
            <p className="text-base font-black text-blue-500">
              {analytics.activeUsers}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3">
          <div className="p-2 rounded-xl bg-indigo-500/10">
            <Briefcase className="w-3.5 h-3.5 text-indigo-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("admin.activePrograms")}
            </p>
            <p className="text-base font-black text-indigo-500">
              {analytics.projects}
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3">
          <div className="p-2 rounded-xl bg-orange-500/10">
            <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("admin.activeBlockerRate")}
            </p>
            <p className="text-base font-black text-orange-500">
              {analytics.blockerRate}%
            </p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-3">
          <div className="p-2 rounded-xl bg-cyan-500/10">
            <Clock className="w-3.5 h-3.5 text-cyan-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
              {t("reports.avgResolution")}
            </p>
            <p className="text-base font-black text-cyan-500">
              {analytics.avgResolutionHours}h
            </p>
          </div>
        </div>
      </div>
      {analytics.weeklyProductivity?.length > 0 && (
        <div className="card p-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)]">
            {t("staff.opReport.productivity")}
          </p>
          <div className="flex items-end gap-2 h-16">
            {[...analytics.weeklyProductivity].reverse().map((weekStat) => {
              const max = Math.max(
                ...analytics.weeklyProductivity.map((weekEntry) => weekEntry.completed),
                1,
              );
              return (
                <div
                  key={`${weekStat.year}-${weekStat.week}`}
                  className="flex-1 h-full flex flex-col justify-end items-center gap-1"
                  title={`${t("staff.table.week")} ${weekStat.week}, ${weekStat.year}: ${weekStat.completed}`}
                >
                  <div
                    className="w-full bg-[var(--brand-orange)] opacity-60 rounded-t"
                    style={{
                      height: `${Math.max((weekStat.completed / max) * 100, 4)}%`,
                    }}
                  />
                  <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                    {weekStat.week}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
    </>
  );
}
