/**
 * The workspace overlays: the PDF viewer, the toast, every write modal, and the
 * shared confirmation dialog.
 *
 * Rendering only — each overlay is shown by the page's own state and every action
 * is one of its handlers. Nothing here owns state or reads data.
 */
import PdfViewerModal from "@/components/pm/program-workspace/PdfViewerModal";
import ProgramToast from "@/components/pm/program-workspace/ProgramToast";
import DeployTeamModal from "@/components/pm/program-workspace/DeployTeamModal";
import SessionModal from "@/components/pm/program-workspace/SessionModal";
import ReviewModal from "@/components/pm/program-workspace/ReviewModal";
import StaffAssignmentModal from "@/components/pm/program-workspace/StaffAssignmentModal";
import KpiModal from "@/components/pm/program-workspace/KpiModal";
import RequirementModal from "@/components/pm/program-workspace/RequirementModal";
import AttendanceModal from "@/components/pm/program-workspace/AttendanceModal";
import PmReportModal from "@/components/pm/program-workspace/PmReportModal";
import TeamDetailsModal from "@/components/pm/program-workspace/TeamDetailsModal";
import ConfirmActionDialog from "@/components/pm/program-workspace/ConfirmActionDialog";

export default function WorkspaceModals(ctx) {
  const {
    activePDF,
    setActivePDF,
    toast,
    showTeamModal,
    emailInput,
    isSaving,
    newTeam,
    addEmailsToSelection,
    handleChangeNewTeamStaff,
    setShowTeamModal,
    deployTeam,
    setEmailInput,
    setNewTeam,
    setSelectedExistingTeamId,
    setTeamAssignmentMode,
    oversightCandidates,
    participants,
    selectedExistingTeamId,
    selectedParticipants,
    teamAssignmentMode,
    teams,
    showSessionModal,
    kpis,
    newRequirement,
    newSession,
    newSessionMaterial,
    addSession,
    handleAddSessionRequirement,
    setNewRequirement,
    handleAttachSessionMaterial,
    closeSessionModal,
    setShowSessionModal,
    setNewSession,
    setNewSessionMaterial,
    handleSessionMaterialFile,
    toggleKpi,
    handleToggleSessionStaff,
    programTeamMembers,
    showReviewModal,
    followupDate,
    followupDuration,
    followupMeetingLink,
    followupNotes,
    followupTime,
    setShowReviewModal,
    setFollowupDate,
    setFollowupDuration,
    setFollowupMeetingLink,
    setFollowupNotes,
    setFollowupTime,
    setShowFollowupFields,
    handleRejectSubmission,
    handleRequestRevision,
    handleResetFollowupFields,
    setReviewFeedback,
    setReviewScore,
    handleReviewSubmission,
    handleScheduleFollowup,
    reviewFeedback,
    reviewScore,
    selectedSubmission,
    showFollowupFields,
    showStaffModal,
    newStaff,
    assignStaff,
    setShowStaffModal,
    setNewStaff,
    staffList,
    showKPIModal,
    newKPI,
    addKPI,
    setShowKPIModal,
    setNewKPI,
    showRequirementModal,
    addRequirement,
    setShowRequirementModal,
    showAttendanceModal,
    selectedSessionForAttendance,
    attendanceDate,
    attendanceRecords,
    setAttendanceDate,
    setAttendanceRecords,
    setShowAttendanceModal,
    handleSaveAttendance,
    showPMReportModal,
    newPMReport,
    setNewPMReport,
    setShowPMReportModal,
    setPmReportAttachments,
    handleReportAttachmentUpload,
    submitPMReport,
    pmReportAttachments,
    showTeamDetails,
    selectedTeam,
    canEdit,
    editingScoreFor,
    facilitatorDraftId,
    handleCancelFacilitatorSelect,
    handleCancelScoreEdit,
    changeTeamHandler,
    handleCloseTeamDetails,
    setConfirmTarget,
    handleEditParticipantScore,
    setFacilitatorDraftId,
    handleOpenFacilitatorSelect,
    handleParticipantScoreKeyDown,
    setScoreDraft,
    updateParticipantScores,
    removeParticipantFromTeam,
    scoreDraft,
    showFacilitatorSelect,
    submissions,
    confirmTarget,
    handleConfirmAction,
  } = ctx;
  return (
    <>
        {/* PDF VIEWER MODAL */}
        {activePDF && (
          <PdfViewerModal
            activePDF={activePDF}
            onClearActivePDF={() => setActivePDF(null)}
          />
        )}

        {/* TOAST */}
        {toast && <ProgramToast toast={toast} />}

        {/* DEPLOY STUDENT GROUP MODAL */}
        {showTeamModal && (
          <DeployTeamModal
            emailInput={emailInput}
            isSaving={isSaving}
            newTeam={newTeam}
            onAddEmailsToSelection={addEmailsToSelection}
            onChangeNewTeamStaff={handleChangeNewTeamStaff}
            onCloseTeamModal={() => setShowTeamModal(false)}
            onDeployTeam={deployTeam}
            onEmailInputChange={setEmailInput}
            onLeaderIdChange={setNewTeam}
            onNewTeamChange={setNewTeam}
            onSelectedExistingTeamIdChange={setSelectedExistingTeamId}
            onTeamAssignmentMode={setTeamAssignmentMode}
            onTeamAssignmentModeExisting={setTeamAssignmentMode}
            oversightCandidates={oversightCandidates}
            participants={participants}
            selectedExistingTeamId={selectedExistingTeamId}
            selectedParticipants={selectedParticipants}
            teamAssignmentMode={teamAssignmentMode}
            teams={teams}
          />
        )}

        {/* ADD SESSION MODAL */}
        {showSessionModal && (
          <SessionModal
            isSaving={isSaving}
            kpis={kpis}
            newRequirement={newRequirement}
            newSession={newSession}
            newSessionMaterial={newSessionMaterial}
            onAddSession={addSession}
            onAddSessionRequirement={handleAddSessionRequirement}
            onAssigneeTypeChange={setNewRequirement}
            onAttachSessionMaterial={handleAttachSessionMaterial}
            onCloseSessionModal={closeSessionModal}
            onCloseSessionModal2={() => setShowSessionModal(false)}
            onDescriptionChange={setNewRequirement}
            onDueDateChange={setNewRequirement}
            onEndDateChange={setNewSession}
            onEndTimeChange={setNewSession}
            onNewRequirementChange={setNewRequirement}
            onNewSession={setNewSession}
            onNewSessionChange={setNewSession}
            onNewSessionMaterial={setNewSessionMaterial}
            onNewSessionMaterialChange={setNewSessionMaterial}
            onNewSessionMaterialExternalLinkChange={setNewSessionMaterial}
            onNotesChange={setNewSession}
            onRequirements={setNewSession}
            onResourceLabelChange={setNewRequirement}
            onResourceUrlChange={setNewRequirement}
            onScheduledDateChange={setNewSession}
            onSessionMaterialFile={handleSessionMaterialFile}
            onStartTimeChange={setNewSession}
            onTitleChange={setNewRequirement}
            onToggleKpi={toggleKpi}
            onToggleSessionStaff={handleToggleSessionStaff}
            programTeamMembers={programTeamMembers}
          />
        )}

        {/* REVIEW & GRADE MODAL */}
        {showReviewModal && (
          <ReviewModal
            followupDate={followupDate}
            followupDuration={followupDuration}
            followupMeetingLink={followupMeetingLink}
            followupNotes={followupNotes}
            followupTime={followupTime}
            isSaving={isSaving}
            onCloseReviewModal={() => setShowReviewModal(false)}
            onFollowupDateChange={setFollowupDate}
            onFollowupDurationChange={setFollowupDuration}
            onFollowupMeetingLinkChange={setFollowupMeetingLink}
            onFollowupNotesChange={setFollowupNotes}
            onFollowupTimeChange={setFollowupTime}
            onOpenFollowupFields={() => setShowFollowupFields(true)}
            onRejectSubmission={handleRejectSubmission}
            onRequestRevision={handleRequestRevision}
            onResetFollowupFields={handleResetFollowupFields}
            onReviewFeedbackChange={setReviewFeedback}
            onReviewScoreChange={setReviewScore}
            onReviewSubmission={handleReviewSubmission}
            onScheduleFollowup={handleScheduleFollowup}
            reviewFeedback={reviewFeedback}
            reviewScore={reviewScore}
            selectedSubmission={selectedSubmission}
            showFollowupFields={showFollowupFields}
          />
        )}

        {/* ASSIGN STAFF MODAL */}
        {showStaffModal && (
          <StaffAssignmentModal
            isSaving={isSaving}
            newStaff={newStaff}
            onAssignStaff={assignStaff}
            onCloseStaffModal={() => setShowStaffModal(false)}
            onNewStaffChange={setNewStaff}
            onRoleChange={setNewStaff}
            staffList={staffList}
          />
        )}

        {/* DEFINE KPI MODAL */}
        {showKPIModal && (
          <KpiModal
            isSaving={isSaving}
            newKPI={newKPI}
            onAddKPI={addKPI}
            onCloseKPIModal={() => setShowKPIModal(false)}
            onNewKPIChange={setNewKPI}
          />
        )}

        {/* ANCHOR REQUIREMENT MODAL */}
        {showRequirementModal && (
          <RequirementModal
            isSaving={isSaving}
            kpis={kpis}
            newRequirement={newRequirement}
            onAllowedFormatChange={setNewRequirement}
            onAssigneeIdChange={setNewRequirement}
            onAssigneeTypeChange={setNewRequirement}
            onCloseAddRequirement={() => addRequirement(false)}
            onCloseRequirementModal={() => setShowRequirementModal(false)}
            onDescriptionChange={setNewRequirement}
            onDueDateChange={setNewRequirement}
            onNewRequirementChange={setNewRequirement}
            onOpenAddRequirement={() => addRequirement(true)}
            onResourceLabelChange={setNewRequirement}
            onResourceUrlChange={setNewRequirement}
            onToggleKpi={toggleKpi}
            participants={participants}
            teams={teams}
          />
        )}

        {/* ATTENDANCE MODAL */}
        {showAttendanceModal && selectedSessionForAttendance && (
          <AttendanceModal
            attendanceDate={attendanceDate}
            attendanceRecords={attendanceRecords}
            isSaving={isSaving}
            onAttendanceDateChange={setAttendanceDate}
            onAttendanceRecordsChange={setAttendanceRecords}
            onCloseAttendanceModal={() => setShowAttendanceModal(false)}
            onSaveAttendance={handleSaveAttendance}
            participants={participants}
            selectedSessionForAttendance={selectedSessionForAttendance}
          />
        )}

        {/* PM WEEKLY REPORT MODAL — Structured Reporting Flow */}
        {showPMReportModal && (
          <PmReportModal
            isSaving={isSaving}
            kpis={kpis}
            newPMReport={newPMReport}
            onAdditionalIssueNoteChange={setNewPMReport}
            onAssignmentGivenSet={setNewPMReport}
            onAssignmentGivenUnset={setNewPMReport}
            onAssignmentKpiIds={setNewPMReport}
            onAssignmentObjectiveChange={setNewPMReport}
            onAssignmentOutcomeChange={setNewPMReport}
            onAttendanceLevel={setNewPMReport}
            onClosePMReportModal={() => setShowPMReportModal(false)}
            onDeliveryChallengeNoteChange={setNewPMReport}
            onDeliveryChallenges={setNewPMReport}
            onDeliveryQuality={setNewPMReport}
            onHadIssues={setNewPMReport}
            onIssueTypes={setNewPMReport}
            onNewPMReport={setNewPMReport}
            onNewPMReportChange={setNewPMReport}
            onParticipantUnderstanding={setNewPMReport}
            onParticipantsAttentionNotesChange={setNewPMReport}
            onParticipantsNeedAttention={setNewPMReport}
            onParticipationLevel={setNewPMReport}
            onPlannedAdjustmentsChange={setNewPMReport}
            onPmReportAttachments={setPmReportAttachments}
            onPmReportAttachmentsChange={setPmReportAttachments}
            onPmReportAttachmentsFile={setPmReportAttachments}
            onProgramOnTrackSet={setNewPMReport}
            onProgramOnTrackUnset={setNewPMReport}
            onReportAttachmentUploadChange={handleReportAttachmentUpload}
            onRequiresAdminAttention={setNewPMReport}
            onResetPmReportAttachments={setPmReportAttachments}
            onStandoutNotesChange={setNewPMReport}
            onStandoutParticipants={setNewPMReport}
            onStatusChange={setNewPMReport}
            onSubmitPMReport={submitPMReport}
            onSummaryChange={setNewPMReport}
            onWeekRating={setNewPMReport}
            pmReportAttachments={pmReportAttachments}
          />
        )}
        {/* TEAM DETAILS MODAL */}
        {showTeamDetails && selectedTeam && (
          <TeamDetailsModal
            canEdit={canEdit}
            editingScoreFor={editingScoreFor}
            facilitatorDraftId={facilitatorDraftId}
            isSaving={isSaving}
            onActivePDF={setActivePDF}
            onCancelFacilitatorSelect={handleCancelFacilitatorSelect}
            onCancelScoreEdit={handleCancelScoreEdit}
            onChangeTeamHandler={changeTeamHandler}
            onCloseTeamDetails={handleCloseTeamDetails}
            onCloseTeamDetails2={handleCloseTeamDetails}
            onCloseTeamDetails3={handleCloseTeamDetails}
            onConfirmTarget={setConfirmTarget}
            onEditParticipantScore={handleEditParticipantScore}
            onFacilitatorDraftIdChange={setFacilitatorDraftId}
            onOpenFacilitatorSelect={handleOpenFacilitatorSelect}
            onParticipantScoreKeyDown={handleParticipantScoreKeyDown}
            onScoreDraftChange={setScoreDraft}
            onUpdateParticipantScores={updateParticipantScores}
            oversightCandidates={oversightCandidates}
            participants={participants}
            removeParticipantFromTeam={removeParticipantFromTeam}
            scoreDraft={scoreDraft}
            selectedTeam={selectedTeam}
            showFacilitatorSelect={showFacilitatorSelect}
            submissions={submissions}
          />
        )}

        {/* CONFIRMATION MODAL */}
        {confirmTarget && (
          <ConfirmActionDialog
            confirmTarget={confirmTarget}
            onClearConfirmTarget={() => setConfirmTarget(null)}
            onConfirmAction={handleConfirmAction}
          />
        )}
    </>
  );
}
