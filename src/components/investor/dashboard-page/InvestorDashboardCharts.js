"use client";

import { useMemo } from "react";
import { useI18n } from "@/lib/i18n";
import { PIPELINE_STAGES, STAGE_LABELS } from "./constants";

function BarList({ title, empty, rows }) {
  const max = Math.max(1, ...rows.map((row) => row.value));

  return (
    <section className="stf-card" aria-label={title}>
      <h2 className="stf-card-title">{title}</h2>
      {rows.length === 0 ? (
        <p className="stf-small mt-3">{empty}</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.label} className="grid grid-cols-[minmax(5rem,8rem)_1fr_auto] items-center gap-3">
              <span className="stf-small truncate">{row.label}</span>
              <span
                className="h-2 rounded-full bg-[var(--surface-3)]"
                role="img"
                aria-label={`${row.label}: ${row.value}`}
              >
                <span
                  className="block h-full rounded-full bg-[var(--brand-orange)]"
                  style={{ width: `${row.value === 0 ? 0 : Math.max(4, (row.value / max) * 100)}%` }}
                />
              </span>
              <span className="stf-small tabular-nums">{row.value}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function InvestorDashboardCharts({ pipeline, watchlist, weeklyActivity }) {
  const { t, lang } = useI18n();
  const stages = useMemo(() => PIPELINE_STAGES
    .filter((stage) => stage !== "declined")
    .map((stage) => ({
      label: t(STAGE_LABELS[stage]),
      value: pipeline.filter((entry) => entry.stage === stage).length,
    }))
    .filter((row) => row.value > 0), [pipeline, t]);
  const industries = useMemo(() => {
    const counts = new Map();
    const ventures = new Map([...pipeline, ...watchlist].map((entry) => [
      String(entry.venture_id),
      entry,
    ]));
    ventures.forEach((entry) => {
      const label = entry.industry || t("dashboardV2.unknownIndustry");
      counts.set(label, (counts.get(label) || 0) + 1);
    });
    return [...counts].map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value).slice(0, 8);
  }, [pipeline, watchlist, t]);
  const activity = useMemo(() => {
    const weeks = new Map((weeklyActivity || []).map((week) => [week.week, week]));
    const rows = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) - offset * 7);
      const key = date.toISOString().slice(0, 10);
      const week = weeks.get(key);
      rows.push({
        label: date.toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        value: Number(week?.views || 0) + Number(week?.interests || 0) + Number(week?.introductions || 0),
      });
    }
    return rows;
  }, [weeklyActivity, lang]);

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <BarList
        title={t("dashboardV2.pipelineByStage")}
        empty={t("dashboardV2.chartEmpty")}
        rows={stages}
      />
      <BarList
        title={t("dashboardV2.venturesByIndustry")}
        empty={t("dashboardV2.chartEmpty")}
        rows={industries}
      />
      <BarList
        title={t("dashboardV2.activityOverTime")}
        empty={t(weeklyActivity === null ? "dashboardV2.activityUnavailable" : "dashboardV2.chartEmpty")}
        rows={weeklyActivity === null ? [] : activity}
      />
    </div>
  );
}
