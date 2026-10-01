"use client";

import { AlertTriangle, CheckCircle2, Clock, ChevronUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";

/**
 * The three accountability figures: staff reporting consistently, staff at
 * risk, and staff who never reported.
 * Extracted verbatim from app/admin/page.js.
 */
export function TeamSummaryStats({ staffReports, totalStaff }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
      <div className="card flex items-center gap-3 p-4 border-l-4 border-emerald-500">
        <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
        <div>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("admin.consistent")}
          </p>
          <p className="text-2xl font-black tracking-tight">
            {
              staffReports.filter(
                (staff) => staff.standups + staff.retros >= 4,
              ).length
            }
          </p>
        </div>
      </div>
      <div className="card flex items-center gap-3 p-4 border-l-4 border-amber-500">
        <Clock className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("admin.atRisk")}
          </p>
          <p className="text-2xl font-black tracking-tight">
            {
              staffReports.filter(
                (staff) =>
                  staff.standups + staff.retros > 0 &&
                  staff.standups + staff.retros < 4,
              ).length
            }
          </p>
        </div>
      </div>
      <div className="card flex items-center gap-3 p-4 border-l-4 border-rose-500">
        <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
        <div>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
            {t("admin.inactive")}
          </p>
          <p className="text-2xl font-black tracking-tight">
            {totalStaff - staffReports.length > 0
              ? totalStaff - staffReports.length
              : 0}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The per-staff reporting table, ordered by how much each person reported, with
 * a reliability badge and the date of their last report.
 * Extracted verbatim from app/admin/page.js.
 */
export function StaffReportTable({ staffReports, loading, lang }) {
  const { t } = useI18n();
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="text-left p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("reports.teamMembers")}
              </th>
              <th className="text-center p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("reports.mondayStandup")}
              </th>
              <th className="text-center p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("reports.fridayRetro")}
              </th>
              <th className="text-center p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("reports.blockers")}
              </th>
              <th className="text-center p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("common.filter")}
              </th>
              <th className="text-right p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest">
                {t("time.updated")}
              </th>
            </tr>
          </thead>
          <tbody>
            {staffReports
              .sort(
                (staffA, staffB) =>
                  staffB.standups +
                  staffB.retros -
                  (staffA.standups + staffA.retros),
              )
              .map((staff) => {
                const total = staff.standups + staff.retros;
                const status =
                  total >= 4
                    ? "active"
                    : total > 0
                      ? "at_risk"
                      : "inactive";
                return (
                  <tr
                    key={staff.id}
                    className="border-b border-divider/50 hover:bg-tertiary transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                          {staff.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
                            {staff.name}
                          </p>
                          <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase">
                            {staff.role}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="text-center p-4 text-sm font-bold">
                      {staff.standups}
                    </td>
                    <td className="text-center p-4 text-sm font-bold">
                      {staff.retros}
                    </td>
                    <td className="text-center p-4">
                      <span
                        className={`text-sm font-bold ${staff.blockers > 0 ? "text-rose-500" : "text-[var(--text-secondary)]"}`}
                      >
                        {staff.blockers}
                      </span>
                    </td>
                    <td className="text-center p-4">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
                          status === "active"
                            ? "bg-emerald-500/10 text-emerald-500"
                            : status === "at_risk"
                              ? "bg-amber-500/10 text-amber-500"
                              : "bg-rose-500/10 text-rose-500"
                        }`}
                      >
                        {status === "active"
                          ? t("status.active")
                          : status === "at_risk"
                            ? t("admin.atRisk")
                            : t("admin.inactive")}
                      </span>
                    </td>
                    <td className="text-right p-4 text-[10px] font-medium text-[var(--text-secondary)]">
                      {staff.latest
                        ? new Date(staff.latest).toLocaleDateString(lang)
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            {staffReports.length === 0 && !loading && (
              <tr>
                <td
                  colSpan={6}
                  className="p-8 text-center text-sm text-[var(--text-secondary)]"
                >
                  {t("reports.noReportsFound")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The link under the expanded table that collapses it again. */
export function CollapseTableButton({ onCollapse }) {
  const { t } = useI18n();
  return (
    <button
      onClick={onCollapse}
      className="w-full text-center py-2 text-[10px] font-bold text-[var(--text-secondary)] uppercase hover:text-[var(--text-primary)] transition-all"
    >
      <ChevronUp className="w-3 h-3 mx-auto" /> {t("common.showLess")}
    </button>
  );
}