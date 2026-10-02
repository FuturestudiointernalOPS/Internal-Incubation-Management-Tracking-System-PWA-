"use client";

import { Compass, Flag, Package, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const PRIORITIES = ["high", "medium", "low"];

/**
 * The editable proposal: journeys → milestones → tasks, with their owners,
 * dates, dependencies, tracker extras and deliverables.
 *
 * The working copy, the patch handlers, the milestone removal handler and the
 * shared owner field all live in the parent (`PlanReview`); they arrive here as
 * props of the same name. This component only renders.
 */
export default function PlanProposalEditor({
  proposal,
  inputClass,
  patchJourney,
  patchMilestone,
  patchTask,
  removeMilestone,
  ownerField,
}) {
  const { t } = useI18n();

  return (
    <>
      {(proposal.journeys || []).map((journey, ji) => (
        <div key={`${journey.name}-${ji}`} className="rounded-xl border border-[var(--border-primary)] p-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                <Compass className="w-3 h-3 text-[var(--brand-orange)]" />
                {t("venture.planImport.journeyName")}
              </span>
              <input
                value={journey.name || ""}
                onChange={(event) => patchJourney(ji, { name: event.target.value })}
                className={inputClass}
              />
            </label>
            <label className="space-y-1 sm:col-span-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                {t("venture.planImport.objective")}
              </span>
              <textarea
                rows={2}
                value={journey.objective || ""}
                onChange={(event) => patchJourney(ji, { objective: event.target.value || null })}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                {t("venture.planImport.start")}
              </span>
              <input
                type="date"
                value={journey.start_date || ""}
                onChange={(event) => patchJourney(ji, { start_date: event.target.value || null })}
                className={inputClass}
              />
            </label>
            <label className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                {t("venture.planImport.target")}
              </span>
              <input
                type="date"
                value={journey.target_date || ""}
                onChange={(event) =>
                  patchJourney(ji, { target_date: event.target.value || null, dates_derived: null })
                }
                className={inputClass}
              />
            </label>
            {journey.dates_derived && (
              <p className="text-[9px] text-sky-400 sm:col-span-2">{t("venture.planImport.suggestedDates")}</p>
            )}
          </div>

          <div className="space-y-2 pl-4">
            {(journey.milestones || []).map((milestone, mi) => (
              <div key={`${milestone.name}-${mi}`} className="rounded-lg border border-divider/60 p-2.5 space-y-2">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeMilestone(ji, mi)}
                    className="text-[9px] font-black uppercase tracking-widest text-rose-400 hover:bg-rose-500/10 px-2 py-1 rounded-lg flex items-center gap-1.5"
                  >
                    <Trash2 className="w-3 h-3" />
                    {t("venture.planImport.removeMilestone")}
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <Flag className="w-3 h-3 text-sky-400" />
                      {t("venture.planImport.name")}
                      {milestone.ref && <span className="text-slate-500 normal-case">({milestone.ref})</span>}
                    </span>
                    <input
                      value={milestone.name || ""}
                      onChange={(event) => patchMilestone(ji, mi, { name: event.target.value })}
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      {t("venture.planImport.target")}
                    </span>
                    <input
                      type="date"
                      value={milestone.target_date || ""}
                      onChange={(event) =>
                        patchMilestone(ji, mi, { target_date: event.target.value || null, dates_derived: null })
                      }
                      className={inputClass}
                    />
                  </label>
                  <label className="space-y-1 sm:col-span-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                      {t("venture.planImport.objective")}
                    </span>
                    <input
                      value={milestone.objective || ""}
                      onChange={(event) => patchMilestone(ji, mi, { objective: event.target.value || null })}
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="space-y-1.5">
                  {(milestone.tasks || []).map((task, ti) => (
                    <div key={`${task.title}-${ti}`} className="rounded-lg border border-divider/50 p-2 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        {task.ref && <span className="text-[8px] font-black text-slate-500">{task.ref}</span>}
                        <input
                          value={task.title || ""}
                          onChange={(event) => patchTask(ji, mi, ti, { title: event.target.value })}
                          className={`${inputClass} flex-1 min-w-[180px]`}
                        />
                        <select
                          value={task.priority || ""}
                          onChange={(event) => patchTask(ji, mi, ti, { priority: event.target.value || null })}
                          className={`${inputClass} w-24`}
                        >
                          <option value="">{t("venture.planImport.priority")}</option>
                          {PRIORITIES.map((priority) => (
                            <option key={priority} value={priority}>
                              {t(`venture.planImport.priorities.${priority}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1.5">
                          {t("venture.planImport.owner")}
                          {ownerField(task, (patch) => patchTask(ji, mi, ti, patch))}
                        </span>
                        <span className="flex items-center gap-1.5">
                          {t("venture.planImport.start")}
                          <input
                            type="date"
                            value={task.start_date || ""}
                            onChange={(event) => patchTask(ji, mi, ti, { start_date: event.target.value || null })}
                            className={`${inputClass} w-36`}
                          />
                        </span>
                        <span className="flex items-center gap-1.5">
                          {t("venture.planImport.due")}
                          <input
                            type="date"
                            value={task.due_date || ""}
                            onChange={(event) => patchTask(ji, mi, ti, { due_date: event.target.value || null })}
                            className={`${inputClass} w-36`}
                          />
                        </span>
                        {(task.depends_on || []).length > 0 && (
                          <span className="uppercase tracking-widest text-[8px]">
                            {t("venture.planImport.dependsOn", { refs: task.depends_on.join(", ") })}
                          </span>
                        )}
                      </div>
                      {/* What the tracker carried beyond the task itself. Shown
                          because it is ABOUT to be folded into the task's labels
                          and description — nothing is stored invisibly. */}
                      {(task.support || task.phase || task.definition_of_done) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[9px] text-slate-500">
                          {task.support && (
                            <span>
                              {t("venture.planImport.supportLabel")}: {task.support}
                            </span>
                          )}
                          {task.phase && (
                            <span>
                              {t("venture.planImport.phaseLabel")}: {task.phase}
                            </span>
                          )}
                          {task.definition_of_done && (
                            <span className="truncate max-w-md">
                              {t("venture.planImport.dodLabel")}: {task.definition_of_done}
                            </span>
                          )}
                        </div>
                      )}
                      {(task.deliverables || []).length > 0 && (
                        <div className="space-y-1">
                          {(task.deliverables || []).map((deliverable, di) => (
                            <div key={`${deliverable.title}-${di}`} className="flex items-center gap-1.5">
                              <Package className="w-3 h-3 text-slate-500 shrink-0" />
                              <input
                                value={deliverable.title || ""}
                                onChange={(event) =>
                                  patchTask(ji, mi, ti, {
                                    deliverables: task.deliverables.map((item, index) =>
                                      index === di ? { ...item, title: event.target.value } : item,
                                    ),
                                  })
                                }
                                className={`${inputClass} flex-1 max-w-md`}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
