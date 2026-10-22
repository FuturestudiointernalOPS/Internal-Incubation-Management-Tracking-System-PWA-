"use client";

import QuickNote from "@/components/ventures/journey/QuickNote";
import ActivityReport from "@/components/ventures/journey/ActivityReport";
import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { datePickerFloor, groupActivitiesWithDeliverables, sessionBookingKey } from "@/components/ventures/journey/journeyShapers";
import MilestoneSessionBooking from "@/components/ventures/journey/MilestoneSessionBooking";
import { dateOnly, todayDateInput } from "@/lib/ventureMilestoneDates";
import { statusDotClass, statusLabel } from "@/lib/ventureStatuses";
import { Loader2, Plus, Save } from "lucide-react";
import AppMenu from "@/components/ui/AppMenu";
import VenturePersonField from "@/components/ventures/VenturePersonField";
import DeliverableDetailDialog from "@/components/ventures/journey/DeliverableDetailDialog";

/**
 * The deliverables of an open milestone: list, status, review, evidence
 * upload, edit and add.
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
// The kit tag for a status word (same tones as everywhere else).
const TAG_TONE = { blocked: "r", in_progress: "b", awaiting_review: "w", changes_requested: "r", completed: "g", approved: "g" };

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
  autoGrow,
  bookFor,
  bookForm,
  bookSaving,
  bookSession,
  canBook,
  coachOptions,
  openBooking,
  setBookFor,
  setBookForm,
  stage,
  ventureId,
}) {
  const { t } = useI18n();
  // The deliverable whose detail dialog is open (id only, so the dialog reads
  // the current row from props and a review/approval shows up live).
  const [detailId, setDetailId] = useState(null);
  const groups = groupActivitiesWithDeliverables(milestone.activities || [], deliverableList);
  const detailGroup =
    detailId == null
      ? null
      : groups.find((group) => group.deliverables.some((item) => item.id === detailId));
  const detailDeliverable =
    detailGroup?.deliverables.find((item) => item.id === detailId) || null;

  return (
    <div className="jy-del">
      <p className="jy-lbl">
        {t("venture.manager.deliverables")}
      </p>
      {groups.map((group, groupIndex) => (
        <div key={group.activity?.id ?? `group-${groupIndex}`} className="jy-act">
          {/* ACTIVITY — the work that produces what follows */}
          <div>
            <p className="jy-lbl">{t("venture.manager.activityLabel")}</p>
            <p className="text-[13px] font-semibold text-[var(--text-primary)] mt-0.5">
              {group.activity?.source_ref && (
                <span className="stf-tag mr-1.5 align-middle">{group.activity.source_ref}</span>
              )}
              {group.activity?.title || t("venture.manager.notProvided")}
            </p>
            {group.activity?.description && (
              <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{group.activity.description}</p>
            )}
          </div>

          {/* DELIVERABLE(S) — the output, underneath its activity */}
          <div className="space-y-1">
            {group.deliverables.length > 0 && (
              <p className="jy-lbl">{t("venture.manager.deliverableLabel")}</p>
            )}
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
                  <button type="button" onClick={() => setDeliverableAction(null)} className="stf-btn sm">
                    {t("common.cancel")}
                  </button>
                  <button type="submit" disabled={deliverableSaving} className="stf-btn sm pr">
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
                  className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2.5 file:py-1 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-[var(--brand-orange)] file:text-black"
                />
                <p className="text-[9px] uppercase tracking-widest text-slate-500">{t("venture.manager.orPasteLink")}</p>
                <input
                  value={deliverableText}
                  onChange={(event) => setDeliverableText(event.target.value)}
                  placeholder={t("venture.manager.evidenceUrlPlaceholder")}
                  className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => { setDeliverableAction(null); setDeliverableFile(null); }} className="stf-btn sm">
                    {t("common.cancel")}
                  </button>
                  <button type="button" onClick={submitDeliverableEvidence} disabled={deliverableSaving || (!deliverableFile && !deliverableText.trim())} className="stf-btn sm pr">
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
                  <button type="button" onClick={() => setDeliverableAction(null)} className="stf-btn sm">
                    {t("common.cancel")}
                  </button>
                  <button type="button" onClick={() => reviewDeliverable(deliverable, "changes_requested")} disabled={deliverableBusy === deliverable.id || !deliverableText.trim()} className="stf-btn sm rj">
                    {t("venture.manager.requestChanges")}
                  </button>
                </div>
              </div>
            ) : (
              <>
              <div className="jy-drow">
                <span className={`jy-dot ${statusDotClass(status)}`} />
                <button
                  type="button"
                  onClick={() => setDetailId(deliverable.id)}
                  aria-label={`${t("venture.manager.viewDetails")}: ${deliverable.title}`}
                  className="t whitespace-normal break-words focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-orange)]/60 rounded"
                >
                  {deliverable.title}
                </button>
                {deliverable.due_date && <span className="hidden sm:inline text-[11.5px] text-[var(--text-secondary)]">{fmtDate(deliverable.due_date)}</span>}
                {deliverable.attachment_url && (
                  <a href={deliverable.evidence_download_url || deliverable.attachment_url} target="_blank" rel="noreferrer" className="text-[11.5px] font-semibold text-[var(--brand-orange)] hover:underline shrink-0">
                    {deliverable.attachment_name || t("venture.manager.viewEvidence")}
                  </a>
                )}
                <span className={`stf-tag ${TAG_TONE[status?.tone] || ""} shrink-0`}>
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
                  {!mode && deliverable.description && (
                    <p className="text-[12px] text-[var(--text-secondary)] mt-1.5 whitespace-pre-line break-words">
                      {deliverable.description}
                    </p>
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
            <p className="jy-lbl">{t("venture.manager.definitionOfDone")}</p>
            <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">{group.activity?.definition_of_done || t("venture.manager.notProvided")}</p>
          </div>

          {/* METADATA — people and timing, kept out of the prose */}
          <div className="jy-facts in">
            <div><span>{t("venture.manager.milestoneOwner")}</span><b>{group.activity?.owner_name || group.deliverables[0]?.assigned_name || "—"}</b></div>
            <div><span>{t("venture.manager.supporting")}</span><b>{group.activity?.support_name || "—"}</b></div>
            <div><span>{t("venture.manager.startDate")}</span><b>{group.activity?.start_date ? fmtDate(group.activity.start_date) : "—"}</b></div>
            <div><span>{t("venture.manager.finishDate")}</span><b>{(group.activity?.due_date || group.deliverables[0]?.due_date) ? fmtDate(group.activity?.due_date || group.deliverables[0]?.due_date) : "—"}</b></div>
          </div>

          {/* Book a session AGAINST THIS ACTIVITY (date + exact time) */}
          <div className="jy-btns">
          {canBook && (
            <MilestoneSessionBooking
              autoGrow={autoGrow}
              bookFor={bookFor}
              bookForKey={sessionBookingKey(milestone, group.activity, group.deliverables[0]?.id ?? null)}
              bookForm={bookForm}
              bookSaving={bookSaving}
              bookSession={bookSession}
              coachOptions={coachOptions}
              deliverableList={group.deliverables}
              milestone={milestone}
              onOpen={() => openBooking(milestone, group.activity, group.deliverables[0]?.id ?? null)}
              setBookFor={setBookFor}
              setBookForm={setBookForm}
              stage={stage}
            />
          )}
            <QuickNote
              ventureId={ventureId}
              milestoneId={milestone.id}
              subject={`${group.activity?.source_ref ? `${group.activity.source_ref} · ` : ""}${group.activity?.title || milestone.title || ""}`.trim()}
            />
            <ActivityReport ventureId={ventureId} milestone={milestone} activity={group.activity} />
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
              className="w-full text-[10px] text-slate-400 file:mr-2 file:px-2.5 file:py-1 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-[var(--brand-orange)] file:text-black"
            />
            <input
              value={deliverableNewUrl}
              onChange={(event) => setDeliverableNewUrl(event.target.value)}
              placeholder={t("venture.manager.orPasteLink")}
              className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setDeliverableAddFor(null); setDeliverableForm(emptyDeliverableForm); setDeliverableNewFile(null); setDeliverableNewUrl(""); }} className="stf-btn sm">
                {t("common.cancel")}
              </button>
              <button type="submit" disabled={deliverableSaving} className="stf-btn sm pr">
                {deliverableSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} {t("venture.manager.addDeliverable")}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => { setDeliverableAddFor(milestone.id); setDeliverableForm(emptyDeliverableForm); setDeliverableNewFile(null); setDeliverableNewUrl(""); }}
            className="stf-btn sm"
          >
            <Plus className="w-3 h-3" /> {t("venture.manager.addDeliverable")}
          </button>
        )
      )}

      <DeliverableDetailDialog
        deliverable={detailDeliverable}
        activity={detailGroup?.activity || null}
        onClose={() => setDetailId(null)}
      />
    </div>
  );
}
