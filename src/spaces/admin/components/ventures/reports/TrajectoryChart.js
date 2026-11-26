"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * ONE trajectory, one chart: a caption, a subtitle, and up to two series.
 *
 * Kept generic on purpose — revenue, customers, retention and runway are four
 * readings of the same monthly series, and four bespoke charts would drift.
 */
export default function TrajectoryChart({
  title,
  subtitle,
  rows = [],
  series = [],
  emptyLabel,
  yTickFormatter,
  tooltipFormatter,
}) {
  return (
    <div className="stf-card" style={{ padding: 14, display: "grid", gap: 10, minWidth: 0 }}>
      <div>
        <p className="stf-k" style={{ margin: 0 }}>{title}</p>
        {subtitle && (
          <p className="stf-small" style={{ margin: "2px 0 0" }}>{subtitle}</p>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="stf-small" style={{ margin: 0, padding: "18px 0", textAlign: "center" }}>
          {emptyLabel}
        </p>
      ) : (
        <div style={{ width: "100%", height: 170 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 6, right: 10, bottom: 0, left: -14 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.6} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                width={46}
                tickFormatter={yTickFormatter}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border-primary)",
                  borderRadius: 10,
                  fontSize: 11,
                  color: "var(--text-primary)",
                }}
                formatter={tooltipFormatter}
              />
              {series.map((entry) => (
                <Line
                  key={entry.key}
                  type="monotone"
                  dataKey={entry.key}
                  name={entry.label}
                  stroke={entry.color}
                  strokeWidth={2.2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
