"use client";

import React from "react";
import {
  TrendingUp,
  Building2,
  AlertTriangle,
  GraduationCap,
  Users,
  UserCog,
  Handshake,
  Activity,
  CheckCircle2,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/hooks/useApi";
import { formatLabel } from "@/lib/constants";

const LEVEL_STYLES = {
  not_ready: "text-rose-400 bg-rose-500/10 border-rose-500/20",
  early_ready: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  investment_ready: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  fundraising_ready: "text-[var(--brand-orange)] bg-brand-orange/10 border-brand-orange/20",
};

const LEVEL_BAR_CLASSES = {
  not_ready: "bg-[var(--chart-danger)]",
  early_ready: "bg-[var(--chart-warning)]",
  investment_ready: "bg-[var(--chart-success)]",
  fundraising_ready: "bg-[var(--brand-orange)]",
};

function MetricCard({ icon: Icon, label, value, hint, accentClass }) {
  return (
    <div className="rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-5">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${accentClass ?? "bg-brand-orange/10 text-[var(--brand-orange)]"}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-black tracking-tighter text-[var(--text-primary)] leading-none">
            {value}
          </p>
          <p className="mt-1 text-xs font-medium text-[var(--text-secondary)] truncate">
            {label}
          </p>
        </div>
      </div>
      {hint ? <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">{hint}</p> : null}
    </div>
  );
}

function SectionCard({ title, subtitle, children, className }) {
  return (
    <div className={`rounded-2xl border border-[var(--border-primary)] bg-surface-2 p-5 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--text-primary)]">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--text-tertiary)]">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function ReadinessLevel({ labelKey, level, count, assessed }) {
  const pct = assessed > 0 ? Math.round((count / assessed) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={`w-32 shrink-0 text-xs font-semibold ${LEVEL_STYLES[level]?.split(" ")[0] ?? "text-[var(--text-secondary)]"}`}>
        {labelKey}
      </span>
      <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
        <div className={`h-full rounded-full ${LEVEL_BAR_CLASSES[level]}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-bold text-[var(--text-primary)]">{count}</span>
      <span className="w-12 text-right text-[11px] text-[var(--text-tertiary)]">{pct}%</span>
    </div>
  );
}

function PipelineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border-primary)] bg-surface-1 px-3 py-2 shadow-lg">
      <p className="text-xs font-bold text-[var(--text-primary)]">{label}</p>
      <p className="text-xs" style={{ color: payload[0].fill }}>
        {payload[0].value}
      </p>
    </div>
  );
}

const HEALTH_STYLES = {
  on_track: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  at_risk: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  critical: "text-rose-400 bg-rose-500/10 border-rose-500/20",
};

function HealthBadge({ status, t }) {
  const label =
    status === "on_track"
      ? t("adminMisc.intelligence.healthy")
      : status === "at_risk"
        ? t("adminMisc.intelligence.atRisk")
        : t("adminMisc.intelligence.critical");
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
        HEALTH_STYLES[status] ?? "text-[var(--text-secondary)] bg-surface-3 border-[var(--border-primary)]"
      }`}
    >
      {label}
    </span>
  );
}

function formatDuration(seconds, t) {
  const value = Number(seconds);
  if (seconds === null || seconds === undefined || Number.isNaN(value)) return "—";
  const totalMin = Math.round(value / 60);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}${t("adminMisc.intelligence.unitDay")} ${hours}${t("adminMisc.intelligence.unitHour")}`;
  if (hours > 0) return `${hours}${t("adminMisc.intelligence.unitHour")} ${minutes}${t("adminMisc.intelligence.unitMinute")}`;
  return `${minutes}${t("adminMisc.intelligence.unitMinute")}`;
}

export default function IntelligencePage() {
  const { t } = useI18n();
  const { data, loading, error, refresh } = useApi("/api/intelligence/metrics", {
    defaultValue: null,
  });

  const fmtCount = (n) => new Intl.NumberFormat("en-US").format(n ?? 0);
  const fmtCurrency = (n) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n ?? 0);

  const ventures = data?.ventures;
  const investor = data?.investor;
  const programs = data?.programs;
  const operations = data?.operations;

  const pipelineData = (investor?.pipeline ?? []).map((row) => ({
    stage: formatLabel(row.stage || t("adminMisc.intelligence.total")),
    count: row.count,
  }));

  const sheet = investor?.spreadsheet;
  const sheetReady = Boolean(sheet?.ok) && (sheet?.rows?.length ?? 0) > 0;

  const tasks = operations?.tasks ?? {};
  const blockers = operations?.blockers ?? {};
  const compliance = operations?.report_compliance ?? {};
  const contacts = data?.contacts ?? {};
  const crmStats = contacts.contacts ?? {};
  const growthMonthly = contacts.growth?.monthly ?? [];
  const growthMax = Math.max(1, ...growthMonthly.map((m) => Number(m.created) || 0));

  const readinessLevels =
    ventures?.readiness?.by_level
      ? [
          { level: "not_ready", labelKey: t("adminMisc.intelligence.notReady"), count: ventures.readiness.by_level.not_ready },
          { level: "early_ready", labelKey: t("adminMisc.intelligence.earlyReady"), count: ventures.readiness.by_level.early_ready },
          { level: "investment_ready", labelKey: t("adminMisc.intelligence.investmentReady"), count: ventures.readiness.by_level.investment_ready },
          { level: "fundraising_ready", labelKey: t("adminMisc.intelligence.fundraisingReady"), count: ventures.readiness.by_level.fundraising_ready },
        ]
      : [];

  const readinessCategories = ventures?.readiness?.by_category ?? [];
  const categoryKeys = {
    startup_profile: "startupProfile",
    legal: "legal",
    financial: "financial",
    product: "product",
    traction: "traction",
    market_validation: "marketValidation",
    business_model: "businessModel",
    team: "team",
    technology: "technology",
    pitch_readiness: "pitchReadiness",
  };
  const invitedCount = (crmStats.sent || 0) + (crmStats.expired || 0);

  return (
    <>
      <div className="p-6 space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-orange/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-[var(--brand-orange)]" />
              </div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
                {t("adminMisc.intelligence.title")}
              </h1>
            </div>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {t("adminMisc.intelligence.subtitle")}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--border-primary)] bg-surface-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-surface-3 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {t("common.refresh")}
          </button>
        </header>

        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-6 h-6 text-[var(--brand-orange)] animate-spin" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-sm text-rose-400">
            {t("adminMisc.intelligence.errorFetch")}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              <MetricCard
                icon={Building2}
                label={t("adminMisc.intelligence.totalVentures")}
                value={fmtCount(ventures.total_ventures)}
                accentClass="bg-brand-orange/10 text-[var(--brand-orange)]"
              />
              <MetricCard
                icon={AlertTriangle}
                label={t("adminMisc.intelligence.overdueMilestones")}
                value={fmtCount(ventures.overdue_milestones)}
                accentClass="bg-rose-500/10 text-rose-400"
              />
              <MetricCard
                icon={GraduationCap}
                label={t("adminMisc.intelligence.activePrograms")}
                value={fmtCount(programs.active_programs)}
                accentClass="bg-emerald-500/10 text-emerald-400"
              />
              <MetricCard
                icon={UserCog}
                label={t("adminMisc.intelligence.staff")}
                value={fmtCount(programs.staff)}
                accentClass="bg-amber-500/10 text-amber-400"
              />
              <MetricCard
                icon={Users}
                label={t("adminMisc.intelligence.participants")}
                value={fmtCount(programs.participants)}
                accentClass="bg-blue-500/10 text-blue-400"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SectionCard
                title={t("adminMisc.intelligence.ventureReadiness")}
                subtitle={t("adminMisc.intelligence.ventures")}
              >
                <div className="flex flex-wrap gap-4 mb-5">
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-3xl font-black tracking-tighter text-[var(--text-primary)]">
                      {ventures.readiness.avg_score}
                      <span className="text-base font-bold text-[var(--text-tertiary)]">/100</span>
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">
                      {t("adminMisc.intelligence.avgReadinessScore")}
                    </p>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <p className="text-3xl font-black tracking-tighter text-[var(--text-primary)]">
                      {fmtCount(ventures.readiness.assessed)}
                    </p>
                    <p className="mt-1 text-xs font-medium text-[var(--text-secondary)]">
                      {t("adminMisc.intelligence.assessed")} · {fmtCount(ventures.readiness.unassessed)} {t("adminMisc.intelligence.unassessed")}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl bg-surface-3 p-4 mb-5">
                  <p className="text-[11px] font-medium text-[var(--text-secondary)] mb-1">
                    {t("adminMisc.intelligence.readinessBreakdown")}
                  </p>
                  <p className="text-[11px] text-[var(--text-tertiary)] mb-3">
                    {t("adminMisc.intelligence.readinessHint")}
                  </p>
                  {readinessCategories.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
                      {readinessCategories.map((c) => (
                        <div key={c.category} className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-[var(--text-secondary)] truncate">
                            {t(`adminMisc.intelligence.category.${categoryKeys[c.category] || c.category}`)}
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="h-1.5 w-14 rounded-full bg-[var(--surface-1)] overflow-hidden">
                              <span
                                className="block h-full rounded-full bg-[var(--brand-orange)]"
                                style={{ width: `${Math.min(100, c.avg_score)}%` }}
                              />
                            </span>
                            <span className="text-xs font-bold text-[var(--text-primary)] w-7 text-right">{fmtCount(c.avg_score)}</span>
                            <span className="text-[10px] text-[var(--text-tertiary)] w-9 text-right">· {c.weight}%</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--text-tertiary)]">{t("adminMisc.intelligence.noData")}</p>
                  )}
                </div>
                <div className="space-y-3">
                  {readinessLevels.map((item) => (
                    <ReadinessLevel
                      key={item.level}
                      labelKey={item.labelKey}
                      level={item.level}
                      count={item.count}
                      assessed={ventures.readiness.assessed}
                    />
                  ))}
                </div>
              </SectionCard>

              <SectionCard
                title={t("adminMisc.intelligence.investmentPipeline")}
                subtitle={t("adminMisc.intelligence.investor")}
              >
                {pipelineData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={pipelineData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                      <CartesianGrid stroke="var(--border-primary)" horizontal={false} strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="stage"
                        width={110}
                        tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<PipelineTooltip />} cursor={{ fill: "var(--surface-2)" }} />
                      <Bar dataKey="count" fill="var(--brand-orange)" radius={[0, 6, 6, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-[var(--text-tertiary)]">{t("adminMisc.intelligence.noData")}</p>
                )}
              </SectionCard>

              <SectionCard
                title={t("adminMisc.intelligence.fundraising")}
                subtitle={t("adminMisc.intelligence.investor")}
              >
                {sheetReady ? (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-3 px-2.5 py-1">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                        {t("adminMisc.intelligence.spreadsheetSource")} · {t("adminMisc.intelligence.spreadsheetViewOnly")}
                      </span>
                      <span>
                        {t("adminMisc.intelligence.spreadsheetUpdatedAt")}:{" "}
                        <strong className="text-[var(--text-primary)]">
                          {new Date(sheet.updated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </strong>
                      </span>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)]">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-primary)]">
                            {sheet.columns.map((col, i) => (
                              <th key={i} className="py-2 px-3 font-semibold whitespace-nowrap max-w-[240px] truncate">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheet.rows.slice(1).map((row, r) => (
                            <tr key={r} className="border-b border-divider/50 last:border-0">
                              {sheet.columns.map((_, i) => (
                                <td key={i} className="py-2 px-3 whitespace-nowrap max-w-[240px] truncate text-[var(--text-secondary)]">
                                  {row[i] || "—"}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : sheet && sheet.configured ? (
                  <div className="rounded-xl bg-surface-3 px-4 py-6 text-center">
                    <p className="text-sm text-[var(--text-tertiary)]">
                      {sheet.ok ? t("adminMisc.intelligence.spreadsheetEmpty") : t("adminMisc.intelligence.spreadsheetUnavailable")}
                    </p>
                    {!sheet.ok && sheet.error ? (
                      <p className="mt-1 text-[11px] text-rose-400/80 break-words">{sheet.error}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-lg font-black tracking-tighter text-[var(--text-primary)]">
                        {fmtCurrency(investor.fundraising.total_sought)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("adminMisc.intelligence.totalSought")}</p>
                    </div>
                    <div>
                      <p className="text-lg font-black tracking-tighter text-[var(--text-primary)]">
                        {fmtCurrency(investor.fundraising.total_raised)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("adminMisc.intelligence.totalRaised")}</p>
                    </div>
                    <div>
                      <p className="text-lg font-black tracking-tighter text-[var(--text-primary)]">
                        {fmtCurrency(investor.fundraising.total_committed)}
                      </p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("adminMisc.intelligence.totalCommitted")}</p>
                    </div>
                  </div>
                )}
                <div className="mt-5 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Handshake className="w-4 h-4 text-[var(--brand-orange)]" />
                    <span className="text-xs text-[var(--text-secondary)]">
                      {t("adminMisc.intelligence.activeRelationships")}:{" "}
                      <strong className="text-[var(--text-primary)]">{fmtCount(investor.relationships.active_relationships)}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-[var(--text-secondary)]">
                      {t("adminMisc.intelligence.totalInvested")}:{" "}
                      <strong className="text-[var(--text-primary)]">{fmtCount(investor.relationships.total_invested)}</strong>
                    </span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title={t("adminMisc.intelligence.programHealth")}
                subtitle={t("adminMisc.intelligence.programs")}
              >
                {programs.kpis.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-[var(--text-tertiary)] border-b border-[var(--border-primary)]">
                          <th className="py-2 font-semibold">{t("adminMisc.intelligence.program")}</th>
                          <th className="py-2 font-semibold">{t("adminMisc.intelligence.health")}</th>
                          <th className="py-2 font-semibold text-right">{t("adminMisc.intelligence.avgKpiRate")}</th>
                          <th className="py-2 font-semibold text-right">{t("adminMisc.intelligence.engagement")}</th>
                          <th className="py-2 font-semibold text-right">{t("adminMisc.intelligence.submissionRate")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {programs.kpis.slice(0, 8).map((kp) => (
                          <tr key={kp.id} className="border-b border-divider/50 last:border-0">
                            <td className="py-2.5 pr-3">
                              <p className="font-medium text-[var(--text-primary)]">{kp.name}</p>
                              <p className="text-[11px] text-[var(--text-tertiary)]">{formatLabel(kp.status)}</p>
                            </td>
                            <td className="py-2.5 pr-3">
                              <HealthBadge status={kp.health_status} t={t} />
                            </td>
                            <td className="py-2.5 text-right px-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                                <Activity className="w-3.5 h-3.5 text-[var(--brand-orange)]" />
                                {fmtCount(kp.avg_kpi_rate)}%
                              </span>
                            </td>
                            <td className="py-2.5 text-right px-2 text-xs font-medium text-[var(--text-secondary)]">
                              {fmtCount(kp.submitters)}/{fmtCount(kp.participants)} · {fmtCount(kp.engagement_rate)}%
                            </td>
                            <td className="py-2.5 text-right text-xs font-medium text-[var(--text-secondary)]">
                              {fmtCount(kp.submission_rate)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-tertiary)]">{t("adminMisc.intelligence.noData")}</p>
                )}
              </SectionCard>

              <SectionCard
                title={t("adminMisc.intelligence.operations")}
                subtitle={t("adminMisc.intelligence.weekCaption", { week: operations.week, year: operations.year })}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl bg-surface-3 p-4">
                    <p className="text-xl font-black text-[var(--text-primary)]">{fmtCount(tasks.total)}</p>
                    <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">{t("adminMisc.intelligence.tasks")} · {t("adminMisc.intelligence.total")}</p>
                  </div>
                  <div className="rounded-xl bg-surface-3 p-4">
                    <p className="text-xl font-black text-emerald-400">{fmtCount(tasks.completed)}</p>
                    <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">{t("adminMisc.intelligence.completed")}</p>
                  </div>
                  <div className="rounded-xl bg-surface-3 p-4">
                    <p className="text-xl font-black text-amber-400">{fmtCount(tasks.in_progress)}</p>
                    <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">{t("adminMisc.intelligence.inProgress")}</p>
                  </div>
                  <div className="rounded-xl bg-surface-3 p-4">
                    <p className="text-xl font-black text-rose-400">{fmtCount(tasks.blocked)}</p>
                    <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">{t("adminMisc.intelligence.blocked")}</p>
                  </div>
                  <div className="rounded-xl bg-surface-3 p-4">
                    <p className="text-xl font-black text-[var(--text-primary)]">{fmtCount(tasks.carried_over)}</p>
                    <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">{t("adminMisc.intelligence.carriedOver")}</p>
                  </div>
                  <div className="rounded-xl bg-surface-3 p-4">
                    <p className="text-xl font-black text-[var(--text-primary)]">{fmtCount(tasks.pending)}</p>
                    <p className="mt-1 text-[11px] font-medium text-[var(--text-secondary)]">{t("adminMisc.intelligence.pending")}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="flex items-center justify-between rounded-xl bg-surface-3 px-4 py-3">
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">{t("adminMisc.intelligence.blockers")}</span>
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      {fmtCount(blockers.total)} · <span className="text-rose-400">{fmtCount(blockers.active)}</span>
                    </span>
                  </div>
                  <div className="rounded-xl bg-surface-3 px-4 py-3">
                    <p className="text-[11px] font-medium text-[var(--text-secondary)]">{t("adminMisc.intelligence.completionRate")}</p>
                    <p className="mt-1 text-lg font-black text-emerald-400">{fmtCount(operations.completion_rate)}%</p>
                  </div>
                  <div className="rounded-xl bg-surface-3 px-4 py-3">
                    <p className="text-[11px] font-medium text-[var(--text-secondary)]">{t("adminMisc.intelligence.carryoverRate")}</p>
                    <p className="mt-1 text-lg font-black text-amber-400">{fmtCount(operations.carryover_rate)}%</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-surface-3 px-4 py-3 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">{t("adminMisc.intelligence.avgBlockerTime")}</span>
                  <span className="text-sm font-bold text-[var(--text-primary)]">{formatDuration(operations.avg_blocker_seconds, t)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-3 px-4 py-3">
                  <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                    {t("adminMisc.intelligence.reportCompliance")}
                  </span>
                  <span className="text-xs text-[var(--text-secondary)]">
                    {t("adminMisc.intelligence.standupsSubmitted")}:{" "}
                    <strong className="text-[var(--text-primary)]">{fmtCount(compliance.standups_submitted)}</strong> / {fmtCount(compliance.staff)} · {fmtCount(compliance.standup_rate)}%
                    <span className="mx-2 text-[var(--text-tertiary)]">·</span>
                    {t("adminMisc.intelligence.retrosSubmitted")}:{" "}
                    <strong className="text-[var(--text-primary)]">{fmtCount(compliance.retros_submitted)}</strong> / {fmtCount(compliance.staff)} · {fmtCount(compliance.retro_rate)}%
                  </span>
                </div>
              </SectionCard>

<SectionCard
                  title={t("adminMisc.intelligence.crmTitle")}
                  subtitle={t("adminMisc.intelligence.invitationActivation")}
                >
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-lg font-black tracking-tighter text-[var(--text-primary)]">{fmtCount(crmStats.activated)}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("adminMisc.intelligence.activated")}</p>
                    </div>
                    <div>
                      <p className="text-lg font-black tracking-tighter text-[var(--text-primary)]">{fmtCount(crmStats.sent)}</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("adminMisc.intelligence.crmWaiting")}</p>
                    </div>
                    <div>
                      <p className="text-lg font-black tracking-tighter text-[var(--brand-orange)]">{fmtCount(crmStats.activation_rate)}%</p>
                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{t("adminMisc.intelligence.activationRate")}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-3 px-4 py-3">
                    <span className="text-[11px] font-medium text-[var(--text-secondary)]">
                      {t("adminMisc.intelligence.registryStatus")}
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">
                      {t("adminMisc.intelligence.contactsTotal")}:{" "}
                      <strong className="text-[var(--text-primary)]">{fmtCount(crmStats.total)}</strong>
                      <span className="mx-2 text-[var(--text-tertiary)]">·</span>
                      {t("adminMisc.intelligence.invited")}:{" "}
                      <strong className="text-[var(--text-primary)]">{fmtCount(invitedCount)}</strong>
                      <span className="mx-2 text-[var(--text-tertiary)]">·</span>
                      {t("adminMisc.intelligence.invitationsExpired")}: {fmtCount(crmStats.expired)}
                    </span>
                  </div>
                <div className="mt-5 border-t border-[var(--border-primary)] pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--text-secondary)]">{t("adminMisc.intelligence.contactGrowth")}</span>
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {fmtCount(contacts.growth.total)} · {t("adminMisc.intelligence.contactsTotal")}
                    </span>
                  </div>
                  <div className="mt-3 flex items-end gap-1.5 h-16">
                    {growthMonthly.map((m) => (
                      <div
                        key={m.month}
                        title={`${m.month} · ${m.created}`}
                        className="flex-1 rounded-t bg-brand-orange/80 hover:bg-[var(--brand-orange)] transition-colors"
                        style={{ height: `${Math.max(6, Math.round((Number(m.created) || 0) / growthMax * 100))}%` }}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                    {t("adminMisc.intelligence.createdLast30d")}: {fmtCount(contacts.growth.created_last_30d)}
                  </p>
                </div>
              </SectionCard>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}