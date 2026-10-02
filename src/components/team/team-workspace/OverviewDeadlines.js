"use client";

import { Flag } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "./constants";

/**
 * The overview's quick list of the next five deadlines.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function OverviewDeadlines({ upcomingDeadlines }) {
  const { t } = useI18n();
  if (upcomingDeadlines.length === 0) return null;
  return (
    <AppCard padding="lg">
      <h3 className="text-sm font-black text-[var(--text-primary)] uppercase tracking-wider mb-4 flex items-center gap-2">
        <Flag className="w-4 h-4 text-[var(--brand-orange)]" />
        {t("rootMisc.team.upcomingDeadlines")}
      </h3>
      <div className="space-y-2">
        {upcomingDeadlines.slice(0, 5).map((deliverable) => (
          <div
            key={deliverable.id}
            className="flex items-center justify-between p-3 rounded-lg bg-[var(--surface-3)]"
          >
            <div>
              <p className="text-xs font-bold text-[var(--text-primary)]">
                {deliverable.title}
              </p>
              <p className="text-[10px] font-medium text-[var(--text-tertiary)]">
                {t("rootMisc.team.week")} {deliverable.week_number || "?"}
              </p>
            </div>
            <span className="text-[10px] font-black text-amber-500 uppercase">
              {fmtDate(deliverable.due_date || deliverable._date)}
            </span>
          </div>
        ))}
      </div>
    </AppCard>
  );
}