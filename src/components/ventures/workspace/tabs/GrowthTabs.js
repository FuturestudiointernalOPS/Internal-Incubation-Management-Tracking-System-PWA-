"use client";

import { FileCheck2, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useVenture } from "../VentureContext";

/**
 * INVESTMENT TAB — two indicators, two questions, never one number.
 *
 *   Roadmap progress   — how much of the planned work is done.
 *   Investment readiness — how many of the Venture's REQUIRED Data Room
 *                          categories are filed and verified.
 *
 * Both come from `/api/ventures/[id]/investment-readiness`, which computes them
 * from two different engines. The old eight-document checklist that lived here
 * is gone: it matched document categories by substring against a vocabulary the
 * Data Room does not use, so a Venture that filed everything correctly could
 * never clear it.
 */
export function InvestmentTab() {
  const { t } = useI18n();
  const { investmentReadiness, cardStyle } = useVenture();

  if (!investmentReadiness) {
    return (
      <div className="text-center py-8">
        <Loader2 className="animate-spin mx-auto" style={{ color: "var(--text-secondary)" }} size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RoadmapReadinessCard />
      <DataRoomReadinessCard />
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {t("venture.dataRoomReadiness.hint")}
      </p>
      <div className="rounded-xl p-4 border" style={cardStyle}>
        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
          {t("venture.dataRoomReadiness.where")}
        </p>
      </div>
    </div>
  );
}

/** Roadmap progress — what the Venture is evaluated on, week to week. */
export function RoadmapReadinessCard() {
  const { t } = useI18n();
  const { investmentReadiness, cardStyle } = useVenture();
  const roadmapReadiness = investmentReadiness?.roadmap_readiness;
  if (!roadmapReadiness) return null;

  const rows = [
    { key: "journeys", label: t("venture.manager.irJourneys"), pct: roadmapReadiness.components.journeys },
    { key: "milestones", label: t("venture.manager.irMilestones"), pct: roadmapReadiness.components.milestones },
    { key: "tasks", label: t("venture.manager.irTasks"), pct: roadmapReadiness.components.tasks },
    { key: "deliverables", label: t("venture.manager.irDeliverables"), pct: roadmapReadiness.components.deliverables },
  ];

  return (
    <div className="rounded-xl p-5 border" style={cardStyle}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold">{t("venture.roadmapProgress.title")}</h3>
        <span className="text-2xl font-black" style={{ color: "var(--brand-orange)" }}>
          {roadmapReadiness.overall_percent}%
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        {t("venture.roadmapProgress.desc")}
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.key}>
            <div className="flex justify-between text-xs mb-0.5">
              <span>{row.label}</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {row.pct === null ? "—" : `${row.pct}%`}
              </span>
            </div>
            {row.pct !== null && (
              <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "var(--surface-3)" }}>
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(row.pct, 100)}%`, backgroundColor: "var(--progress-fill)" }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      {roadmapReadiness.counts && (
        <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
          <div>
            <span className="font-bold">
              {roadmapReadiness.counts.milestones.completed}/{roadmapReadiness.counts.milestones.total}
            </span>{" "}
            {t("venture.manager.irMilestonesDone")}
          </div>
          <div>
            <span className="font-bold">
              {roadmapReadiness.counts.tasks.completed}/{roadmapReadiness.counts.tasks.total}
            </span>{" "}
            {t("venture.manager.irTasksDone")}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Investment readiness — the Data Room's own completeness figure.
 *
 * `null` means INDETERMINATE (the Venture has nothing marked `required`), and it
 * is shown as « — »: not 0%, which would read as a Venture that failed, and not
 * 100%, which would read as one that is ready.
 */
export function DataRoomReadinessCard() {
  const { t } = useI18n();
  const { investmentReadiness, cardStyle } = useVenture();
  const readiness = investmentReadiness?.data_room_readiness;
  if (!readiness) return null;

  const percent = readiness.readiness_percent;
  const indeterminate = percent === null || percent === undefined;

  return (
    <div className="rounded-xl p-5 border" style={cardStyle}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold flex items-center gap-2">
          <FileCheck2 size={16} style={{ color: "var(--brand-orange)" }} />
          {t("venture.dataRoomReadiness.title")}
        </h3>
        <span
          className="text-2xl font-black"
          style={{ color: readiness.is_ready ? "var(--chart-success)" : "var(--brand-orange)" }}
        >
          {indeterminate ? "—" : `${percent}%`}
        </span>
      </div>
      <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
        {indeterminate
          ? t("venture.dataRoomReadiness.indeterminate")
          : t("venture.dataRoomReadiness.desc")}
      </p>
      {!indeterminate && (
        <>
          <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: "var(--surface-3)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(percent, 100)}%`,
                backgroundColor: readiness.is_ready ? "var(--chart-success)" : "var(--brand-orange)",
              }}
            />
          </div>
          <p className="text-xs mt-2" style={{ color: "var(--text-secondary)" }}>
            {t("venture.dataRoomReadiness.counts", {
              verified: readiness.verified_count,
              total: readiness.total_required,
            })}
          </p>
        </>
      )}
    </div>
  );
}
