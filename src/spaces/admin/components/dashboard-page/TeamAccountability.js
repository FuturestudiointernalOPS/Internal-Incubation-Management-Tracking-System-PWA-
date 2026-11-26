"use client";

import { AlertTriangle, CheckCircle2, Clock, ChevronUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import StatusCard from "@/components/ui/StatusCard";

/**
 * The three accountability figures over the last four weeks: staff reporting
 * regularly, staff at risk, and inactive staff (the roster included, so someone
 * who never reported counts). Figures come from `accountabilityModel`.
 */
export function TeamSummaryStats({ accountability }) {
  const { t } = useI18n();
  const hint = t("admin.accountability.window");
  return (
    <div className="stf-grid g3">
      <StatusCard tone="g" icon={CheckCircle2} label={t("admin.consistent")} value={accountability.regular} hint={hint} />
      <StatusCard tone="o" icon={Clock} label={t("admin.atRisk")} value={accountability.atRisk} hint={hint} />
      <StatusCard tone="r" icon={AlertTriangle} label={t("admin.inactive")} value={accountability.inactive} hint={hint} />
    </div>
  );
}

const STATUS_STYLE = {
  regular: ["bg-emerald-500/10 text-emerald-500", "admin.consistent"],
  at_risk: ["bg-amber-500/10 text-amber-500", "admin.atRisk"],
  inactive: ["bg-rose-500/10 text-rose-500", "admin.inactive"],
};

/** This week's stand-up or retro: handed in, missing, or not due yet (null). */
function WeekMark({ value }) {
  const { t } = useI18n();
  if (value === null) {
    return <span className="text-[10px] font-bold uppercase text-[var(--text-tertiary)]">{t("admin.accountability.notDue")}</span>;
  }
  return value ? (
    <span className="text-[10px] font-bold uppercase text-emerald-500">{t("status.submitted")}</span>
  ) : (
    <span className="text-[10px] font-bold uppercase text-rose-500">{t("admin.accountability.missing")}</span>
  );
}

const th = "p-4 text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-widest";

/**
 * The per-person table: this week's Monday stand-up and Friday retro, how many
 * of the due ones were handed in over four weeks, their active blockers, their
 * regularity and their last report. Least regular first.
 */
export function StaffReportTable({ accountability, loading, lang }) {
  const { t } = useI18n();
  const { rows } = accountability;
  return (
    <div className="card !p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className={`text-left ${th}`}>{t("reports.teamMembers")}</th>
              <th className={`text-center ${th}`}>{t("reports.mondayStandup")}</th>
              <th className={`text-center ${th}`}>{t("reports.fridayRetro")}</th>
              <th className={`text-center ${th}`}>{t("admin.accountability.activeBlockers")}</th>
              <th className={`text-center ${th}`}>{t("admin.accountability.regularity")}</th>
              <th className={`text-right ${th}`}>{t("admin.accountability.lastReport")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((staff) => {
              const [tone, label] = STATUS_STYLE[staff.status];
              return (
                <tr key={staff.id} className="border-b border-divider/50 hover:bg-tertiary transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary border border-[var(--border-primary)] flex items-center justify-center text-[10px] font-bold uppercase">
                        {staff.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">{staff.name}</p>
                        <p className="text-[10px] font-medium text-[var(--text-secondary)] uppercase">{staff.role}</p>
                      </div>
                    </div>
                  </td>
                  <td className="text-center p-4">
                    <WeekMark value={staff.standupThisWeek} />
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      {t("admin.accountability.doneOfDue", staff.standups)}
                    </p>
                  </td>
                  <td className="text-center p-4">
                    <WeekMark value={staff.retroThisWeek} />
                    <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                      {t("admin.accountability.doneOfDue", staff.retros)}
                    </p>
                  </td>
                  <td className="text-center p-4">
                    <span className={`text-sm font-bold ${staff.blockers > 0 ? "text-rose-500" : "text-[var(--text-secondary)]"}`}>
                      {staff.blockers}
                    </span>
                  </td>
                  <td className="text-center p-4">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${tone}`}>{t(label)}</span>
                  </td>
                  <td className="text-right p-4 text-[10px] font-medium text-[var(--text-secondary)]">
                    {staff.latest ? new Date(staff.latest).toLocaleDateString(lang) : "—"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-sm text-[var(--text-secondary)]">
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
