"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useI18n } from "@/lib/i18n";

/**
 * Monthly Trend Chart — cumulative planned vs actual line chart.
 *
 * Props:
 *   monthlyData   - Array of { monthKey, monthLabel, plannedSpending, actualSpending, variance }
 *   totalBudget   - Total planned budget for the year (for cumulative % calculation)
 */
export default function MonthlyTrendChart({ monthlyData = [], totalBudget = 0 }) {
  const { t } = useI18n();
  const chartData = useMemo(() => {
    if (!monthlyData.length || !totalBudget) return [];

    let cumPlanned = 0;
    let cumActual = 0;

    return monthlyData.map((m) => {
      cumPlanned += m.plannedSpending || 0;
      cumActual += m.actualSpending || 0;

      return {
        month: m.monthLabel,
        plannedPct: Math.round((cumPlanned / totalBudget) * 100 * 100) / 100,
        actualPct: Math.round((cumActual / totalBudget) * 100 * 100) / 100,
        variance: Math.round(((cumActual - cumPlanned) / totalBudget) * 100 * 100) / 100,
        plannedRaw: cumPlanned,
        actualRaw: cumActual,
      };
    });
  }, [monthlyData, totalBudget]);

  if (!chartData.length) {
    return (
      <div className="card !p-6">
        <h3
          className="text-sm font-black uppercase tracking-tight mb-4"
          style={{ color: "var(--text-primary)" }}
        >
          {t("finance.chart.title")}
        </h3>
        <p
          className="text-[10px] italic text-center py-12"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("common.noData")}
        </p>
      </div>
    );
  }

  const formatPct = (val) => `${val}%`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const entry = payload[0]?.payload;
    return (
      <div
        className="rounded-xl p-3 text-[11px] shadow-lg"
        style={{
          background: "var(--surface-1)",
          border: "1px solid var(--border-primary)",
        }}
      >
        <p className="font-black mb-1" style={{ color: "var(--text-primary)" }}>
          {label}
        </p>
        <p style={{ color: "var(--blue)" }}>
          {t("finance.chart.planned")}: {formatPct(entry.plannedPct)}
        </p>
        <p style={{ color: "var(--brand-orange)" }}>
          {t("finance.chart.actual")}: {formatPct(entry.actualPct)}
        </p>
        <p
          style={{
            color: entry.variance <= 0 ? "var(--green)" : "var(--red)",
          }}
        >
          {t("finance.chart.tooltipVariance")}: {formatPct(entry.variance)}
        </p>
      </div>
    );
  };

  return (
    <div className="card !p-6">
      <h3
        className="text-sm font-black uppercase tracking-tight mb-4"
        style={{ color: "var(--text-primary)" }}
      >
        {t("finance.chart.title")}
      </h3>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 500 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border-primary)"
              />
              <XAxis
                dataKey="month"
                stroke="var(--text-secondary)"
                fontSize={11}
                tickMargin={6}
              />
              <YAxis
                stroke="var(--text-secondary)"
                fontSize={11}
                tickFormatter={formatPct}
                domain={[0, 110]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", color: "var(--text-secondary)" }}
              />
              {/* Planned — dashed line */}
              <Line
                type="monotone"
                dataKey="plannedPct"
                name={t("finance.chart.planned")}
                stroke="var(--blue)"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
              />
              {/* Actual — solid line */}
              <Line
                type="monotone"
                dataKey="actualPct"
                name={t("finance.chart.actual")}
                stroke="#FF6600"
                strokeWidth={2.5}
                dot={{ fill: "#FF6600", strokeWidth: 0, r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
