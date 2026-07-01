"use client";

import { useI18n } from "@/lib/i18n";

/**
 * Budget Execution Gauge — circular progress indicator.
 *
 * Props:
 *   percentage  - Number 0–100
 *   targetMin   - Lower bound of target range (default 90)
 *   targetMax   - Upper bound of target range (default 100)
 *   size        - Pixel diameter of the gauge (default 200)
 */
export default function BudgetExecutionGauge({
  percentage = 0,
  targetMin = 90,
  targetMax = 100,
  size = 200,
}) {
  const { t } = useI18n();
  const clamped = Math.min(100, Math.max(0, percentage));
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  // Color logic
  let color;
  let labelKey;
  if (clamped >= 75) {
    color = "var(--green)";
    labelKey = "finance.gauge.onTrack";
  } else if (clamped >= 50) {
    color = "var(--amber)";
    labelKey = "finance.gauge.warning";
  } else {
    color = "var(--red)";
    labelKey = "finance.gauge.concern";
  }

  return (
    <div className="card !p-6 flex flex-col items-center gap-3">
      <h3
        className="text-sm font-black uppercase tracking-tight self-start"
        style={{ color: "var(--text-primary)" }}
      >
        {t("finance.gauge.title")}
      </h3>

      <svg
        width={size}
        height={size}
        className="drop-shadow-sm"
        role="img"
        aria-label={`${t("finance.gauge.title")}: ${clamped}%`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border-primary)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        {/* Center text */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fontSize="2.5rem"
          fontWeight="900"
          fill={color}
        >
          {clamped}%
        </text>
        <text
          x="50%"
          y={size / 2 + 28}
          dominantBaseline="central"
          textAnchor="middle"
          fontSize="0.65rem"
          fontWeight="700"
          fill="var(--text-secondary)"
        >
          {t(labelKey)}
        </text>
      </svg>

      <p
        className="text-[10px] font-bold"
        style={{ color: "var(--text-secondary)" }}
      >
        {t("finance.gauge.target", { min: targetMin, max: targetMax })}
      </p>
    </div>
  );
}
