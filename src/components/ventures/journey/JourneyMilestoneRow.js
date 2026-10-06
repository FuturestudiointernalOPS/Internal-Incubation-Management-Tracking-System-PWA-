"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { earliestStoredDate, nextMilestoneDate, todayDateInput } from "@/lib/ventureMilestoneDates";
import { datePickerCeiling, datePickerFloor } from "@/components/ventures/journey/journeyShapers";
import { Flag, ChevronDown, ChevronRight, Loader2, Save } from "lucide-react";
import AppMenu from "@/components/ui/AppMenu";
import VenturePersonField from "@/components/ventures/VenturePersonField";
import ScopedNotes from "@/components/ventures/ScopedNotes";
import MilestoneReviewInbox from "@/components/ventures/journey/MilestoneReviewInbox";
import MilestoneDeliverables from "@/components/ventures/journey/MilestoneDeliverables";
import MilestoneSessionBooking from "@/components/ventures/journey/MilestoneSessionBooking";
import MilestoneSessionsList from "@/components/ventures/journey/MilestoneSessionsList";

/**
 * ONE milestone inside a journey: its edit form, its header row, its review
 * inbox, its deliverables, its session booking and its booked sessions.
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function JourneyMilestoneRow({
  milestone,
  milestoneIndex,
  milestones,
  stage,
  stages,
  access,
  milestoneEditId,
  setMilestoneEditId,
  milestoneEditForm,
  setMilestoneEditForm,
  saveMilestoneEdit,
  milestoneOpenId,
  toggleMilestoneOpen,
  milestoneAuthority,
  milestoneBusy,
  milestoneMenuItems,
  milestoneDotClass,
  milestoneStatusClass,
  milestoneStatusKey,
  fmtDate,
  milestoneSubmissions,
  submissionReview,
  submissionComment,
  submissionsBusy,
  decideSubmission,
  setSubmissionReview,
  setSubmissionComment,
  DELIVERABLE_TYPES,
  addDeliverable,
  deliverableAction,
  deliverableAddFor,
  deliverableBusy,
  deliverableFile,
  deliverableForm,
  deliverableMenuItems,
  deliverableNewUrl,
  deliverableSaving,
  deliverableStatus,
  deliverableText,
  emptyDeliverableForm,
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
  coachOptions,
  openBooking,
  setBookFor,
  setBookForm,
  ventureId,
  ventureSessions,
  sessionStatusKey,
  noteEditFor,
  noteDraft,
  setNoteDraft,
  noteSaving,
  saveSessionNote,
  setNoteEditFor,
  notesMilestoneId,
}) {
  const { t } = useI18n();
  const deliverableList = milestone.deliverables || [];
  // A milestone may not be dated after what it owes, nor
  // after a milestone that follows it: the picker stops at
  // whichever of the two comes first.
  const milestoneDateCeiling = earliestStoredDate([
    nextMilestoneDate(stages, { milestoneId: milestone.id }),
    earliestStoredDate(deliverableList.map((deliverable) => deliverable.due_date)),
  ]);
  const isOpen = milestoneOpenId !== null && String(milestoneOpenId) === String(milestone.id);
  return (
    <div className="px-3 py-2">
      {milestoneEditId === milestone.id ? (
        <form onSubmit={saveMilestoneEdit} className="space-y-2 py-1">
          <input
            value={milestoneEditForm.title || ""}
            onChange={(event) => setMilestoneEditForm({ ...milestoneEditForm, title: event.target.value })}
            placeholder={t("venture.manager.milestoneTitlePlaceholder")}
            className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
            required
          />
          <textarea
            value={milestoneEditForm.description || ""}
            onChange={(event) => setMilestoneEditForm({ ...milestoneEditForm, description: event.target.value })}
            rows={2}
            placeholder={t("venture.manager.milestoneDescPlaceholder")}
            className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
          />
          <input
            value={milestoneEditForm.objective || ""}
            onChange={(event) => setMilestoneEditForm({ ...milestoneEditForm, objective: event.target.value })}
            placeholder={t("venture.manager.stageObjectivePlaceholder")}
            className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
          />
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.manager.milestoneOwner")}</label>
            <VenturePersonField
              value={{ cid: milestoneEditForm.owner_cid, name: milestoneEditForm.owner_name }}
              onChange={({ cid, name }) =>
                setMilestoneEditForm({ ...milestoneEditForm, owner_cid: cid || "", owner_name: name || "" })
              }
              listId="milestone-owner-options"
            />
          </div>
          <input
            type="date"
            value={milestoneEditForm.target_date || ""}
            min={datePickerFloor(todayDateInput(), milestone.target_date)}
            max={datePickerCeiling(milestoneDateCeiling, milestone.target_date) || undefined}
            onChange={(event) => setMilestoneEditForm({ ...milestoneEditForm, target_date: event.target.value })}
            className="w-full px-2 py-1.5 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setMilestoneEditId(null); setMilestoneEditForm({}); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg border border-[var(--border-primary)] text-slate-500">
              {t("common.cancel")}
            </button>
            <button type="submit" className="text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1">
              <Save className="w-3 h-3" /> {t("common.save")}
            </button>
          </div>
        </form>
      ) : (
        <>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => toggleMilestoneOpen(milestone.id)}
            aria-expanded={isOpen}
            className="flex items-center gap-3 flex-1 min-w-0 text-left"
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${milestoneDotClass(milestone.status)}`} />
            <span className={`flex-1 min-w-0 text-[11px] font-bold text-[var(--text-primary)] truncate ${milestone.status === "completed" ? "line-through text-slate-400" : ""}`}>
              {milestone.title}
            </span>
            {deliverableList.length > 0 && (
              <span className="shrink-0 flex items-center gap-1 text-[9px] font-bold text-slate-500" title={t("venture.manager.deliverables")}>
                <Flag className="w-3 h-3" /> {deliverableList.length}
              </span>
            )}
            {isOpen ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-slate-500" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-slate-500" />}
          </button>
          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${milestoneStatusClass(milestone.status)}`}>
            {milestoneStatusKey(milestone.status)}
          </span>
          {milestoneAuthority && !stage.is_archived && (
            <AppMenu
              label={t("venture.manager.milestoneActions")}
              align="right"
              buttonClassName="!p-1"
              items={milestoneMenuItems(stage, milestone, milestoneIndex, milestones)}
            />
          )}
          {milestoneBusy === milestone.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400 shrink-0" />}
        </div>

        {/* The milestone's metadata, label → value, one row each: people first,
            then timing. Progress is deliberately absent from this view. */}
        {isOpen && (
          <div className="mt-2 ml-5 grid grid-cols-[92px_1fr] gap-x-3 gap-y-0.5 text-[10px]">
            <span className="font-bold text-[var(--text-secondary)]">{t("venture.manager.milestoneOwner")}</span>
            <span className="text-[var(--text-primary)]">{milestone.owner_name || "—"}</span>
            <span className="font-bold text-[var(--text-secondary)]">{t("venture.manager.supporting")}</span>
            <span className="text-[var(--text-primary)]">{milestone.support_name || "—"}</span>
            <span className="font-bold text-[var(--text-secondary)]">{t("venture.manager.startDate")}</span>
            <span className="text-[var(--text-primary)]">{milestone.start_date ? fmtDate(milestone.start_date) : "—"}</span>
            <span className="font-bold text-[var(--text-secondary)]">{t("venture.manager.dueDate")}</span>
            <span className="text-[var(--text-primary)]">{milestone.target_date ? fmtDate(milestone.target_date) : "—"}</span>
          </div>
        )}

        {/* Review inbox: what the Venture submitted for the tasks in this milestone */}
        {isOpen && (milestoneSubmissions[milestone.id] || []).length > 0 && (
          <MilestoneReviewInbox
            decideSubmission={decideSubmission}
            milestone={milestone}
            milestoneSubmissions={milestoneSubmissions}
            setSubmissionComment={setSubmissionComment}
            setSubmissionReview={setSubmissionReview}
            submissionComment={submissionComment}
            submissionReview={submissionReview}
            submissionsBusy={submissionsBusy}
          />
        )}

        {isOpen && (deliverableList.length > 0 || milestoneAuthority) && (
          <MilestoneDeliverables
            DELIVERABLE_TYPES={DELIVERABLE_TYPES}
            addDeliverable={addDeliverable}
            deliverableAction={deliverableAction}
            deliverableAddFor={deliverableAddFor}
            deliverableBusy={deliverableBusy}
            deliverableFile={deliverableFile}
            deliverableForm={deliverableForm}
            deliverableList={deliverableList}
            deliverableMenuItems={deliverableMenuItems}
            deliverableNewUrl={deliverableNewUrl}
            deliverableSaving={deliverableSaving}
            deliverableStatus={deliverableStatus}
            deliverableText={deliverableText}
            emptyDeliverableForm={emptyDeliverableForm}
            fmtDate={fmtDate}
            milestone={milestone}
            milestoneAuthority={milestoneAuthority}
            reviewDeliverable={reviewDeliverable}
            saveDeliverableEdit={saveDeliverableEdit}
            setDeliverableAction={setDeliverableAction}
            setDeliverableAddFor={setDeliverableAddFor}
            setDeliverableFile={setDeliverableFile}
            setDeliverableForm={setDeliverableForm}
            setDeliverableNewFile={setDeliverableNewFile}
            setDeliverableNewUrl={setDeliverableNewUrl}
            setDeliverableText={setDeliverableText}
            submitDeliverableEvidence={submitDeliverableEvidence}
          />
        )}

        {/* Book a session on this milestone (date + exact time) */}
        {isOpen && (milestoneAuthority || access.manage) && !stage.is_archived && (
          <MilestoneSessionBooking
            autoGrow={autoGrow}
            bookFor={bookFor}
            bookForm={bookForm}
            bookSaving={bookSaving}
            bookSession={bookSession}
            coachOptions={coachOptions}
            deliverableList={deliverableList}
            milestone={milestone}
            openBooking={openBooking}
            setBookFor={setBookFor}
            setBookForm={setBookForm}
            stage={stage}
          />
        )}

        {/* Sessions already booked on this milestone — the milestone stays the home of its sessions. */}
        {isOpen && (() => {
          const mine = ventureSessions.filter((session) => String(session.milestone_ref) === String(milestone.id) && session.status !== "cancelled");
          if (mine.length === 0) return null;
          return (
            <MilestoneSessionsList
              sessions={mine}
              deliverables={deliverableList}
              statusKey={sessionStatusKey}
              noteEditFor={noteEditFor}
              noteDraft={noteDraft}
              onNoteDraftChange={setNoteDraft}
              noteSaving={noteSaving}
              onEditNote={(session) => { setNoteEditFor(session.id); setNoteDraft(session.description || ""); }}
              onCancelNote={() => { setNoteEditFor(null); setNoteDraft(""); }}
              onSaveNote={saveSessionNote}
              autoGrow={autoGrow}
            />
          );
        })()}

        {/* Internal notes are milestone-scoped — they never exist outside a milestone. */}
        {isOpen && notesMilestoneId !== null && String(notesMilestoneId) === String(milestone.id) && (
          <div className="mt-2 ml-5">
            <ScopedNotes ventureId={ventureId} scopeType="milestone" scopeId={milestone.id} />
          </div>
        )}
        </>
      )}
    </div>
  );
}
