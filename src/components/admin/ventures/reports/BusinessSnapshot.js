"use client";

import { useI18n } from "@/lib/i18n";
import KpiCard from "@/components/ui/KpiCard";
import SectionHead from "@/components/ui/SectionHead";
import TrajectoryChart from "./TrajectoryChart";
import {
  buildScorecard,
  latestMonth,
  money,
  num,
  pointValue,
  TONE,
  toneOf,
  dimensionStatus,
} from "./analysisModel";

/**
 * THE BUSINESS SNAPSHOT — items 1 and 2 of the studio's reading.
 *
 * The figures management reads first, from the latest validated month, then the
 * trajectory that led there. Revenue growth and customer growth are shown as
 * separate figures. Everything is read from the calculated layer; nothing is
 * recomputed here, and a metric the engine did not produce prints as « — ».
 */
export default function BusinessSnapshot({ dashboard, baseline }) {
  const { t, lang } = useI18n();
  const months = dashboard?.months || [];
  const month = latestMonth(months);
  const currency = month?.currency || dashboard?.latest?.currency || "XOF";

  if (!dashboard?.hasData) {
    return (
      <div className="space-y-4">
        <SectionHead title={t("vadmin.reportsBusiness.title")} subtitle={t("vadmin.reportsBusiness.subtitle")} />
        <div className="stf-card" style={{ padding: 18, textAlign: "center" }}>
          <p className="stf-small" style={{ margin: 0 }}>{t("vadmin.reportsBusiness.noData")}</p>
        </div>
      </div>
    );
  }

  const scorecard = buildScorecard({ dashboard, lang });

  const rows = months.map((entry) => ({
    label: String(entry.period || "").slice(0, 7),
    revenue: pointValue(entry.totalRevenue),
    customers: entry.payingCustomers ?? null,
    retention: pointValue(entry.retention) === null ? null : Math.round(pointValue(entry.retention) * 1000) / 10,
    runway: pointValue(entry.runway),
  }));

  const moneyTick = (value) => (Number.isFinite(Number(value)) ? num(value, lang) : "");

  return (
    <div className="space-y-5">
      <SectionHead title={t("vadmin.reportsBusiness.title")} subtitle={t("vadmin.reportsBusiness.subtitle")} />

      {/* ── 1. The twelve figures management reads first ── */}
      <div className="stf-grid c4">
        {scorecard.map((figure) => (
          <KpiCard
            key={figure.key}
            label={t(figure.labelKey)}
            value={figure.value}
            hint={figure.hint || undefined}
            compact
          />
        ))}
      </div>

      {/* ── Baseline → today: what the programme changed ── */}
      {baseline ? (
        <div className="stf-card" style={{ padding: 14, display: "grid", gap: 10 }}>
          <p className="stf-k" style={{ margin: 0 }}>
            {t("vadmin.reportsBusiness.baselineTitle")}
            {baseline.capturedAt ? ` · ${t("vadmin.reportsBusiness.since", { date: String(baseline.capturedAt).slice(0, 10) })}` : ""}
          </p>
          <div className="stf-grid c4">
            <KpiCard
              compact
              label={t("vadmin.reportsBusiness.baselineCustomers")}
              value={num(baseline.payingCustomers, lang)}
              hint={`→ ${num(month?.payingCustomers, lang)}`}
            />
            <KpiCard
              compact
              label={t("vadmin.reportsBusiness.baselineFte")}
              value={num(baseline.fte, lang, 1)}
              hint={`→ ${num(pointValue(month?.fte), lang, 1)}`}
            />
            <KpiCard
              compact
              label={t("vadmin.reportsBusiness.baselineCash")}
              value={
                baseline.cashMode === "band"
                  ? baseline.cashBand || "—"
                  : money(baseline.cashValue, baseline.currency || currency, lang)
              }
            />
            <KpiCard
              compact
              label={t("vadmin.reportsBusiness.runway")}
              value={num(pointValue(month?.runway), lang, 1)}
              hint={t(`venture.reporting.traffic.status.${dimensionStatus(dashboard, "runway")}`)}
              badge={dimensionStatus(dashboard, "runway") === "green" ? "OK" : undefined}
            />
          </div>
        </div>
      ) : (
        <p className="stf-small">{t("vadmin.reportsBusiness.noBaseline")}</p>
      )}

      {/* ── 2. The trajectory that produced those figures ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrajectoryChart
          title={t("vadmin.reportsCharts.revenueTitle")}
          subtitle={t("vadmin.reportsCharts.revenueSubtitle")}
          rows={rows}
          emptyLabel={t("vadmin.reportsBusiness.noData")}
          series={[{ key: "revenue", label: t("vadmin.reportsCharts.revenueTitle"), color: "var(--brand-orange)" }]}
          yTickFormatter={moneyTick}
          tooltipFormatter={(value) => money(value, currency, lang)}
        />
        <TrajectoryChart
          title={t("vadmin.reportsCharts.customersTitle")}
          subtitle={t("vadmin.reportsCharts.customersSubtitle")}
          rows={rows}
          emptyLabel={t("vadmin.reportsBusiness.noData")}
          series={[{ key: "customers", label: t("vadmin.reportsCharts.customersTitle"), color: "var(--stf-done, #10B981)" }]}
          tooltipFormatter={(value) => num(value, lang)}
        />
        <TrajectoryChart
          title={t("vadmin.reportsCharts.retentionTitle")}
          subtitle={t("vadmin.reportsCharts.retentionSubtitle")}
          rows={rows}
          emptyLabel={t("vadmin.reportsBusiness.noData")}
          series={[{ key: "retention", label: t("vadmin.reportsCharts.retentionTitle"), color: "var(--brand-orange)" }]}
          yTickFormatter={(value) => `${num(value, lang)}%`}
          tooltipFormatter={(value) => `${num(value, lang)}%`}
        />
        <TrajectoryChart
          title={t("vadmin.reportsCharts.runwayTitle")}
          subtitle={t("vadmin.reportsCharts.runwaySubtitle")}
          rows={rows}
          emptyLabel={t("vadmin.reportsBusiness.noData")}
          series={[{ key: "runway", label: t("vadmin.reportsCharts.runwayTitle"), color: toneColor(dimensionStatus(dashboard, "runway")) }]}
          tooltipFormatter={(value) => num(value, lang, 1)}
        />
      </div>
    </div>
  );
}

/** The runway line takes the traffic light's own colour. */
function toneColor(status) {
  const tone = toneOf(status);
  if (tone === TONE.bad) return "var(--status-red, #ef4444)";
  if (tone === TONE.warn) return "var(--status-amber, #f59e0b)";
  return "var(--stf-done, #10B981)";
}
