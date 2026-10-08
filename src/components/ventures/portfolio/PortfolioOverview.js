"use client";

import React from "react";
import { Layers, LayoutDashboard, Loader2, Rocket } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import AppCard from "@/components/ui/AppCard";

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
 */

// Mirrors INVESTMENT_LEVELS in @/services/ventures/investmentReadiness. The
// counts arrive already bucketed; only the paint lives here.
const LEVEL_PAINT = {
  not_ready: "text-rose-400 bg-rose-500/10",
  early_ready: "text-amber-400 bg-amber-500/10",
  investment_ready: "text-emerald-400 bg-emerald-500/10",
  fundraising_ready: "text-[var(--brand-orange)] bg-brand-orange/10",
};

const LEVEL_BAR = {
  not_ready: "bg-rose-500",
  early_ready: "bg-amber-500",
  investment_ready: "bg-emerald-500",
  fundraising_ready: "bg-[var(--brand-orange)]",
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
    <AppCard padding="md" className="flex-1 min-w-[180px]">
      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
        {t(label)}
      </p>
      <p className="mt-2 flex items-baseline gap-2">
        <Icon className="w-4 h-4 text-[var(--brand-orange)] self-center" />
        <span className="text-2xl font-black text-[var(--text-primary)]">{value}</span>
      </p>
      {hint && (
        <p className="mt-1 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
          {t(hint)}
        </p>
      )}
    </AppCard>
  );
}

function CountList({ rows, labelFor }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return (
    <div className="space-y-1.5">
      {rows.map((row) => (
        <div key={row.key ?? "__none"} className="flex items-center gap-2 text-xs">
          <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text-primary)" }}>
            {labelFor(row)}
          </span>
          <span className="font-bold text-[var(--text-primary)]">{row.count}</span>
          <span className="w-10 text-right text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {total > 0 ? `${Math.round((row.count / total) * 100)}%` : "—"}
          </span>
        </div>
      ))}
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
  const maxBand = Math.max(1, ...byReadiness.map((band) => band.count));

  return (
    <div className="space-y-4">
      <div>
        <h1
          className="text-lg font-black uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2"
        >
          <LayoutDashboard className="w-4.5 h-4.5 text-[var(--brand-orange)]" /> {t("vadmin.portfolio.title")}
        </h1>
        <p className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
          {t("vadmin.portfolio.subtitle")}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <StatCard icon={Rocket} label="vadmin.portfolio.totalVentures" value={total} />
        <StatCard
          icon={Layers}
          label="vadmin.portfolio.activeParcours"
          value={activeParcours}
          hint="vadmin.portfolio.activeParcoursHint"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AppCard padding="md">
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "var(--text-secondary)" }}>
            {t("vadmin.portfolio.byPhase")}
          </p>
          <CountList
            rows={byPhase}
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
          <p className="text-[10px] font-black uppercase tracking-widest mb-3" style={{ color: "var(--text-secondary)" }}>
            {t("vadmin.portfolio.bySector")}
          </p>
          <CountList
            rows={bySector}
            labelFor={(row) => row.key || t("vadmin.portfolio.noSector")}
          />
        </AppCard>
      </div>

      <AppCard padding="md">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
            {t("vadmin.portfolio.byReadiness")}
          </p>
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {t("vadmin.portfolio.assessedOf", { assessed, total })}
          </p>
        </div>

        {assessed === 0 ? (
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            <p>{t("vadmin.portfolio.emptyReadiness")}</p>
            <p className="mt-1 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              {t("vadmin.portfolio.emptyReadinessHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {byReadiness.map((band) => (
              <div key={band.level} className="flex items-center gap-3 text-xs">
                <span
                  className={`w-40 shrink-0 px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                    LEVEL_PAINT[band.level] || "text-rose-400 bg-rose-500/10"
                  }`}
                >
                  {t(`vadmin.portfolio.levels.${band.level}`)}
                </span>
                <span
                  className={`h-2 rounded ${LEVEL_BAR[band.level] || "bg-rose-500"}`}
                  style={{ width: `${Math.round((band.count / maxBand) * 100)}%`, minWidth: band.count > 0 ? "4px" : "0" }}
                />
                <span className="font-bold text-[var(--text-primary)]">{band.count}</span>
              </div>
            ))}
          </div>
        )}
      </AppCard>
    </div>
  );
}
