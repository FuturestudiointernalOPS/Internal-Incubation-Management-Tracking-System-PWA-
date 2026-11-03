"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import AppBadge from "@/components/ui/AppBadge";
import SectionHead from "@/components/ui/SectionHead";

/**
 * THE VENTURE DASHBOARD — spec §12.
 *
 * Reads ONLY the calculated layer (through the API): stage, traffic light,
 * customers, revenue, health, team and the latest narrative. Nothing here
 * computes a figure; a metric that was not calculated shows as "not applicable".
 *
 * The same component serves the founder (read-only) and the studio.
 */

const LIGHT_VARIANT = {
  green: "success",
  amber: "warning",
  red: "danger",
  unknown: "default",
};

const localeFor = (lang) => (lang === "fr" ? "fr-FR" : "en-GB");

const number = (value, lang, digits = 0) =>
  value === null || value === undefined || !Number.isFinite(Number(value))
    ? "—"
    : new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: digits }).format(Number(value));

const percent = (value, lang) =>
  value === null || value === undefined ? "—" : `${number(value * 100, lang, 1)}%`;

export default function VentureDataDashboard({ ventureId }) {
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const base = `/api/ventures/${encodeURIComponent(ventureId)}/reporting/dashboard`;

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch(base);
    const payload = await response.json().catch(() => ({}));
    if (payload?.success) setData(payload);
    else setError(payload?.error || "errors.somethingWrong");
    setLoading(false);
  }, [base]);

  useEffect(() => {
    load();
  }, [load]);

  /** Chart rows: one per validated month, labelled `YYYY-MM`. */
  const rows = useMemo(
    () =>
      (data?.months || []).map((month) => ({
        label: String(month.period).slice(0, 7),
        paying: month.payingCustomers,
        northStar: month.northStarValue,
        revenue: month.totalRevenue?.value ?? null,
        retention: month.retention?.value ?? null,
        runway: month.runway?.value ?? null,
      })),
    [data],
  );

  if (loading) return <AppCard>{t("common.loading")}</AppCard>;
  if (!data) {
    return (
      <AppCard padding="normal">
        <p className="text-xs text-rose-500">{t(error || "errors.somethingWrong")}</p>
      </AppCard>
    );
  }

  const stage = data.stage || {};
  const light = data.trafficLight || { overall: "unknown", dimensions: [] };
  const percentProgress = Math.round((stage.progress || 0) * 100);

  return (
    <div className="space-y-5">
      <SectionHead
        title={t("venture.reporting.dashboard.title")}
        subtitle={t("venture.reporting.dashboard.subtitle")}
      />

      {!data.hasData ? (
        <AppCard padding="normal">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.reporting.dashboard.empty")}
          </p>
        </AppCard>
      ) : (
        <>
          {/* Health and stage at the top: the two things management reads first. */}
          <AppCard padding="normal" className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <AppBadge variant="brand" dot>
                {t("venture.reporting.stage.current")}:{" "}
                {t(`venture.reporting.stage.name.${stage.currentStage}`)}
              </AppBadge>
              {stage.nextStage && (
                <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {t("venture.reporting.stage.next")}:{" "}
                  {t(`venture.reporting.stage.name.${stage.nextStage}`)} · {percentProgress}% (
                  {stage.met}/{stage.total})
                </span>
              )}
              <AppBadge variant={LIGHT_VARIANT[light.overall] || "default"} dot>
                {t("venture.reporting.traffic.overall")}:{" "}
                {t(`venture.reporting.traffic.status.${light.overall}`)}
              </AppBadge>
              {light.dimensions?.map((dimension) => (
                <span
                  key={dimension.key}
                  className="text-[11px]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t(`venture.reporting.traffic.dimension.${dimension.key}`)}:{" "}
                  {t(`venture.reporting.traffic.status.${dimension.status}`)}
                </span>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  key: "payingCustomers",
                  value: number(data.latest.payingCustomers, lang),
                },
                { key: "retention", value: percent(data.latest.retention, lang) },
                { key: "runway", value: number(data.latest.runway?.value ?? null, lang, 1) },
                { key: "fte", value: number(data.latest.fte, lang, 1) },
              ].map((item) => (
                <div key={item.key} className="space-y-1">
                  <p
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {t(`venture.reporting.dashboard.kpi.${item.key}`)}
                  </p>
                  <p className="text-lg font-black" style={{ color: "var(--text-primary)" }}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </AppCard>

          {/* North star — the venture's own metric. */}
          <AppCard padding="normal" className="space-y-3">
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("venture.reporting.dashboard.northStar")}
              {data.northStar.name ? ` · ${data.northStar.name}` : ""}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black" style={{ color: "var(--text-primary)" }}>
                {number(data.northStar.latest, lang, 1)}
              </span>
              {data.northStar.unit && (
                <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {data.northStar.unit}
                </span>
              )}
            </div>
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="northStar"
                    name={data.northStar.name || t("venture.reporting.dashboard.northStar")}
                    stroke="var(--brand-orange)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </AppCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <AppCard padding="normal" className="space-y-3">
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("venture.reporting.dashboard.customers")}
              </p>
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="paying"
                      name={t("venture.reporting.dashboard.kpi.payingCustomers")}
                      stroke="var(--brand-orange)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AppCard>

            <AppCard padding="normal" className="space-y-3">
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("venture.reporting.dashboard.revenue")}
              </p>
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={60} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name={t("venture.reporting.dashboard.revenue")}
                      stroke="var(--stf-done, #10B981)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AppCard>
          </div>

          <AppCard padding="normal" className="space-y-3">
            <p
              className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("venture.reporting.dashboard.yearly.title")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { key: "yoyMrr", value: percent(data.yearly?.yoyMrrGrowth ?? null, lang) },
                {
                  key: "customerGrowth",
                  value: percent(data.yearly?.annualCustomerGrowth ?? null, lang),
                },
                { key: "annualBurn", value: number(data.yearly?.annualBurn ?? null, lang) },
                { key: "jobsSupported", value: number(data.yearly?.jobsSupported ?? null, lang, 1) },
                { key: "jobsCreated", value: number(data.yearly?.jobsCreated ?? null, lang, 1) },
                {
                  key: "financing",
                  value: data.yearly?.outsideFinancing
                    ? `${data.yearly.outsideFinancing.approximate ? "≈ " : ""}${number(
                        data.yearly.outsideFinancing.total,
                        lang,
                      )}`
                    : "—",
                },
              ].map((item) => (
                <div key={item.key} className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {t(`venture.reporting.dashboard.yearly.${item.key}`)}
                  </span>
                  <span className="text-[13px] font-bold" style={{ color: "var(--text-primary)" }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 border-t pt-3 text-[11px]" style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}>
              <span>
                {t("venture.reporting.dashboard.yearly.survival")}:{" "}
                {[12, 24, 36]
                  .map((months) =>
                    t("venture.reporting.dashboard.yearly.survivalMonths", {
                      months,
                      value:
                        data.yearly?.survival?.[`m${months}`] === null ||
                        data.yearly?.survival?.[`m${months}`] === undefined
                          ? t("venture.reporting.dashboard.yearly.pending")
                          : data.yearly.survival[`m${months}`]
                            ? t("common.yes")
                            : t("common.no"),
                    }),
                  )
                  .join(" · ")}
              </span>
            </div>

            {data.yearly?.timeInStages?.length > 0 && (
              <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                {t("venture.reporting.dashboard.yearly.timeInStage")}:{" "}
                {data.yearly.timeInStages
                  .map(
                    (row) =>
                      `${t(`venture.reporting.stage.name.${row.stage}`)} ${row.days} ${t(
                        "venture.reporting.dashboard.yearly.days",
                      )}`,
                  )
                  .join(" · ")}
              </p>
            )}
          </AppCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <AppCard padding="normal" className="space-y-2">
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("venture.reporting.dashboard.team")}
              </p>
              <p className="text-[12px]" style={{ color: "var(--text-primary)" }}>
                {t("venture.reporting.dashboard.womenShare")}:{" "}
                <strong>
                  {data.team?.womenShare === null || data.team?.womenShare === undefined
                    ? t("venture.reporting.notApplicable")
                    : `${data.team.womenShare}%`}
                </strong>
              </p>
              <p className="text-[12px]" style={{ color: "var(--text-primary)" }}>
                {t("venture.reporting.dashboard.youthShare")}:{" "}
                <strong>
                  {data.team?.youthShare === null || data.team?.youthShare === undefined
                    ? t("venture.reporting.notApplicable")
                    : `${data.team.youthShare}%`}
                </strong>
              </p>
            </AppCard>

            <AppCard padding="normal" className="space-y-2">
              <p
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("venture.reporting.dashboard.narrative")}
              </p>
              <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                {data.latest.narrative || t("venture.reporting.dashboard.noNarrative")}
              </p>
              {data.latest.period && (
                <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  {String(data.latest.period).slice(0, 7)}
                </p>
              )}
            </AppCard>
          </div>
        </>
      )}
    </div>
  );
}
