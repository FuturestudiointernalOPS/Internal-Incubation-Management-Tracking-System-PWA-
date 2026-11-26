"use client";

import { useMemo } from "react";
import SectionHead from "@/components/ui/SectionHead";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { BarChart3 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { STAGE_LABELS } from "./constants";

function HorizontalBars({ rows, labelKey, valueKey, emptyTitle, emptyHint, ariaLabel }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey] || 0)));
  if (rows.length === 0) {
    return (
      <AppEmptyState title={emptyTitle} description={emptyHint} icon={BarChart3} size="sm" />
    );
  }
  return (
    <div className="stf-card space-y-3 p-4">
      <div className="space-y-2" role="img" aria-label={ariaLabel}>
        {rows.map((row) => {
          const value = Number(row[valueKey] || 0);
          const width = `${Math.max(8, Math.round((value / max) * 100))}%`;
          return (
            <div key={String(row[labelKey])} className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)]">
                <span>{row._label || row[labelKey]}</span>
                <span>{value}</span>
              </div>
              <div className="h-2 rounded bg-[var(--surface-3)] overflow-hidden">
                <div className="h-full rounded bg-[var(--brand-orange)]/80" style={{ width }} />
              </div>
            </div>
          );
        })}
      </div>
      <ul className="stf-small space-y-1">
        {rows.map((row) => (
          <li key={`alt-${row[labelKey]}`}>
            {row._label || row[labelKey]}: {Number(row[valueKey] || 0)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Guide §9.4 — pipeline by stage, ventures by industry, activity over time.
 */
export default function InvestorDashboardCharts({
  weeklyActivity = [],
  pipelineByStage = [],
  venturesByIndustry = [],
}) {
  const { t } = useI18n();
  const activityRows = Array.isArray(weeklyActivity) ? weeklyActivity : [];

  const stageRows = useMemo(
    () => (pipelineByStage || []).map((row) => ({
      ...row,
      _label: t(STAGE_LABELS[row.stage] || "") || row.stage,
    })),
    [pipelineByStage, t],
  );

  const maxActivity = useMemo(() => {
    let peak = 1;
    for (const row of activityRows) {
      const total = Number(row.views || 0) + Number(row.interests || 0) + Number(row.introductions || 0);
      if (total > peak) peak = total;
    }
    return peak;
  }, [activityRows]);

  return (
    <section className="space-y-6" aria-labelledby="investor-charts-title">
      <SectionHead
        letter="C"
        tone="b"
        icon={BarChart3}
        title={t("dashboardV2.charts.sectionTitle")}
        subtitle={t("dashboardV2.charts.sectionHint")}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">
            {t("dashboardV2.charts.pipelineTitle")}
          </h3>
          <HorizontalBars
            rows={stageRows}
            labelKey="stage"
            valueKey="count"
            emptyTitle={t("dashboardV2.charts.pipelineEmpty")}
            emptyHint={t("dashboardV2.charts.pipelineEmptyHint")}
            ariaLabel={t("dashboardV2.charts.pipelineTitle")}
          />
        </div>
        <div>
          <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">
            {t("dashboardV2.charts.industryTitle")}
          </h3>
          <HorizontalBars
            rows={venturesByIndustry || []}
            labelKey="industry"
            valueKey="count"
            emptyTitle={t("dashboardV2.charts.industryEmpty")}
            emptyHint={t("dashboardV2.charts.industryEmptyHint")}
            ariaLabel={t("dashboardV2.charts.industryTitle")}
          />
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-black uppercase tracking-widest text-[var(--text-secondary)] mb-2">
          {t("dashboardV2.charts.activityTitle")}
        </h3>
        {activityRows.length === 0 ? (
          <AppEmptyState
            title={t("dashboardV2.charts.empty")}
            description={t("dashboardV2.charts.emptyHint")}
            icon={BarChart3}
            size="sm"
          />
        ) : (
          <div className="stf-card space-y-4 p-4">
            <div className="flex items-end gap-2 h-36" role="img" aria-label={t("dashboardV2.charts.activityTitle")}>
              {activityRows.slice(-12).map((row) => {
                const views = Number(row.views || 0);
                const interests = Number(row.interests || 0);
                const intros = Number(row.introductions || 0);
                const total = views + interests + intros;
                const height = `${Math.max(4, Math.round((total / maxActivity) * 100))}%`;
                return (
                  <div key={row.week || String(total)} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div className="w-full rounded-t bg-[var(--brand-orange)]/80" style={{ height }} title={`${row.week}: ${total}`} />
                    <span className="text-[9px] text-[var(--text-tertiary)] truncate w-full text-center">
                      {String(row.week || "").slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
            <ul className="stf-small space-y-1" aria-label={t("dashboardV2.charts.textAlt")}>
              {activityRows.slice(-12).map((row) => (
                <li key={`alt-${row.week}`}>
                  {row.week}: {t("dashboardV2.charts.views")} {Number(row.views || 0)},{" "}
                  {t("dashboardV2.charts.interests")} {Number(row.interests || 0)},{" "}
                  {t("dashboardV2.charts.introductions")} {Number(row.introductions || 0)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
