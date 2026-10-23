"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";
import { CheckCircle2, ChevronDown, ChevronRight, RotateCcw, Save, Square, CheckSquare } from "lucide-react";
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
  canApproveDeliverable,
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
  // A journey folds down to its header (title, status, progress). Open by default;
  // purely a view choice, so it lives here and nothing else depends on it.
  const [collapsed, setCollapsed] = React.useState(false);
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
    <div className={`jy-stage ${isActive ? "is-active" : ""} ${isLocked ? "is-locked" : ""}`}>
      <div>
        {isEditing ? (
          <form onSubmit={saveEdit} className="space-y-3" style={{ padding: 20 }}>
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
              <button type="button" onClick={() => { setEditId(null); setEditForm({}); }} className="stf-btn sm">
                {t("common.cancel")}
              </button>
              <button type="submit" className="stf-btn sm pr">
                <Save className="w-3 h-3" /> {t("common.save")}
              </button>
            </div>
          </form>
        ) : (
          <>
            {/* The whole header folds and unfolds the journey, not only the arrow:
                a click on any part of the bar does it, except on the controls inside
                it (select box, menu, restore, the arrow itself), which keep their own. */}
            <div
              className="jy-sh"
              style={{ cursor: "pointer" }}
              onClick={(event) => {
                if (event.target.closest("button, a, input, select, textarea, label, [role='menu']")) return;
                setCollapsed((value) => !value);
              }}
            >
              <div className="jy-sh-row">
                <span className={`jy-num ${stageNodeClass(stage.status)}`}>
                  {isDone ? <CheckCircle2 size={17} /> : (stage.stage_order || index + 1)}
                </span>
                <div className="jy-sh-body">
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      type="button"
                      onClick={() => setCollapsed((value) => !value)}
                      aria-expanded={!collapsed}
                      aria-label={t(collapsed ? "common.expand" : "common.collapse")}
                      title={t(collapsed ? "common.expand" : "common.collapse")}
                      className="shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                    >
                      {collapsed ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
                    </button>
                    {access.manage && !stage.is_archived && (
                      <button
                        type="button"
                        onClick={() => toggleSelectStage(stage.id)}
                        className={`shrink-0 transition-colors ${selectedStageIds.has(String(stage.id)) ? "text-[var(--brand-orange)]" : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"}`}
                        title={t("venture.manager.selectJourney")}
                      >
                        {selectedStageIds.has(String(stage.id)) ? <CheckSquare size={16} /> : <Square size={16} />}
                      </button>
                    )}
                    <h4 className={`jy-sh-title ${isDone ? "is-done" : ""}`}>{stage.name}</h4>
                  </div>
                  {!collapsed && stage.description && <p className="jy-sh-meta">{stage.description}</p>}
                  {!collapsed && stage.objective && (
                    <p className="jy-obj">
                      <b>{t("venture.manager.objective")}: </b>{stage.objective}
                    </p>
                  )}
                  {!collapsed && (stage.completed_at || !isDone) && (
                    <div className="jy-hint">
                      {stage.completed_at && <span>{t("venture.manager.completedOn", { date: new Date(stage.completed_at).toLocaleDateString(lang) })}</span>}
                      {!isDone && <span>{t(isLocked ? "venture.manager.memberVisibilityLocked" : "venture.manager.memberVisibilityActive")}</span>}
                      {isActive && <span>{t("venture.manager.journeyAutoCompletes")}</span>}
                    </div>
                  )}
                </div>
                <div className="jy-sh-side">
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
                    <button type="button" onClick={() => restoreOneJourney(stage)} disabled={bulkBusy} className="stf-btn sm ok" title={t("venture.manager.restoreJourney")}>
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </div>
              {total > 0 && (
                <div className="jy-prog">
                  <div className="stf-bar-prog"><i style={{ width: `${pct}%` }} /></div>
                  <span><b>{pct}%</b> · {t("venture.manager.milestoneProgress", { done, total })}</span>
                </div>
              )}
            </div>

            {/* The report this journey is owed. A report BELONGS to a
                journey, so it is written here — where the journey lives —
                and never in a separate module. */}
            {!collapsed && !stage.is_archived && (
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

            {!collapsed && (milestones.length > 0 || (milestoneAuthority && !stage.is_archived)) && (
              <div>
                {milestones.length > 0 && (
                  <div className="jy-ms">
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
                        canApproveDeliverable={canApproveDeliverable}
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
                  <div className="jy-add">
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
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
