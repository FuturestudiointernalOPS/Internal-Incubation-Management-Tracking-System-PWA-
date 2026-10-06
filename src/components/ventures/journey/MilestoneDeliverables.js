"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { datePickerFloor, groupDeliverablesByActivity } from "@/components/ventures/journey/journeyShapers";
import { dateOnly, todayDateInput } from "@/lib/ventureMilestoneDates";
import { statusChipClass, statusDotClass, statusLabel } from "@/lib/ventureStatuses";
import { Loader2, Plus, Save } from "lucide-react";
import AppMenu from "@/components/ui/AppMenu";
import VenturePersonField from "@/components/ventures/VenturePersonField";

/**
 * The deliverables of an open milestone: list, status, review, evidence
 * upload, edit and add.
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function MilestoneDeliverables({
  DELIVERABLE_TYPES,
  addDeliverable,
  deliverableAction,
  deliverableAddFor,
  deliverableBusy,
  deliverableFile,
  deliverableForm,
  deliverableList,
  deliverableMenuItems,
  deliverableNewUrl,
  deliverableSaving,
  deliverableStatus,
  deliverableText,
  emptyDeliverableForm,
  fmtDate,
  milestone,
  milestoneAuthority,
  reviewDeliverable,
  saveDeliverableEdit,
  setDeliverableAction,
  setDeliverableAddFor,
  setDeliverableFile,
  setDeliverableForm,
  setDeliverableNewFile,
  setDeliverableNewUrl,
  setDeliverableText,
  submitDeliverableEvidence,
}) {
  const { t } = useI18n();
  return (
    <div className="mt-2 ml-5 space-y-1.5">
      <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">
        {t("venture.manager.deliverables")}
      </p>
      {groupDeliverablesByActivity(deliverableList).map((group, groupIndex) => (
        <div key={group.activity?.id ?? `group-${groupIndex}`} className="rounded-lg border border-divider/70 px-2.5 py-2 space-y-2">
          {/* ACTIVITY — the work that produces what follows */}
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">{t("venture.manager.activityLabel")}</p>
            <p className="text-[11px] font-bold text-[var(--text-primary)] mt-0.5">
              {group.activity?.source_ref && (
                <span className="mr-1.5 px-1 py-0.5 rounded bg-tertiary text-[8px] font-black text-slate-500 align-middle">{group.activity.source_ref}</span>
              )}
              {group.activity?.title || t("venture.manager.notProvided")}
            </p>
            {group.activity?.description && (
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{group.activity.description}</p>
            )}
          </div>

          {/* DELIVERABLE(S) — the output, underneath its activity */}
          <div className="space-y-1">
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">{t("venture.manager.deliverableLabel")}</p>
            {group.deliverables.map((deliverable) => {
              const status = deliverableStatus(deliverable);
              const mode = deliverableAction?.id === deliverable.id ? deliverableAction.mode : null;
              return (
                <div key={deliverable.id}>
                  {mode === "edit" ? (
              <form onSubmit={(event) => saveDeliverableEdit(event, deliverable, milestone)} className="space-y-2">
                <input
                  value={deliverableForm.title}
                  onChange={(event) => setDeliverableForm({ ...deliverableForm, title: event.target.value })}
                  placeholder={t("venture.manager.deliverableTitlePlaceholder")}
                  className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                  required
                />
                <textarea
                  value={deliverableForm.description}
                  onChange={(event) => setDeliverableForm({ ...deliverableForm, description: event.target.value })}
                  rows={2}
                  placeholder={t("venture.manager.deliverableDescPlaceholder")}
                  className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                />
                <div className="space-y-1 mt-2">
                  <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.manager.deliverableAssignee")}</label>
                  <VenturePersonField
                    value={{ cid: deliverableForm.assigned_cid, name: deliverableForm.assigned_name }}
                    onChange={({ cid, name }) =>
                      setDeliverableForm({ ...deliverableForm, assigned_cid: cid || "", assigned_name: name || "" })
                    }
                    listId="deliverable-assignee-options"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={deliverableForm.due_date}
                    min={datePickerFloor(dateOnly(milestone.target_date) || todayDateInput(), deliverable.due_date)}
                    onChange={(event) => setDeliverableForm({ ...deliverableForm, due_date: event.target.value })}
                    className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                  />
                  <select
                    value={deliverableForm.deliverable_type}
                    onChange={(event) => setDeliverableForm({ ...deliverableForm, deliverable_type: event.target.value })}
                    className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                  >
                    {DELIVERABLE_TYPES.map((deliverableType) => (
                      <option key={deliverableType} value={deliverableType}>{t(`venture.manager.deliverableTypes.${deliverableType}`)}</option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setDeliverableAction(null)} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                    {t("common.cancel")}
                  </button>
                  <button type="submit" disabled={deliverableSaving} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1 disabled:opacity-50">
                    {deliverableSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} {t("common.save")}
                  </button>
                </div>
              </form>
            ) : mode === "submit" ? (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-[var(--text-primary)]">{deliverable.title}</p>
                <p className="text-[9px] uppercase tracking-widest text-slate-500">{t("venture.manager.attachFile")}</p>
                <input
                  type="file"
                  onChange={(event) => setDeliverableFile(event.target.files?.[0] || null)}
                  className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2.5 file:py-1 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-[var(--brand-orange)] file:text-black"
                />
                <p className="text-[9px] uppercase tracking-widest text-slate-500">{t("venture.manager.orPasteLink")}</p>
                <input
                  value={deliverableText}
                  onChange={(event) => setDeliverableText(event.target.value)}
                  placeholder={t("venture.manager.evidenceUrlPlaceholder")}
                  className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setDeliverableAction(null); setDeliverableFile(null); }} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                    {t("common.cancel")}
                  </button>
                  <button type="button" onClick={submitDeliverableEvidence} disabled={deliverableSaving || (!deliverableFile && !deliverableText.trim())} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[var(--brand-orange)] text-black disabled:opacity-50">
                    {deliverableSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} {t("venture.manager.submitEvidence")}
                  </button>
                </div>
              </div>
            ) : mode === "review" ? (
              <div className="space-y-2">
                <p className="text-[11px] font-bold text-[var(--text-primary)]">{deliverable.title}</p>
                <textarea
                  value={deliverableText}
                  onChange={(event) => setDeliverableText(event.target.value)}
                  rows={2}
                  placeholder={t("venture.manager.reviewCommentsPlaceholder")}
                  className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setDeliverableAction(null)} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                    {t("common.cancel")}
                  </button>
                  <button type="button" onClick={() => reviewDeliverable(deliverable, "changes_requested")} disabled={deliverableBusy === deliverable.id || !deliverableText.trim()} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 disabled:opacity-50">
                    {t("venture.manager.requestChanges")}
                  </button>
                </div>
              </div>
            ) : (
              <>
              <div className="flex items-center gap-2">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDotClass(status)}`} />
                <p className="flex-1 min-w-0 text-[11px] font-bold text-[var(--text-primary)] truncate">{deliverable.title}</p>
                {deliverable.due_date && <span className="hidden sm:inline text-[9px] text-slate-500">{fmtDate(deliverable.due_date)}</span>}
                {deliverable.attachment_url && (
                  <a href={deliverable.evidence_download_url || deliverable.attachment_url} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-sky-300 hover:underline shrink-0">
                    {deliverable.attachment_name || t("venture.manager.viewEvidence")}
                  </a>
                )}
                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${statusChipClass(status)}`}>
                  {statusLabel(status, t)}
                </span>
                {milestoneAuthority && (
                  <AppMenu
                    label={t("venture.manager.deliverableActions")}
                    align="right"
                    buttonClassName="!p-1"
                    items={deliverableMenuItems(deliverable)}
                  />
                )}
                {deliverableBusy === deliverable.id && <Loader2 className="w-3 h-3 animate-spin text-slate-400 shrink-0" />}
              </div>
              </>
            )}
                  {!mode && deliverable.approval_status === "rejected" && deliverable.rejection_reason && (
                    <p className="text-[9px] text-rose-400 mt-1">
                      {t("venture.manager.changesRequestedReason", { reason: deliverable.rejection_reason })}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* DEFINITION OF DONE — what makes the activity complete */}
          <div>
            <p className="text-[8px] font-black uppercase tracking-widest text-slate-500">{t("venture.manager.definitionOfDone")}</p>
            <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">{group.activity?.definition_of_done || t("venture.manager.notProvided")}</p>
          </div>

          {/* METADATA — people and timing, kept out of the prose */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[10px]">
            <span>
              <span className="font-bold text-[var(--text-secondary)]">{t("venture.manager.milestoneOwner")}:</span>{" "}
              <span className="text-[var(--text-primary)]">{group.activity?.owner_name || group.deliverables[0]?.assigned_name || "—"}</span>
            </span>
            <span>
              <span className="font-bold text-[var(--text-secondary)]">{t("venture.manager.supporting")}:</span>{" "}
              <span className="text-[var(--text-primary)]">{group.activity?.support_name || "—"}</span>
            </span>
            <span>
              <span className="font-bold text-[var(--text-secondary)]">{t("venture.manager.startDate")}:</span>{" "}
              <span className="text-[var(--text-primary)]">{group.activity?.start_date ? fmtDate(group.activity.start_date) : "—"}</span>
            </span>
            <span>
              <span className="font-bold text-[var(--text-secondary)]">{t("venture.manager.finishDate")}:</span>{" "}
              <span className="text-[var(--text-primary)]">{(group.activity?.due_date || group.deliverables[0]?.due_date) ? fmtDate(group.activity?.due_date || group.deliverables[0]?.due_date) : "—"}</span>
            </span>
          </div>
        </div>
      ))}

      {milestoneAuthority && (
        deliverableAddFor === milestone.id ? (
          <form onSubmit={(event) => addDeliverable(event, milestone)} className="rounded-lg border border-[var(--border-primary)] bg-tertiary p-2.5 space-y-2">
            <input
              value={deliverableForm.title}
              onChange={(event) => setDeliverableForm({ ...deliverableForm, title: event.target.value })}
              placeholder={t("venture.manager.deliverableTitlePlaceholder")}
              className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
              required
            />
            <textarea
              value={deliverableForm.description}
              onChange={(event) => setDeliverableForm({ ...deliverableForm, description: event.target.value })}
              rows={2}
              placeholder={t("venture.manager.deliverableDescPlaceholder")}
              className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
            />
            <div className="space-y-1 mt-2">
              <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.manager.deliverableAssignee")}</label>
              <VenturePersonField
                value={{ cid: deliverableForm.assigned_cid, name: deliverableForm.assigned_name }}
                onChange={({ cid, name }) =>
                  setDeliverableForm({ ...deliverableForm, assigned_cid: cid || "", assigned_name: name || "" })
                }
                listId="deliverable-assignee-options"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={deliverableForm.due_date}
                min={dateOnly(milestone.target_date) || todayDateInput()}
                onChange={(event) => setDeliverableForm({ ...deliverableForm, due_date: event.target.value })}
                className="flex-1 min-w-[140px] px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
              />
              <select
                value={deliverableForm.deliverable_type}
                onChange={(event) => setDeliverableForm({ ...deliverableForm, deliverable_type: event.target.value })}
                className="px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
              >
                {DELIVERABLE_TYPES.map((deliverableType) => (
                  <option key={deliverableType} value={deliverableType}>{t(`venture.manager.deliverableTypes.${deliverableType}`)}</option>
                ))}
              </select>
            </div>
            {/* Optional: attach the document itself now. */}
            <p className="text-[9px] uppercase tracking-widest text-slate-500">{t("venture.manager.attachFile")}</p>
            <input
              type="file"
              onChange={(event) => setDeliverableNewFile(event.target.files?.[0] || null)}
              className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2.5 file:py-1 file:rounded-lg file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-[var(--brand-orange)] file:text-black"
            />
            <input
              value={deliverableNewUrl}
              onChange={(event) => setDeliverableNewUrl(event.target.value)}
              placeholder={t("venture.manager.orPasteLink")}
              className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setDeliverableAddFor(null); setDeliverableForm(emptyDeliverableForm); setDeliverableNewFile(null); setDeliverableNewUrl(""); }} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={deliverableSaving} className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1 disabled:opacity-50">
                {deliverableSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} {t("venture.manager.addDeliverable")}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => { setDeliverableAddFor(milestone.id); setDeliverableForm(emptyDeliverableForm); setDeliverableNewFile(null); setDeliverableNewUrl(""); }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest text-slate-400 border border-[var(--border-primary)] hover:text-[var(--brand-orange)]"
          >
            <Plus className="w-3 h-3" /> {t("venture.manager.addDeliverable")}
          </button>
        )
      )}
    </div>
  );
}
