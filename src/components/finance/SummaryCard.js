"use client";

import { useI18n } from "@/lib/i18n";

const STATUS_COLORS = {
  green: { bg: "rgba(16,185,129,0.12)", text: "var(--green)" },
  amber: { bg: "rgba(245,158,11,0.12)", text: "var(--amber)" },
  red: { bg: "rgba(239,68,68,0.12)", text: "var(--red)" },
  blue: { bg: "rgba(59,130,246,0.12)", text: "var(--blue)" },
};

/**
 * A single summary stat card for the finance dashboard.
 *
 * Props:
 *   title       - Card label (string)
 *   value       - Formatted currency value (string)
 *   status      - "green" | "amber" | "red" | "blue"
 *   subtext     - Optional subtext below value
 *   icon        - Optional emoji/icon character
 */
export default function SummaryCard({ title, value, status = "blue", subtext, icon }) {
  const { t } = useI18n();
  const colors = STATUS_COLORS[status] || STATUS_COLORS.blue;

  return (
    <div className="card !p-5 flex items-center gap-4 transition-all hover:shadow-lg">
      {icon && (
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
          style={{ backgroundColor: colors.bg, color: colors.text }}
        >
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p
          className="text-[9px] font-bold uppercase tracking-widest"
          style={{ color: "var(--text-secondary)" }}
        >
          {title}
        </p>
        <p
          className="text-xl font-black mt-0.5 truncate"
          style={{ color: colors.text }}
        >
          {value}
        </p>
        {subtext && (
          <p
            className="text-[10px] mt-0.5 truncate"
            style={{ color: "var(--text-secondary)" }}
          >
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
