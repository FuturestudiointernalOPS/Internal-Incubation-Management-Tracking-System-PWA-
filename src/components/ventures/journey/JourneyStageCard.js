"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { CheckCircle2, RotateCcw, Save, Square, CheckSquare } from "lucide-react";
import AppMenu from "@/components/ui/AppMenu";
import JourneyReportSection from "@/components/ventures/journey/JourneyReportSection";
import JourneyMilestoneRow from "@/components/ventures/journey/JourneyMilestoneRow";
import AddMilestoneForm from "@/components/ventures/journey/AddMilestoneForm";

/**
 * ONE journey stage on the timeline: its connector and numbered node, its
 * inline edit form (or its card header, buttons, meta and progress), its
 * report section and the milestones it owes.
 *
 * Moved verbatim out of JourneyManagerPanel: every prop carries the panel
 * value of the same name (state, setter, handler or loop value), so the markup
 * and its behaviour are unchanged. The panel keeps all state and all writes.
 */
export default function JourneyStageCard({
  stage,
  index,
  visibleStagesCount,
  access,
  editId,
  setEditId,
  editForm,
  setEditForm,
  saveEdit,
  stageNodeClass,
  statusPill,
  toggleSelectStage,
  selectedStageIds,
  journeyMenuItems,
  restoreOneJourney,
  bulkBusy,
  reportsByStage,
  reportFor,
  reportForm,
  reportOpenId,
  reportSaving,
  reportStatusLabel,
  saveReport,
  setReportFor,
  setReportForm,
  setReportOpenId,
  openReportComposer,
  autoGrow,
  stages,
  milestoneAuthority,
  milestoneEditId,
  setMilestoneEditId,
  milestoneEditForm,
  setMilestoneEditForm,
  saveMilestoneEdit,
  milestoneOpenId,
  toggleMilestoneOpen,
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
  updateMilestoneDeliverable,
}) {
  const { t, lang } = useI18n();
  const isEditing = editId === stage.id;
  const milestones = stage.milestones || [];
  const done = stage.milestone_counts?.completed || 0;
  const total = stage.milestone_counts?.total || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isDone = stage.status === "completed";
  const isActive = stage.status === "active";
  const isLocked = stage.status === "upcoming";
  // A journey that has CLOSED without its closing report: the gap is
  // shown in place and the button above writes exactly that report.
  const closingMissing =
    isDone && !(reportsByStage[String(stage.id)] || []).some((report) => report.report_kind === "closing");
  return (
    <div className="relative pl-10">
      {/* Timeline connector between stage nodes */}
      {index < visibleStagesCount - 1 && (
        <span aria-hidden className={`absolute left-[15px] top-9 -bottom-5 w-px ${isDone ? "bg-emerald-500/40" : "bg-[var(--border-primary)]"}`} />
      )}
      {/* Stage node */}
      <span
        className={`absolute left-0 top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black ${stageNodeClass(stage.status)} ${isActive ? "ring-4 ring-blue-500/10" : ""}`}
      >
        {isDone ? <CheckCircle2 className="w-4 h-4" /> : (stage.stage_order || index + 1)}
      </span>

      <div className={`card overflow-hidden ${isLocked ? "opacity-80" : ""}`}>
        {isEditing ? (
          <form onSubmit={saveEdit} className="p-4 space-y-3">
            <input
              value={editForm.name || ""}
              onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
              placeholder={t("venture.manager.stageNamePlaceholder")}
              className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-sm text-[var(--text-primary)]"
              required
            />
            <textarea
              value={editForm.description || ""}
              onChange={(event) => setEditForm({ ...editForm, description: event.target.value })}
              rows={2}
              placeholder={t("venture.manager.stageDescPlaceholder")}
              className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
            />
            <input
              value={editForm.objective || ""}
              onChange={(event) => setEditForm({ ...editForm, objective: event.target.value })}
              placeholder={t("venture.manager.stageObjectivePlaceholder")}
              className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
            />
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-[var(--text-secondary)]">{t("venture.manager.stageStartDate")}</label>
              <input
                type="date"
                value={editForm.start_date || ""}
                onChange={(event) => setEditForm({ ...editForm, start_date: event.target.value })}
                className="w-full px-3 py-2 rounded-lg outline-none border bg-[var(--surface-1)] text-xs text-[var(--text-primary)]"
              />
              <p className="text-[10px] text-[var(--text-secondary)]">{t("venture.manager.stageStartDateHint")}</p>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setEditId(null); setEditForm({}); }} className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-[var(--border-primary)] text-slate-500 hover:bg-tertiary">
                {t("common.cancel")}
              </button>
              <button type="submit" className="text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg bg-[var(--brand-orange)] text-black flex items-center gap-1">
                <Save className="w-3 h-3" /> {t("common.save")}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="p-4 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 min-w-0">
                  {access.manage && !stage.is_archived && (
                    <button
                      onClick={() => toggleSelectStage(stage.id)}
                      className={`mt-0.5 shrink-0 transition-colors ${selectedStageIds.has(String(stage.id)) ? "text-[var(--brand-orange)]" : "text-slate-500 hover:text-[var(--text-primary)]"}`}
                      title={t("venture.manager.selectJourney")}
                    >
                      {selectedStageIds.has(String(stage.id)) ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  )}
                  <h4 className={`text-sm font-black text-[var(--text-primary)] ${isDone ? "line-through text-slate-400" : ""}`}>{stage.name}</h4>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {statusPill(stage)}
                  {!isEditing && !stage.is_archived && (access.edit || access.manage) && (
                    <AppMenu
                      label={t("venture.manager.journeyActions")}
                      align="right"
                      buttonClassName="!p-1"
                      items={journeyMenuItems(stage, index)}
                    />
                  )}
                  {!isEditing && stage.is_archived && access.manage && (
                    <button onClick={() => restoreOneJourney(stage)} disabled={bulkBusy} className="p-1 text-slate-400 hover:text-emerald-400 disabled:opacity-40" title={t("venture.manager.restoreJourney")}>
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {stage.description && <p className="text-xs text-[var(--text-secondary)] mt-1.5">{stage.description}</p>}
              {stage.objective && (
                <p className="text-[10px] text-[var(--text-secondary)] italic mt-1">
                  <span className="font-bold not-italic uppercase tracking-widest text-slate-500">{t("venture.manager.objective")}: </span>{stage.objective}
                </p>
              )}
              {(stage.completed_at || !isDone) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-slate-400">
                  {stage.completed_at && <span>{t("venture.manager.completedOn", { date: new Date(stage.completed_at).toLocaleDateString(lang) })}</span>}
                  {!isDone && (
                    <span className={isActive ? "text-sky-300/90" : "text-slate-500"}>
                      {t(isLocked ? "venture.manager.memberVisibilityLocked" : "venture.manager.memberVisibilityActive")}
                    </span>
                  )}
                  {isActive && (
                    <span className="text-[10px] text-slate-500 italic">{t("venture.manager.journeyAutoCompletes")}</span>
                  )}
                </div>
              )}
              {total > 0 && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                    <span>{t("venture.manager.milestoneProgress", { done, total })}</span>
                    <span className={isDone ? "text-emerald-400" : "text-[var(--brand-orange)]"}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-tertiary overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isDone ? "bg-emerald-400" : "bg-gradient-to-r from-[var(--brand-orange)] to-orange-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* The report this journey is owed. A report BELONGS to a
                journey, so it is written here — where the journey lives —
                and never in a separate module. */}
            {!stage.is_archived && (
              <JourneyReportSection
                autoGrow={autoGrow}
                closingMissing={closingMissing}
                openReportComposer={openReportComposer}
                reportFor={reportFor}
                reportForm={reportForm}
                reportOpenId={reportOpenId}
                reportSaving={reportSaving}
                reportStatusLabel={reportStatusLabel}
                reportsByStage={reportsByStage}
                saveReport={saveReport}
                setReportFor={setReportFor}
                setReportForm={setReportForm}
                setReportOpenId={setReportOpenId}
                stage={stage}
              />
            )}

            {(milestones.length > 0 || (milestoneAuthority && !stage.is_archived)) && (
              <div className="px-4 pb-4 space-y-2">
                {milestones.length > 0 && (
                  <div className="rounded-xl border border-[var(--border-primary)] divide-y divide-divider/60 overflow-hidden">
                    {milestones.map((milestone, milestoneIndex) => (
                      <JourneyMilestoneRow
                        key={milestone.id}
                        milestone={milestone}
                        milestoneIndex={milestoneIndex}
                        milestones={milestones}
                        stage={stage}
                        stages={stages}
                        access={access}
                        milestoneAuthority={milestoneAuthority}
                        milestoneEditId={milestoneEditId}
                        setMilestoneEditId={setMilestoneEditId}
                        milestoneEditForm={milestoneEditForm}
                        setMilestoneEditForm={setMilestoneEditForm}
                        saveMilestoneEdit={saveMilestoneEdit}
                        milestoneOpenId={milestoneOpenId}
                        toggleMilestoneOpen={toggleMilestoneOpen}
                        milestoneBusy={milestoneBusy}
                        milestoneMenuItems={milestoneMenuItems}
                        milestoneDotClass={milestoneDotClass}
                        milestoneStatusClass={milestoneStatusClass}
                        milestoneStatusKey={milestoneStatusKey}
                        fmtDate={fmtDate}
                        milestoneSubmissions={milestoneSubmissions}
                        submissionReview={submissionReview}
                        submissionComment={submissionComment}
                        submissionsBusy={submissionsBusy}
                        decideSubmission={decideSubmission}
                        setSubmissionReview={setSubmissionReview}
                        setSubmissionComment={setSubmissionComment}
                        DELIVERABLE_TYPES={DELIVERABLE_TYPES}
                        addDeliverable={addDeliverable}
                        deliverableAction={deliverableAction}
                        deliverableAddFor={deliverableAddFor}
                        deliverableBusy={deliverableBusy}
                        deliverableFile={deliverableFile}
                        deliverableForm={deliverableForm}
                        deliverableMenuItems={deliverableMenuItems}
                        deliverableNewUrl={deliverableNewUrl}
                        deliverableSaving={deliverableSaving}
                        deliverableStatus={deliverableStatus}
                        deliverableText={deliverableText}
                        emptyDeliverableForm={emptyDeliverableForm}
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
                        autoGrow={autoGrow}
                        bookFor={bookFor}
                        bookForm={bookForm}
                        bookSaving={bookSaving}
                        bookSession={bookSession}
                        coachOptions={coachOptions}
                        openBooking={openBooking}
                        setBookFor={setBookFor}
                        setBookForm={setBookForm}
                        ventureId={ventureId}
                        ventureSessions={ventureSessions}
                        sessionStatusKey={sessionStatusKey}
                        noteEditFor={noteEditFor}
                        noteDraft={noteDraft}
                        setNoteDraft={setNoteDraft}
                        noteSaving={noteSaving}
                        saveSessionNote={saveSessionNote}
                        setNoteEditFor={setNoteEditFor}
                        notesMilestoneId={notesMilestoneId}
                      />
                    ))}
                  </div>
                )}

                {milestoneAuthority && !stage.is_archived && (
                  <AddMilestoneForm
                    DELIVERABLE_TYPES={DELIVERABLE_TYPES}
                    addMilestone={addMilestone}
                    addMilestoneDeliverable={addMilestoneDeliverable}
                    emptyMilestoneForm={emptyMilestoneForm}
                    milestoneAddFor={milestoneAddFor}
                    milestoneDeliverables={milestoneDeliverables}
                    milestoneForm={milestoneForm}
                    milestoneSaving={milestoneSaving}
                    removeMilestoneDeliverable={removeMilestoneDeliverable}
                    setMilestoneAddFor={setMilestoneAddFor}
                    setMilestoneDeliverables={setMilestoneDeliverables}
                    setMilestoneForm={setMilestoneForm}
                    stage={stage}
                    stages={stages}
                    updateMilestoneDeliverable={updateMilestoneDeliverable}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
