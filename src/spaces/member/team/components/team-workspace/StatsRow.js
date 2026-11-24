"use client";

import { Users, BarChart3, CheckCircle2, Clock } from "lucide-react";
import StatCard from "./StatCard";
import { useI18n } from "@/lib/i18n";

/**
 * The overview's figures: progress with its bar, deliverables approved,
 * deliverables still to come, and the size of the team.
 * Extracted verbatim from app/team/[id]/page.js.
 */
export default function StatsRow({
  progressPct,
  completedCount,
  deliverableCount,
  pendingCount,
  memberCount,
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        progress={progressPct}
        icon={{
          wrap: "bg-brand-orange/10",
          glyph: <BarChart3 className="w-5 h-5 text-[var(--brand-orange)]" />,
        }}
        caption={t("rootMisc.team.progress")}
        value={`${progressPct}%`}
      />

      <StatCard
        icon={{
          wrap: "bg-emerald-500/10",
          glyph: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
        }}
        caption={t("rootMisc.team.completed")}
        value={`${completedCount} / ${deliverableCount}`}
      />

      <StatCard
        icon={{
          wrap: "bg-amber-500/10",
          glyph: <Clock className="w-5 h-5 text-amber-500" />,
        }}
        caption={t("rootMisc.team.pending")}
        value={pendingCount}
      />

      <StatCard
        icon={{
          wrap: "bg-indigo-500/10",
          glyph: <Users className="w-5 h-5 text-indigo-500" />,
        }}
        caption={t("rootMisc.team.members")}
        value={memberCount}
      />
    </div>
  );
}