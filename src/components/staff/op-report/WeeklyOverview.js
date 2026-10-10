import { AlertTriangle, BarChart3, CheckCircle2, Clock, Mic, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { operationTotals, recentWeeks, regularity, weekRecord } from "@/components/staff/dashboardModel";

/**
 * The strip under the Weekly Ops title: four figures (stand-ups, retros,
 * blockers reported, regularity) and — for a stand-up or retro tab — whether
 * the week being looked at has been handed in.
 *
 * Everything is derived from the report history the page already reads
 * (`/api/op-reports?user_id=…`); nothing is fetched here.
 */
export default function WeeklyOverview({ history, now, reportType, weekInfo, existingReport, tasks = [] }) {
  const { t } = useI18n();
  const totals = operationTotals(history, tasks);
  const standing = regularity(recentWeeks(now).map((week) => weekRecord(history, week)), now);
  const tone = { regular: "g", at_risk: "w", inactive: "r" }[standing];
  const submitted = existingReport?.status === "submitted";
  const typed = reportType === "standup" || reportType === "retro";

  const kpi = (label, value, Icon) => (
    <div className="stf-card stf-kpi" key={label}>
      <div className="stf-k">
        <span>{label}</span>
        <Icon size={15} />
      </div>
      <div className="big">{value}</div>
    </div>
  );

  return (
    <>
      <div className="stf-grid">
        {kpi(t("reports.mondayStandup"), totals.standups, Mic)}
        {kpi(t("reports.fridayRetro"), totals.retros, RefreshCw)}
        {kpi(t("staffMisc.front.sectionB.blockersReported"), totals.blockers, AlertTriangle)}
        <div className="stf-card stf-kpi">
          <div className="stf-k">
            <span>{t("staffMisc.front.dashboard.regularity")}</span>
            <BarChart3 size={15} />
          </div>
          <div style={{ marginTop: 14 }}>
            <span className={`stf-tag ${tone}`} style={{ fontSize: 14, padding: "4px 12px" }}>
              {t(`staffMisc.front.regularity.${standing}`)}
            </span>
          </div>
        </div>
      </div>

      {typed && submitted && (
        <div className="stf-banner g">
          <CheckCircle2 size={20} />
          <div>
            <b>{t("staff.opReport.alreadySubmitted")}</b>
            <p>{t("staffMisc.front.dashboard.weekLabel", { week: weekInfo.week, year: weekInfo.year })}</p>
          </div>
        </div>
      )}
      {typed && !submitted && (
        <div className="stf-banner o">
          <Clock size={20} />
          <div>
            <b>{t("staffMisc.front.weekly.pendingTitle")}</b>
            <p>
              {t("staffMisc.front.dashboard.weekLabel", { week: weekInfo.week, year: weekInfo.year })} ·{" "}
              {reportType === "standup" ? t("reports.mondayStandup") : t("reports.fridayRetro")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
