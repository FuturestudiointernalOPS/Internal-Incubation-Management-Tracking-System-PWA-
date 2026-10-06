"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { nextMilestoneDate, todayDateInput } from "@/lib/ventureMilestoneDates";
import {
  Flag,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import VenturePersonField from "@/components/ventures/VenturePersonField";

/**
 * Add-a-milestone form of a journey (title, description, objective, owner,
 * target date and the deliverables it owes), or the button that opens it.
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function AddMilestoneForm({
  DELIVERABLE_TYPES,
  addMilestone,
  addMilestoneDeliverable,
  emptyMilestoneForm,
  milestoneAddFor,
  milestoneDeliverables,
  milestoneForm,
  milestoneSaving,
  removeMilestoneDeliverable,
  setMilestoneAddFor,
  setMilestoneDeliverables,
  setMilestoneForm,
  stage,
  stages,
  updateMilestoneDeliverable,
}) {
  const { t } = useI18n();
  return (
    <>
      {milestoneAddFor === stage.id ? (
        <form onSubmit={(event) => addMilestone(event, stage)} className="rounded-xl border border-[var(--border-primary)] bg-tertiary p-3 space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] flex items-center gap-1.5">
            <Flag className="w-3.5 h-3.5" /> {t("venture.manager.addMilestone")}
          </p>
          <input
            value={milestoneForm.title}
            onChange={(event) => setMilestoneForm({ ...milestoneForm, title: event.target.value })}
            placeholder={t("venture.manager.milestoneTitlePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            required
          />
          <textarea
            value={milestoneForm.description}
            onChange={(event) => setMilestoneForm({ ...milestoneForm, description: event.target.value })}
            rows={2}
            placeholder={t("venture.manager.milestoneDescPlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
          />
          <input
            value={milestoneForm.objective}
            onChange={(event) => setMilestoneForm({ ...milestoneForm, objective: event.target.value })}
            placeholder={t("venture.manager.stageObjectivePlaceholder")}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
          />
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.manager.milestoneOwner")}</label>
            <VenturePersonField
              value={{ cid: milestoneForm.owner_cid, name: milestoneForm.owner_name }}
              onChange={({ cid, name }) =>
                setMilestoneForm({ ...milestoneForm, owner_cid: cid || "", owner_name: name || "" })
              }
              listId="milestone-owner-options"
            />
          </div>
          <input
            type="date"
            value={milestoneForm.target_date}
            min={todayDateInput()}
            max={nextMilestoneDate(stages, { stageId: stage.id }) || undefined}
            onChange={(event) => setMilestoneForm({ ...milestoneForm, target_date: event.target.value })}
            className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
          />

          {/* Deliverables are defined with the milestone, so
              the milestone is never created empty. */}
          <div className="space-y-2 rounded-lg border border-[var(--border-primary)] p-2.5">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">
              {t("venture.manager.deliverables")}
            </p>
            {milestoneDeliverables.map((deliverable, deliverableIndex) => (
              <div key={deliverableIndex} className="flex flex-wrap items-center gap-2">
                <input
                  value={deliverable.title}
                  onChange={(event) => updateMilestoneDeliverable(deliverableIndex, { title: event.target.value })}
                  placeholder={t("venture.manager.deliverableTitlePlaceholder")}
                  className="flex-1 min-w-[150px] px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                />
                <select
                  value={deliverable.deliverable_type}
                  onChange={(event) => updateMilestoneDeliverable(deliverableIndex, { deliverable_type: event.target.value })}
                  className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                >
                  {DELIVERABLE_TYPES.map((deliverableType) => (
                    <option key={deliverableType} value={deliverableType}>{t(`venture.manager.deliverableTypes.${deliverableType}`)}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={deliverable.due_date}
                  min={milestoneForm.target_date || todayDateInput()}
                  onChange={(event) => updateMilestoneDeliverable(deliverableIndex, { due_date: event.target.value })}
                  className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                />
                <button type="button" onClick={() => removeMilestoneDeliverable(deliverableIndex)} className="p-1 text-slate-500 hover:text-rose-400" title={t("common.delete")}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button type="button" onClick={addMilestoneDeliverable} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)]">
              <Plus className="w-3 h-3" /> {t("venture.manager.addDeliverable")}
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setMilestoneAddFor(null); setMilestoneForm(emptyMilestoneForm); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:text-[var(--text-primary)]">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={milestoneSaving} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1.5 disabled:opacity-50">
              {milestoneSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {t("venture.manager.addMilestone")}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => { setMilestoneAddFor(stage.id); setMilestoneForm(emptyMilestoneForm); setMilestoneDeliverables([]); }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-[var(--brand-orange)] border border-brand-orange/30 hover:bg-brand-orange/10"
        >
          <Plus className="w-3.5 h-3.5" /> {t("venture.manager.addMilestone")}
        </button>
      )}
    </>
  );
}
