"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useI18n } from "@/lib/i18n";
import { buildCorrelation, money, num } from "./analysisModel";

/**
 * WORK vs OUTCOME — the overlay nothing else on this page can show.
 *
 * Bars: deliverables a reviewer APPROVED that month (the studio's own act).
 * Line: the revenue the founder REPORTED for the same month. Read together,
 * they answer "did the work move the business?" instead of leaving the two
 * halves of this page in separate tabs.
 */
export default function ExecutionOutcomeChart({ dashboard, timeline }) {
  const { t, lang } = useI18n();
  const rows = buildCorrelation({ months: dashboard?.months || [], timeline });
  const currency = dashboard?.latest?.currency || "XOF";
  const hasWork = rows.some((row) => row.approved > 0 || row.stages > 0);

  return (
    <div className="stf-card" style={{ padding: 14, display: "grid", gap: 10 }}>
      <div>
        <p className="stf-k" style={{ margin: 0 }}>{t("vadmin.reportsCorrelation.title")}</p>
        <p className="stf-small" style={{ margin: "2px 0 0" }}>{t("vadmin.reportsCorrelation.subtitle")}</p>
      </div>

      {rows.length === 0 || !hasWork ? (
        <p className="stf-small" style={{ margin: 0, padding: "18px 0", textAlign: "center" }}>
          {t("vadmin.reportsCorrelation.noData")}
        </p>
      ) : (
        <div style={{ width: "100%", height: 210 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 6, right: 10, bottom: 0, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" opacity={0.6} />
              <XAxis dataKey="period" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} />
              <YAxis
                yAxisId="work"
                tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                width={34}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="outcome"
                orientation="right"
                tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
                width={56}
                tickFormatter={(value) => num(value, lang)}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border-primary)",
                  borderRadius: 10,
                  fontSize: 11,
                  color: "var(--text-primary)",
                }}
                formatter={(value, name) =>
                  name === t("vadmin.reportsCorrelation.revenue")
                    ? money(value, currency, lang)
                    : num(value, lang)
                }
              />
              <Bar
                yAxisId="work"
                dataKey="approved"
                name={t("vadmin.reportsCorrelation.approved")}
                fill="var(--brand-orange)"
                opacity={0.55}
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="outcome"
                type="monotone"
                dataKey="revenue"
                name={t("vadmin.reportsCorrelation.revenue")}
                stroke="var(--stf-done, #10B981)"
                strokeWidth={2.4}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
