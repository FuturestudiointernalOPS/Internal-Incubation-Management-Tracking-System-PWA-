"use client";

import { ClipboardCheck } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { complianceFrom, num } from "./analysisModel";

/**
 * REPORTED MONTHS — the founder's filing record, month by month.
 *
 * This is the compliance side of the same data the other tabs analyse: a month
 * that was never filed (or never validated) is why a figure elsewhere is « — »,
 * and saying so here is more useful than leaving the reader to guess.
 */
export default function ReportingPanel({ reports = [] }) {
  const { t, lang } = useI18n();
  const compliance = complianceFrom(reports);

  const rows = [...reports]
    .filter((report) => report?.period)
    .sort((a, b) => (String(a.period) < String(b.period) ? 1 : -1));

  return (
    <div className="space-y-5">
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ClipboardCheck size={15} style={{ color: "var(--brand-orange)" }} />
        <p className="stf-k" style={{ margin: 0 }}>{t("vadmin.reportsReporting.title")}</p>
      </div>
      <p className="stf-small" style={{ margin: 0 }}>{t("vadmin.reportsReporting.subtitle")}</p>

      <div className="stf-card" style={{ padding: 14, display: "flex", gap: 18, flexWrap: "wrap" }}>
        <span className="stf-small">
          {compliance.expected
            ? t("vadmin.reportsReporting.compliance", {
                filed: num(compliance.filed, lang),
                expected: num(compliance.expected, lang),
              })
            : t("vadmin.reportsReporting.noReports")}
        </span>
        {compliance.lastPeriod && (
          <span className="stf-small">
            {t("vadmin.reportsReporting.lastFiled", { date: compliance.lastPeriod })}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="stf-small">{t("vadmin.reportsReporting.noReports")}</p>
      ) : (
        <div className="stf-card" style={{ padding: 0, overflow: "hidden" }}>
          <table className="stf-tw" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>{t("vadmin.reportsReporting.month")}</th>
                <th>{t("vadmin.reportsReporting.status")}</th>
                <th>{t("vadmin.reportsReporting.version")}</th>
                <th>{t("vadmin.reportsReporting.currency")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((report) => (
                <tr key={`${report.period}-${report.version}-${report.status}`}>
                  <td>{String(report.period).slice(0, 7)}</td>
                  <td>{t(`venture.reporting.monthly.status.${report.status}`)}</td>
                  <td>{report.version ?? "—"}</td>
                  <td>{report.currency || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
