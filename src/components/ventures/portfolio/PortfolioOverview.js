"use client";

import React from "react";
import { ClipboardCheck, Layers, LayoutDashboard, Loader2, Rocket } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppCard from "@/components/ui/AppCard";
import AppEmptyState from "@/components/ui/AppEmptyState";

/**
 * Portfolio overview — the Super Admin's read on the whole portfolio.
 *
 * Four lenses over ONE dataset: Ventures by phase, Ventures by sector, the
 * distribution across the four investment-readiness levels, and how many
 * Parcours are running. It answers "where does the portfolio stand", never
 * "open this Venture" — a per-Venture dashboard already exists behind each row.
 *
 * Read-only, and deliberately without the KPI module: this is the launch
 * dashboard, so KPIs stay in the code and out of this view.
 *
 * Every lens draws the same way — label, proportional bar, count, share — so
 * the three cards can be read as one instrument rather than three tables.
 */

// Mirrors INVESTMENT_LEVELS in @/services/ventures/investmentReadiness. The
// counts arrive already bucketed; only the paint lives here.
const LEVEL_PAINT = {
  not_ready: "text-rose-400 bg-rose-500/10",
  early_ready: "text-amber-400 bg-amber-500/10",
  investment_ready: "text-emerald-400 bg-emerald-500/10",
  fundraising_ready: "text-[var(--brand-orange)] bg-brand-orange/10",
};

// The chart tokens rather than the status shades: these four are a
// distribution, not badges.
const LEVEL_BAR = {
  not_ready: "bg-[var(--chart-danger)]",
  early_ready: "bg-[var(--chart-warning)]",
  investment_ready: "bg-[var(--chart-success)]",
  fundraising_ready: "bg-[var(--chart-primary)]",
};

const PHASE_STAGE_KEY = {
  idea: "stageIdea",
  validation: "stageValidation",
  early_traction: "stageEarlyTraction",
  growth: "stageGrowth",
  scaling: "stageScaling",
};

function StatCard({ icon: Icon, label, value, hint }) {
  const { t } = useI18n();
  return (
    <AppCard padding="md" className="min-w-0">
      <div className="flex items-center gap-3">
        <span className="shrink-0 p-2 rounded-[var(--radius-md)] bg-brand-orange/10">
          <Icon className="w-4 h-4 text-[var(--brand-orange)]" />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] truncate">
            {t(label)}
          </p>
          <p className="mt-0.5 text-2xl font-black tracking-tight text-[var(--text-primary)]">
            {value}
          </p>
        </div>
      </div>
      {hint && (
        <p className="mt-2 text-[10px] font-medium text-[var(--text-tertiary)]">{t(hint)}</p>
      )}
    </AppCard>
  );
}

function BarList({ rows, labelFor, barClass }) {
  const { t } = useI18n();
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  if (rows.length === 0) {
    return <AppEmptyState size="sm" icon={Layers} title={t("vadmin.portfolio.emptyList")} />;
  }

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
        return (
          <div key={row.key ?? "__none"} className="flex items-center gap-2.5">
            <span className="w-28 shrink-0 truncate text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
              {labelFor(row)}
            </span>
            <span className="min-w-[40px] flex-1 h-1.5 rounded-full bg-surface-3">
              <span
                className={`block h-full rounded-full ${barClass}`}
                style={{ width: `${pct}%` }}
              />
            </span>
            <span className="text-sm font-bold text-[var(--text-primary)]">{row.count}</span>
            <span className="w-9 shrink-0 text-right text-[10px] font-medium text-[var(--text-tertiary)]">
              {total > 0 ? `${pct}%` : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function PortfolioOverview() {
  const { t } = useI18n();
  const { data, loading, error } = useApi("/api/admin/ventures/dashboard");

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t("common.loading")}
      </div>
    );
  }

  // The route answers an envelope — `{ success, portfolio }` — so the view has
  // to reach one level down. Aliasing `data` straight to `portfolio` made this
  // guard pass on a truthy envelope whose arrays were all undefined, which is
  // how the first render reached `.map()` on nothing.
  const portfolio = data?.portfolio;

  if (error || !portfolio) {
    return (
      <AppCard padding="md">
        <p className="text-xs text-rose-400">{t("vadmin.portfolio.loadFailed")}</p>
      </AppCard>
    );
  }

  const { byPhase, bySector, byReadiness, assessed, total, activeParcours } = portfolio;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-3 text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
          <span className="p-2 rounded-[var(--radius-md)] bg-brand-orange/10">
            <LayoutDashboard className="w-5 h-5 text-[var(--brand-orange)]" />
          </span>
          {t("vadmin.portfolio.title")}
        </h1>
        <p className="mt-1 text-[10px] font-medium text-[var(--text-secondary)]">
          {t("vadmin.portfolio.subtitle")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Rocket} label="vadmin.portfolio.totalVentures" value={total} />
        <StatCard
          icon={Layers}
          label="vadmin.portfolio.activeParcours"
          value={activeParcours}
          hint="vadmin.portfolio.activeParcoursHint"
        />
        <StatCard
          icon={ClipboardCheck}
          label="vadmin.portfolio.assessed"
          value={`${assessed}/${total}`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AppCard padding="md">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("vadmin.portfolio.byPhase")}
          </p>
          <BarList
            rows={byPhase}
            barClass="bg-[var(--brand-orange)]"
            labelFor={(row) => {
              if (!row.key) return t("vadmin.portfolio.noPhase");
              const stageKey = PHASE_STAGE_KEY[row.key];
              // An unrecognised phase shows as itself rather than being
              // silently relabelled "Idea", which would misfile it.
              return stageKey ? t(`vadmin.detail.${stageKey}`) : row.key;
            }}
          />
        </AppCard>

        <AppCard padding="md">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("vadmin.portfolio.bySector")}
          </p>
          <BarList
            rows={bySector}
            barClass="bg-[var(--brand-blue)]"
            labelFor={(row) => row.key || t("vadmin.portfolio.noSector")}
          />
        </AppCard>
      </div>

      <AppCard padding="md">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {t("vadmin.portfolio.byReadiness")}
          </p>
          <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
            {t("vadmin.portfolio.assessedOf", { assessed, total })}
          </p>
        </div>

        {assessed === 0 ? (
          <div className="text-xs text-[var(--text-secondary)]">
            <p>{t("vadmin.portfolio.emptyReadiness")}</p>
            <p className="mt-1 text-[10px] font-medium text-[var(--text-tertiary)]">
              {t("vadmin.portfolio.emptyReadinessHint")}
            </p>
          </div>
        ) : (
          // `assessed` is the sum of these four counts (portfolio service), so
          // the segments are sized against the same denominator they add up to.
          <>
            <div className="flex gap-1 mb-4 h-2.5">
              {byReadiness
                .filter((band) => band.count > 0)
                .map((band) => (
                  <span
                    key={band.level}
                    className={`h-full rounded-full ${LEVEL_BAR[band.level] || "bg-rose-500"}`}
                    style={{ width: `${(band.count / assessed) * 100}%` }}
                    title={`${t(`vadmin.portfolio.levels.${band.level}`)}: ${band.count}`}
                  />
                ))}
            </div>

            <div className="space-y-2">
              {byReadiness.map((band) => (
                <div key={band.level} className="flex items-center gap-3">
                  <span
                    className={`w-40 shrink-0 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                      LEVEL_PAINT[band.level] || "text-rose-400 bg-rose-500/10"
                    }`}
                  >
                    {t(`vadmin.portfolio.levels.${band.level}`)}
                  </span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    {band.count}
                  </span>
                  <span className="text-[10px] font-medium text-[var(--text-tertiary)]">
                    {Math.round((band.count / assessed) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </AppCard>
    </div>
  );
}
