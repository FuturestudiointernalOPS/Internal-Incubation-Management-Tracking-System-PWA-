"use client";

import { BarChart3, Building2 } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { useI18n } from "@/lib/i18n";
import { PIPELINE_STAGES, STAGE_COLORS, STAGE_LABELS } from "./constants";

/**
 * The Pipeline tab: the stage filter row and the pipeline entries.
 * Extracted verbatim from InvestorDashboard.
 */
export default function PipelineTab({
  pipeline,
  filteredPipeline,
  stageFilter,
  onStageFilterChange,
  processingId,
  onAddToPipeline,
  onOpenWorkspace,
}) {
  const { t, lang } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => onStageFilterChange("all")}
          className={`min-h-11 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
            stageFilter === "all" ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)]"
          }`}
        >
          {t("dashboardV2.allStages")} ({pipeline.length})
        </button>
        {PIPELINE_STAGES.map(stage => {
          const count = pipeline.filter(item => item.stage === stage).length;
          if (count === 0 && stageFilter !== stage) return null;
          return (
            <button
              key={stage}
              type="button"
              onClick={() => onStageFilterChange(stage)}
              className={`min-h-11 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
                stageFilter === stage ? "bg-[var(--brand-orange)] text-white" : STAGE_COLORS[stage]
              }`}
            >
              {t(STAGE_LABELS[stage] || "")} ({count})
            </button>
          );
        })}
      </div>

      {filteredPipeline.length === 0 ? (
        <AppEmptyState
          title={t("dashboardV2.pipelineEmpty")}
          description={t("dashboardV2.pipelineEmptyHint")}
          icon={BarChart3}
          size="lg"
        />
      ) : (
        <div className="space-y-3">
          {filteredPipeline.map(item => (
            <AppCard key={item.id} padding="md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="w-8 h-8 text-brand-orange/60" />
                  <div>
                    <p className="text-sm font-bold text-[var(--text-primary)]">{item.venture_name || item.venture_id}</p>
                    <p className="text-[10px] text-[var(--text-tertiary)]">
                      {new Date(item.stage_changed_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-US")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${STAGE_COLORS[item.stage]}`}>
                    {t(STAGE_LABELS[item.stage] || "") || item.stage}
                  </span>
                  {item.stage === "due_diligence" && (
                    <button onClick={() => onOpenWorkspace(item.id)}
                      type="button"
                      className="min-h-11 rounded-lg bg-[var(--surface-3)] px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--text-primary)] hover:border-[var(--brand-orange)]">
                      {t("dashboardV2.openWorkspace")}
                    </button>
                  )}
                  <select
                    value={item.stage}
                    onChange={event => onAddToPipeline(item.venture_id, event.target.value)}
                    disabled={processingId !== null}
                    aria-label={t("dashboardV2.changeStage", { venture: item.venture_name || item.venture_id })}
                    className="min-h-11 bg-[var(--surface-3)] border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[10px] font-bold text-[var(--text-primary)] outline-none disabled:opacity-40 disabled:cursor-wait"
                  >
                    {PIPELINE_STAGES.map(stageOption => (
                      <option key={stageOption} value={stageOption}>{t(STAGE_LABELS[stageOption] || "")}</option>
                    ))}
                  </select>
                </div>
              </div>
            </AppCard>
          ))}
        </div>
      )}
    </div>
  );
}
