"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Settings, ChevronRight, Plus, Pencil, ArrowLeft, ArrowRight } from "lucide-react";
import AppButton from "@/components/ui/AppButton";
import AppEmptyState from "@/components/ui/AppEmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDialogs } from "@/components/ui/DialogProvider";
import { useI18n } from "@/lib/i18n";
import { CrmPipelineFormModal, CrmStageFormModal } from "@/components/crm/CrmPipelineForms";
import { useCrmCapabilities } from "@/components/crm/useCrmCapabilities";

export const dynamic = "force-dynamic";

function stageTone(stage) {
  if (!stage.is_terminal) return "bg-[var(--surface-3)] text-[var(--text-primary)]";
  return stage.outcome === "won" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
}

/**
 * CRM Pipelines — /crm/pipelines
 *
 * Every CRM user reviews the pipelines and their stages. With crm.manage the
 * same screen creates a pipeline, renames it, switches it on or off, and adds,
 * edits or retires its stages (the endpoints check the capability again).
 */
export default function CrmPipelinesPage() {
  const { t } = useI18n();
  const { alert } = useDialogs();
  const { can } = useCrmCapabilities();
  const canManage = can("manage");

  const [pipelines, setPipelines] = useState([]);
  const [expanded, setExpanded]   = useState({});
  const [stages, setStages]       = useState({});
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  // { type: "pipeline" | "stage", pipeline?, stage? } while a form is open
  const [dialog, setDialog]       = useState(null);

  const loadPipelines = useCallback(async () => {
    try {
      const res  = await fetch("/api/crm/pipelines?include_inactive=true");
      const data = await res.json();
      if (data.success) setPipelines(data.pipelines ?? []);
      else setError(t(data.error || "errors.somethingWrong"));
    } catch {
      setError(t("errors.somethingWrong"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Retired stages are listed too, so they can be brought back.
  const loadStages = useCallback(async (id) => {
    const res  = await fetch(`/api/crm/pipelines/${id}/stages?include_inactive=true`);
    const data = await res.json();
    if (data.success) setStages((current) => ({ ...current, [id]: data.stages ?? [] }));
  }, []);

  useEffect(() => { loadPipelines(); }, [loadPipelines]);

  async function togglePipeline(id) {
    setExpanded((current) => ({ ...current, [id]: !current[id] }));
    if (!stages[id]) await loadStages(id);
  }

  async function patch(url, body) {
    try {
      const res  = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) await alert({ message: t(data.error || "errors.somethingWrong") });
      return data.success;
    } catch {
      await alert({ message: t("errors.somethingWrong") });
      return false;
    }
  }

  async function setPipelineActive(pipeline, isActive) {
    if (await patch(`/api/crm/pipelines/${pipeline.id}`, { is_active: isActive })) await loadPipelines();
  }

  async function setStageActive(pipelineId, stage, isActive) {
    if (await patch(`/api/crm/pipelines/${pipelineId}/stages/${stage.id}`, { is_active: isActive })) {
      await loadStages(pipelineId);
    }
  }

  // Swap a stage with its neighbour and send the whole order.
  async function moveStage(pipelineId, index, offset) {
    const order = (stages[pipelineId] ?? []).map((stage) => stage.id);
    const target = index + offset;
    if (target < 0 || target >= order.length) return;
    [order[index], order[target]] = [order[target], order[index]];
    if (await patch(`/api/crm/pipelines/${pipelineId}/stages`, { order })) await loadStages(pipelineId);
  }

  async function handleSaved() {
    const pipelineId = dialog?.type === "stage" ? dialog.pipeline.id : null;
    setDialog(null);
    if (pipelineId) await loadStages(pipelineId);
    else await loadPipelines();
  }

  const nextPosition = (pipelineId) =>
    Math.max(0, ...(stages[pipelineId] ?? []).map((stage) => Number(stage.position) || 0)) + 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-[var(--brand-orange)]" />
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-[var(--text-primary)]">
              {t("crm.pipelines.title")}
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">
              {t("crm.pipelines.subtitle")}
            </p>
          </div>
        </div>
        {canManage && (
          <AppButton icon={Plus} onClick={() => setDialog({ type: "pipeline" })} className="shrink-0">
            {t("crm.pipelines.newPipeline")}
          </AppButton>
        )}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
        </div>
      ) : pipelines.length === 0 ? (
        <AppEmptyState icon={Settings} title={t("crm.pipelines.noPipelines")} />
      ) : (
        <div className="space-y-3">
          {pipelines.map((p) => (
            <div key={p.id} className="bg-[var(--surface-2)] border border-[var(--border-primary)] rounded-xl overflow-hidden">
              <button
                onClick={() => togglePipeline(p.id)}
                aria-expanded={Boolean(expanded[p.id])}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[var(--surface-3)] transition-colors"
              >
                <div className="flex items-center gap-3 text-left">
                  <span className="font-semibold text-[var(--text-primary)]">{p.name}</span>
                  {!p.is_active && (
                    <span className="text-xs text-[var(--text-secondary)] bg-[var(--surface-3)] px-2 py-0.5 rounded">
                      {t("crm.pipelines.inactive")}
                    </span>
                  )}
                  {p.description && (
                    <span className="text-sm text-[var(--text-secondary)]">{p.description}</span>
                  )}
                </div>
                <ChevronRight className={`w-4 h-4 text-[var(--text-secondary)] transition-transform ${expanded[p.id] ? "rotate-90" : ""}`} />
              </button>

              {expanded[p.id] && (
                <div className="border-t border-[var(--border-primary)] px-5 py-4 space-y-4">
                  {stages[p.id] ? (
                    stages[p.id].length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">{t("crm.pipelines.noStages")}</p>
                    ) : (
                      <ol className="flex flex-wrap gap-x-4 gap-y-2">
                        {stages[p.id].map((s, index) => (
                          <li key={s.id} className={`flex items-center gap-2 ${s.is_active ? "" : "opacity-50"}`}>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${stageTone(s)}`}>
                              {s.position}. {s.name}
                            </span>
                            {s.probability > 0 && (
                              <span className="text-xs text-[var(--text-secondary)]">{s.probability}%</span>
                            )}
                            {canManage && (
                              <>
                                <button
                                  onClick={() => moveStage(p.id, index, -1)}
                                  disabled={index === 0}
                                  aria-label={`${t("crm.pipelines.moveStageEarlier")} — ${s.name}`}
                                  className="p-1 rounded text-[var(--text-secondary)] hover:bg-[var(--surface-3)] disabled:opacity-30"
                                >
                                  <ArrowLeft className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => moveStage(p.id, index, 1)}
                                  disabled={index === stages[p.id].length - 1}
                                  aria-label={`${t("crm.pipelines.moveStageLater")} — ${s.name}`}
                                  className="p-1 rounded text-[var(--text-secondary)] hover:bg-[var(--surface-3)] disabled:opacity-30"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setDialog({ type: "stage", pipeline: p, stage: s })}
                                  aria-label={`${t("crm.pipelines.editStage")} — ${s.name}`}
                                  className="p-1 rounded text-[var(--text-secondary)] hover:bg-[var(--surface-3)]"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => setStageActive(p.id, s, !s.is_active)}
                                  className="text-[10px] font-bold uppercase tracking-wide text-[var(--text-secondary)] hover:text-[var(--brand-orange)]"
                                >
                                  {s.is_active ? t("crm.pipelines.retireStage") : t("crm.pipelines.restoreStage")}
                                </button>
                              </>
                            )}
                          </li>
                        ))}
                      </ol>
                    )
                  ) : (
                    <Skeleton className="h-6 w-full" />
                  )}

                  {canManage && stages[p.id] && (
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--border-primary)]">
                      <AppButton size="sm" icon={Plus} onClick={() => setDialog({ type: "stage", pipeline: p })}>
                        {t("crm.pipelines.addStage")}
                      </AppButton>
                      <AppButton size="sm" variant="secondary" icon={Pencil} onClick={() => setDialog({ type: "pipeline", pipeline: p })}>
                        {t("crm.pipelines.editPipeline")}
                      </AppButton>
                      <AppButton size="sm" variant="ghost" onClick={() => setPipelineActive(p, !p.is_active)}>
                        {p.is_active ? t("crm.pipelines.deactivate") : t("crm.pipelines.activate")}
                      </AppButton>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {dialog?.type === "pipeline" && (
        <CrmPipelineFormModal pipeline={dialog.pipeline} onClose={() => setDialog(null)} onSaved={handleSaved} />
      )}
      {dialog?.type === "stage" && (
        <CrmStageFormModal
          pipelineId={dialog.pipeline.id}
          stage={dialog.stage}
          nextPosition={nextPosition(dialog.pipeline.id)}
          onClose={() => setDialog(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
