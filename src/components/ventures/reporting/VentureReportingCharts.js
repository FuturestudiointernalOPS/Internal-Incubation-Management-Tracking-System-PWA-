"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  Activity,
  Clock,
  Sparkles,
  Database,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import AppCard from "@/components/ui/AppCard";
import { formatCurrencyAmount } from "@/lib/currencies";

const PERIOD_OPTIONS = [
  { value: "3", key: "months3" },
  { value: "6", key: "months6" },
  { value: "all", key: "allTime" },
];

/**
 * THE VENTURE'S REPORTING CHARTS — one reading, three audiences.
 *
 * The founder, the Venture Manager and the Super Admin all open this same
 * panel, so the figures they discuss are the figures the founder submitted.
 * It reads ONLY `/api/ventures/[id]/reporting/dashboard` (the calculated layer):
 * nothing here recomputes a metric, and an unvalidated month never appears.
 */
export default function VentureReportingCharts({ ventureId }) {
  const { t, lang } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [periodFilter, setPeriodFilter] = useState("6"); // "3", "6", "all"

  const loadData = useCallback(async () => {
    if (!ventureId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/ventures/${encodeURIComponent(ventureId)}/reporting/dashboard`);
      const payload = await res.json().catch(() => ({}));
      if (payload?.success) {
        setData(payload);
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [ventureId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extract raw rows from data.months
  const allMonths = useMemo(() => {
    if (!data?.months || !Array.isArray(data.months)) return [];
    return data.months.map((m) => {
      const periodStr = String(m.period || "");
      const label = periodStr.length >= 7 ? periodStr.slice(0, 7) : periodStr;
      
      const revValue =
        m.totalRevenue?.value != null
          ? Number(m.totalRevenue.value)
          : m.mrr != null
          ? Number(m.mrr)
          : 0;

      const runwayVal = m.runway?.value != null ? Number(m.runway.value) : 0;
      const netBurnVal = m.netBurn?.value != null ? Number(m.netBurn.value) : 0;

      return {
        period: m.period,
        label,
        // The unit this month was FILED in. A month reported before the currency
        // was recorded falls back to the latest one.
        currency: m.currency || data?.latest?.currency || "XOF",
        payingCustomers: Number(m.payingCustomers) || 0,
        revenue: revValue,
        retention: m.retention?.value != null ? Number(m.retention.value) : 0,
        runway: runwayVal,
        netBurn: netBurnVal,
      };
    });
  }, [data]);

  // Apply period filter (3 months, 6 months, or all)
  const filteredMonths = useMemo(() => {
    if (!allMonths.length) return [];
    if (periodFilter === "3") return allMonths.slice(-3);
    if (periodFilter === "6") return allMonths.slice(-6);
    return allMonths;
  }, [allMonths, periodFilter]);

  // Compute strategic signals (alerts / growth indicators)
  const signals = useMemo(() => {
    if (filteredMonths.length < 2) return [];
    const sigs = [];

    // 1. Retention check (< 50% or declining)
    const recent = filteredMonths.slice(-3);
    const lowRetentionCount = recent.filter((m) => m.retention > 0 && m.retention < 0.5).length;
    if (lowRetentionCount >= 2) {
      sigs.push({
        id: "low-retention",
        tone: "danger",
        icon: AlertTriangle,
        title: t("venture.charts.signalRetentionTitle") || "Cohort Retention Warning",
        desc: t("venture.charts.signalRetentionDesc") || "Monthly customer retention has dropped below 50% target threshold.",
      });
    }

    // 2. Customer growth vs contraction
    const lastIdx = filteredMonths.length - 1;
    const currentCust = filteredMonths[lastIdx]?.payingCustomers || 0;
    const prevCust = filteredMonths[lastIdx - 1]?.payingCustomers || 0;
    if (currentCust < prevCust && prevCust > 0) {
      const dropPct = Math.round(((prevCust - currentCust) / prevCust) * 100);
      sigs.push({
        id: "cust-drop",
        tone: "danger",
        icon: TrendingDown,
        title: t("venture.charts.signalCustDropTitle") || "Customer Contraction Alert",
        desc: `${dropPct}% ${t("venture.charts.signalCustDropDesc") || "drop in paying customers from the previous month."}`,
      });
    } else if (currentCust > prevCust) {
      const gainPct = prevCust > 0 ? Math.round(((currentCust - prevCust) / prevCust) * 100) : 100;
      sigs.push({
        id: "cust-growth",
        tone: "success",
        icon: TrendingUp,
        title: t("venture.charts.signalCustGrowthTitle") || "Customer Growth Acceleration",
        desc: `+${gainPct}% ${t("venture.charts.signalCustGrowthDesc") || "increase in paying customers over the previous period."}`,
      });
    }

    // 3. Runway alert (< 3 months)
    const latestRunway = filteredMonths[lastIdx]?.runway;
    if (latestRunway != null && latestRunway > 0 && latestRunway < 3) {
      sigs.push({
        id: "low-runway",
        tone: "danger",
        icon: Clock,
        title: t("venture.charts.signalRunwayTitle") || "Critical Runway Alert",
        desc: `${latestRunway} ${t("venture.charts.signalRunwayDesc") || "months of cash runway remaining. Review net burn and funding requirements."}`,
      });
    }

    return sigs;
  }, [filteredMonths, t]);

  if (loading && !data) {
    return (
      <AppCard padding="normal">
        <div className="py-6 text-center text-xs" style={{ color: "var(--text-secondary)" }}>
          {t("common.loading")}
        </div>
      </AppCard>
    );
  }

  // If no reporting data submitted yet, show an encouraging guidance state
  if (!allMonths.length) {
    return (
      <div
        className="rounded-2xl p-6 border text-center space-y-3"
        style={{
          background: "linear-gradient(135deg, var(--surface-1) 0%, var(--surface-2) 100%)",
          borderColor: "var(--border-primary)",
        }}
      >
        <div className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-orange)_15%,transparent)] text-[var(--brand-orange)]">
          <Sparkles size={24} />
        </div>
        <h4 className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
          {t("venture.charts.emptyTitle") || "Venture Growth & Unit Economics"}
        </h4>
        <p className="text-xs max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
          {t("venture.charts.emptyDesc") || "Performance trajectories, recurring revenue, retention curves and operational runway will appear here as monthly reports are validated."}
        </p>
      </div>
    );
  }

  const latestMonth = filteredMonths[filteredMonths.length - 1];
  // The charts are labelled in the currency of the most recent filing. Each
  // point keeps its own, so a currency switch is visible rather than silent.
  const currencyUnit = latestMonth?.currency || data?.latest?.currency || "XOF";
  const locale = lang === "fr" ? "fr-FR" : "en-US";
  const money = (value, code) => formatCurrencyAmount(value, code || currencyUnit, locale);

  return (
    <div className="space-y-6">
      {/* ── Section Header with Telemetry Metadata & Time Window Filter ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
            <Activity size={16} className="text-[var(--brand-orange)]" />
            {t("venture.charts.sectionTitle") || "Growth & Performance Telemetry"}
          </h3>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("venture.charts.sectionSubtitle") || "Verified metrics computed from validated monthly reports and verified evidence"}
          </p>
        </div>

        {/* Time Filter Controls */}
        <div className="flex items-center gap-1 p-1 rounded-xl border" style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setPeriodFilter(opt.value)}
              className="px-3 py-1 rounded-lg text-xs font-bold transition-all"
              style={{
                background: periodFilter === opt.value ? "var(--surface-3)" : "transparent",
                color: periodFilter === opt.value ? "var(--text-primary)" : "var(--text-secondary)",
                boxShadow: periodFilter === opt.value ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
            >
              {opt.value === "3" ? (t("venture.charts.period3") || "Past 3 Months") : opt.value === "6" ? (t("venture.charts.period6") || "Past 6 Months") : (t("venture.charts.periodAll") || "All Time")}
            </button>
          ))}
        </div>
      </div>

      {/* ── Strategic Performance Signals Bar ── */}
      {signals.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {signals.map((sig) => {
            const Icon = sig.icon;
            const isDanger = sig.tone === "danger";
            return (
              <div
                key={sig.id}
                className="p-3.5 rounded-xl border flex items-start gap-3 transition-all"
                style={{
                  background: isDanger
                    ? "color-mix(in srgb, var(--status-red, #ef4444) 8%, var(--surface-1))"
                    : "color-mix(in srgb, var(--status-green, #10b981) 8%, var(--surface-1))",
                  borderColor: isDanger
                    ? "color-mix(in srgb, var(--status-red, #ef4444) 30%, transparent)"
                    : "color-mix(in srgb, var(--status-green, #10b981) 30%, transparent)",
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center mt-0.5"
                  style={{
                    background: isDanger
                      ? "color-mix(in srgb, var(--status-red, #ef4444) 20%, transparent)"
                      : "color-mix(in srgb, var(--status-green, #10b981) 20%, transparent)",
                    color: isDanger ? "var(--status-red, #ef4444)" : "var(--status-green, #10b981)",
                  }}
                >
                  <Icon size={15} />
                </div>
                <div className="space-y-0.5">
                  <h5
                    className="text-xs font-black"
                    style={{ color: isDanger ? "var(--status-red, #ef4444)" : "var(--text-primary)" }}
                  >
                    {sig.title}
                  </h5>
                  <p className="text-[11px] leading-tight" style={{ color: "var(--text-secondary)" }}>
                    {sig.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Visual Analytics Grid with Clear Data Source Attributions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Monthly Recurring Revenue (MRR) */}
        <div
          className="rounded-2xl p-5 border space-y-3 flex flex-col justify-between"
          style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-orange)_15%,transparent)] text-[var(--brand-orange)]">
                  <DollarSign size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                    {t("venture.charts.revenueTitle") || "Monthly Recurring Revenue (MRR)"}
                  </h4>
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {t("venture.charts.revenueSubtitle") || "Total verified recurring software & service revenue"}
                  </p>
                </div>
              </div>
              {filteredMonths.length > 0 && (
                <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                  {money(latestMonth.revenue, latestMonth.currency)}
                </span>
              )}
            </div>

            <div className="pt-3" style={{ width: "100%", height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredMonths} margin={{ top: 10, right: 12, bottom: 0, left: -5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.6} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} width={48} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border-primary)",
                      borderRadius: "10px",
                      fontSize: "11px",
                      color: "var(--text-primary)",
                    }}
                    formatter={(val, name, item) => [money(val, item?.payload?.currency), t("venture.charts.revenueTitle") || "MRR"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--brand-orange)"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "var(--brand-orange)" }}
                    activeDot={{ r: 5.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Explicit Data Source Footnote */}
          <div className="pt-2 border-t flex items-center gap-1.5 text-[10px]" style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}>
            <Database size={11} className="shrink-0 text-[var(--brand-orange)]" />
            <span>{t("venture.charts.revenueDataSource") || "Data source: Validated monthly report (mrr + other_revenue)"}</span>
          </div>
        </div>

        {/* 2. Paying Customers Count */}
        <div
          className="rounded-2xl p-5 border space-y-3 flex flex-col justify-between"
          style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-orange)_15%,transparent)] text-[var(--brand-orange)]">
                  <Users size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                    {t("venture.charts.customerTitle") || "Paying Customers"}
                  </h4>
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {t("venture.charts.customerSubtitle") || "Active accounts with a paid contract or subscription"}
                  </p>
                </div>
              </div>
              {filteredMonths.length > 0 && (
                <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                  {latestMonth.payingCustomers} {t("venture.charts.customersCount") || "Customers"}
                </span>
              )}
            </div>

            <div className="pt-3" style={{ width: "100%", height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredMonths} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.6} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} width={35} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border-primary)",
                      borderRadius: "10px",
                      fontSize: "11px",
                      color: "var(--text-primary)",
                    }}
                    formatter={(val) => [`${val} ${t("venture.charts.customersCount") || "Customers"}`, t("venture.charts.customerTitle") || "Paying Customers"]}
                  />
                  <Bar
                    dataKey="payingCustomers"
                    fill="var(--brand-orange)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Explicit Data Source Footnote */}
          <div className="pt-2 border-t flex items-center gap-1.5 text-[10px]" style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}>
            <Database size={11} className="shrink-0 text-[var(--brand-orange)]" />
            <span>{t("venture.charts.customerDataSource") || "Data source: Validated monthly report (paying_customers)"}</span>
          </div>
        </div>

        {/* 3. Cohort Retention Rate */}
        <div
          className="rounded-2xl p-5 border space-y-3 flex flex-col justify-between"
          style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-orange)_15%,transparent)] text-[var(--brand-orange)]">
                  <Activity size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                    {t("venture.charts.retentionTitle") || "Cohort Retention Rate"}
                  </h4>
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {t("venture.charts.retentionSubtitle") || "Percentage of customers retained month-over-month"}
                  </p>
                </div>
              </div>
              {filteredMonths.length > 0 && (
                <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                  {Math.round((latestMonth.retention || 0) * 100)}%
                </span>
              )}
            </div>

            <div className="pt-3" style={{ width: "100%", height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredMonths} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.6} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                  <YAxis
                    tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                    width={38}
                    domain={[0, 1]}
                    tickFormatter={(val) => `${Math.round(val * 100)}%`}
                  />
                  <Tooltip
                    formatter={(val) => [`${Math.round(val * 100)}%`, t("venture.charts.retentionTitle") || "Cohort Retention Rate"]}
                    contentStyle={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border-primary)",
                      borderRadius: "10px",
                      fontSize: "11px",
                      color: "var(--text-primary)",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="retention"
                    stroke="var(--status-green, #10b981)"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: "var(--status-green, #10b981)" }}
                    activeDot={{ r: 5.5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Explicit Data Source Footnote */}
          <div className="pt-2 border-t flex items-center gap-1.5 text-[10px]" style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}>
            <Database size={11} className="shrink-0 text-[var(--brand-orange)]" />
            <span>{t("venture.charts.retentionDataSource") || "Data source: Computed metric: (paying_customers - new_paying_customers) / previous_paying_customers"}</span>
          </div>
        </div>

        {/* 4. Capital Runway & Burn Rate Projection (Universal Startup Standard) */}
        <div
          className="rounded-2xl p-5 border space-y-3 flex flex-col justify-between"
          style={{ background: "var(--surface-1)", borderColor: "var(--border-primary)" }}
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[color-mix(in_srgb,var(--brand-orange)_15%,transparent)] text-[var(--brand-orange)]">
                  <Clock size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
                    {t("venture.charts.runwayTitle") || "Capital Runway & Burn Rate"}
                  </h4>
                  <p className="text-[10px]" style={{ color: "var(--text-secondary)" }}>
                    {t("venture.charts.runwaySubtitle") || "Operational runway in months based on cash reserves & net burn"}
                  </p>
                </div>
              </div>
              {filteredMonths.length > 0 && (
                <span className="text-sm font-black" style={{ color: "var(--text-primary)" }}>
                  {latestMonth.runway} {t("time.months.short") || "mo"}
                </span>
              )}
            </div>

            <div className="pt-3" style={{ width: "100%", height: 190 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={filteredMonths} margin={{ top: 10, right: 12, bottom: 0, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.6} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-secondary)" }} width={35} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface-2)",
                      borderColor: "var(--border-primary)",
                      borderRadius: "10px",
                      fontSize: "11px",
                      color: "var(--text-primary)",
                    }}
                    formatter={(val) => [`${val} ${t("time.months.short") || "months"}`, t("venture.charts.monthsOfRunway") || "Runway"]}
                  />
                  <Bar
                    dataKey="runway"
                    fill="var(--brand-orange)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Explicit Data Source Footnote */}
          <div className="pt-2 border-t flex items-center gap-1.5 text-[10px]" style={{ borderColor: "var(--border-primary)", color: "var(--text-secondary)" }}>
            <Database size={11} className="shrink-0 text-[var(--brand-orange)]" />
            <span>
              {t("venture.charts.runwayDataSource") || "Data source: Computed metric: cash_in_bank / monthly_burn"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
