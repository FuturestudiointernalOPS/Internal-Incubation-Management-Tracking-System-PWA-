import { useState, useMemo } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MONTHS } from "./constants";

export default function TrendsDashboard({ allReports }) {
  const { t } = useI18n();
  // Snapshot the clock once per render — reading it mid-render is impure.
  const [now] = useState(() => Date.now());
  // Monthly report volume
  const monthlyData = useMemo(() => {
    const groups = {};
    allReports.forEach((report) => {
      const createdDate = new Date(report.created_at);
      const key = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, "0")}`;
      const label = `${MONTHS[createdDate.getMonth()]} ${createdDate.getFullYear()}`;
      if (!groups[key])
        groups[key] = { label, key, standups: 0, retros: 0, blockers: 0 };
      if (report.report_type === "standup") groups[key].standups++;
      else groups[key].retros++;
      if (report.has_blockers) groups[key].blockers++;
    });
    return Object.values(groups).sort((groupA, groupB) =>
      groupA.key.localeCompare(groupB.key),
    );
  }, [allReports]);

  const maxMonthly = Math.max(
    ...monthlyData.map((month) => month.standups + month.retros),
    1,
  );

  // Blocker trend
  const blockerTrend = monthlyData
    .filter((month) => month.blockers > 0)
    .slice(-6);
  const maxBlockers = Math.max(
    ...blockerTrend.map((month) => month.blockers),
    1,
  );

  // Recent staff activity
  const recentStaff = useMemo(() => {
    const userMap = {};
    allReports.forEach((report) => {
      if (!userMap[report.user_id])
        userMap[report.user_id] = {
          id: report.user_id,
          name: report.user_name,
          role: report.user_role,
          latest: null,
          total: 0,
        };
      userMap[report.user_id].total++;
      if (
        !userMap[report.user_id].latest ||
        new Date(report.created_at) > new Date(userMap[report.user_id].latest)
      ) {
        userMap[report.user_id].latest = report.created_at;
      }
    });
    return Object.values(userMap)
      .sort((staffA, staffB) => new Date(staffB.latest) - new Date(staffA.latest))
      .slice(0, 8);
  }, [allReports]);

  return (
    <div className="space-y-8">
      {/* Monthly Report Volume Chart */}
      <div className="card">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-6">
          {t("reports.monthlyReportVolume")}
        </h3>
        <div className="space-y-3">
          {monthlyData.slice(-6).map((month) => {
            const total = month.standups + month.retros;
            return (
              <div key={month.key}>
                <div className="flex items-center justify-between text-[10px] font-bold text-[var(--text-secondary)] mb-1">
                  <span>{month.label}</span>
                  <span className="font-black text-[var(--text-primary)]">
                    {t("reports.nReports", { count: total })}
                  </span>
                </div>
                <div className="w-full h-5 bg-primary rounded-lg overflow-hidden flex">
                  <div
                    className="h-full bg-[var(--brand-orange)] transition-all"
                    style={{ width: `${(month.standups / maxMonthly) * 100}%` }}
                  />
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${(month.retros / maxMonthly) * 100}%` }}
                  />
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] font-medium text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-orange)]" />{" "}
                    {t("reports.nStandups", { count: month.standups })}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{" "}
                    {t("reports.nRetros", { count: month.retros })}
                  </span>
                  {month.blockers > 0 && (
                    <span className="flex items-center gap-1 text-rose-500">
                      <AlertTriangle className="w-2.5 h-2.5" />{" "}
                      {t("reports.nBlockers", { count: month.blockers })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Blocker Trend */}
        <div className="card">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
            {t("reports.blockersOverTime")}
          </h3>
          {blockerTrend.length > 0 ? (
            <div className="space-y-2.5">
              {blockerTrend.map((month) => (
                <div key={month.key}>
                  <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                    <span className="text-[var(--text-secondary)]">
                      {month.label}
                    </span>
                    <span className="text-rose-500 font-black">
                      {t("reports.nBlockers", { count: month.blockers })}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-primary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full transition-all"
                      style={{ width: `${(month.blockers / maxBlockers) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-40" />
              <p className="text-sm text-[var(--text-secondary)]">
                {t("reports.noBlockersReported")}
              </p>
            </div>
          )}
        </div>

        {/* Recently Active Staff */}
        <div className="card">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] mb-4">
            {t("reports.recentlyActive")}
          </h3>
          <div className="space-y-2">
            {recentStaff.map((staff) => (
              <div
                key={staff.id}
                className="flex items-center justify-between p-3 rounded-lg bg-primary border border-[var(--border-primary)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-tertiary flex items-center justify-center text-[10px] font-bold uppercase">
                    {staff.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wide">
                      {staff.name}
                    </p>
                    <p className="text-[10px] font-medium text-[var(--text-secondary)]">
                      {t("reports.nReports", { count: staff.total })} ·{" "}
                      {new Date(staff.latest).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <span
                  className={`w-2 h-2 rounded-full ${new Date(staff.latest) > new Date(now - 7 * 86400000) ? "bg-emerald-500" : "bg-amber-500"}`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
