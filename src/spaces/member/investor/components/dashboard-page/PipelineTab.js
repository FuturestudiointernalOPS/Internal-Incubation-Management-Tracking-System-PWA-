"use client";

import { BarChart3 } from "lucide-react";
import AppCard from "@/components/ui/AppCard";
import AppEmptyState from "@/components/ui/AppEmptyState";
import AppButton from "@/components/ui/AppButton";
import { useI18n } from "@/lib/i18n";
import VentureIdentity from "./VentureIdentity";
import { PIPELINE_STAGES, STAGE_COLORS, STAGE_LABELS, STAGE_TONES } from "./constants";

/**
 * The Pipeline tab: the stage filter row and the pipeline entries.
 *
 * Each entry wears the same identity row as the discovery card and states its
 * stage as a shared tag; the actions it offers are the same ones, in the same
 * order, as everywhere else.
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
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => onStageFilterChange("all")}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
            stageFilter === "all" ? "bg-[var(--brand-orange)] text-white" : "bg-[var(--surface-3)] text-[var(--text-secondary)]"
          }`}
        >
          {t("member.investor.browser.pipeline.all", { count: pipeline.length })}
        </button>
        {PIPELINE_STAGES.map(stage => {
          const count = pipeline.filter(item => item.stage === stage).length;
          if (count === 0 && stageFilter !== stage) return null;
          return (
            <button
              key={stage}
              onClick={() => onStageFilterChange(stage)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide whitespace-nowrap transition-colors ${
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
          icon={BarChart3}
          title={t("member.investor.browser.pipeline.emptyTitle")}
          description={t("member.investor.browser.pipeline.emptyBody")}
        />
      ) : (
        <div className="space-y-3">
          {filteredPipeline.map(item => (
            <AppCard key={item.id} padding="md">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <VentureIdentity
                    name={item.venture_name || item.venture_id}
                    meta={item.stage_changed_at ? new Date(item.stage_changed_at).toLocaleDateString() : null}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`stf-tag ${STAGE_TONES[item.stage] ?? ""}`}>
                    {t(STAGE_LABELS[item.stage] || "") || item.stage}
                  </span>
                  {item.stage === "due_diligence" && (
                    <AppButton variant="secondary" size="sm" onClick={() => onOpenWorkspace(item.id)}>
                      {t("member.investor.browser.pipeline.openWorkspace")}
                    </AppButton>
                  )}
                  <select
                    value={item.stage}
                    onChange={event => onAddToPipeline(item.venture_id, event.target.value)}
                    disabled={processingId !== null}
                    aria-label={t("member.investor.browser.detail.pipelineStatus")}
                    className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-lg px-2 py-1 text-[11px] font-bold text-[var(--text-primary)] outline-none disabled:opacity-40 disabled:cursor-wait"
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
