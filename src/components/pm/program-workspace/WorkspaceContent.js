/**
 * The workspace body: the header, the tab bar, and whichever tab is active.
 *
 * Rendering only — every value comes from the page and every action is one of
 * its handlers. Nothing here owns state or reads data.
 */
import OverviewTab from "@/components/pm/program-workspace/OverviewTab";
import ParticipantsTab from "@/components/pm/program-workspace/ParticipantsTab";
import CurriculumTab from "@/components/pm/program-workspace/CurriculumTab";
import AttendanceTab from "@/components/pm/program-workspace/AttendanceTab";
import ConfigTab from "@/components/pm/program-workspace/ConfigTab";
import ReviewsTab from "@/components/pm/program-workspace/ReviewsTab";
import ReportsTab from "@/components/pm/program-workspace/ReportsTab";
import SubmissionsTab from "@/components/pm/program-workspace/SubmissionsTab";
import { FacilitatorsPanel } from "@/components/pm/FacilitatorsPanel";

export default function WorkspaceContent(ctx) {
  const {
    activeTab,
    assignedStaff,
    families,
    handleCopyRegFormLink,
    participants,
    program,
    regForm,
    reports,
    requirements,
    sessions,
    submissions,
    teams,
    activeSubTab,
    canEdit,
    setActiveSubTab,
    handleChangeParticipantTeam,
    deleteTeam,
    handleDeployTeam,
    setShowStaffModal,
    handleOpenTeamDetails,
    removeStaff,
    setSelectedParticipants,
    handleToggleParticipant,
    selectedParticipants,
    canContribute,
    expandedSessionId,
    id,
    kpis,
    handleAddSession,
    handleDeleteSession,
    handleEditSessionDescription,
    setExpandedSessionId,
    handleOpenRequirementForSession,
    handleOpenSessionAttendance,
    handleOpenSessionPMReport,
    handleSendRequirementReminder,
    setShowArchivedSessions,
    handleToggleSessionExpanded,
    handleToggleSessionHandler,
    handleToggleSessionLock,
    updateSessionField,
    updateSessionStatus,
    programTeamMembers,
    showArchivedSessions,
    handleOpenAttendanceModal,
    configDescRef,
    configEndRef,
    configGradingRef,
    configNameRef,
    configStartRef,
    configStatusRef,
    configWeeksRef,
    isSaving,
    setActivePDF,
    handleOpenPdfViewer,
    handleRecalculateKpis,
    saveConfig,
    user,
    facilitatorReviews,
    refreshReviews,
    handleReviewDecision,
    reviewAttentionLabel,
    reviewEngagementLabel,
    reviewRatingLabel,
    reviewsLoading,
    handleExportPmReport,
    handleOpenReviewModal,
    handleViewSubmission,
    submissionsSeen,
  } = ctx;
  return (
        <div className="pt-4">
          {activeTab === "overview" && (
            <OverviewTab
              assignedStaff={assignedStaff}
              families={families}
              onCopyRegFormLink={handleCopyRegFormLink}
              participants={participants}
              program={program}
              regForm={regForm}
              reports={reports}
              requirements={requirements}
              sessions={sessions}
              submissions={submissions}
              teams={teams}
            />
          )}

          {activeTab === "participants" && (
            <ParticipantsTab
              activeSubTab={activeSubTab}
              assignedStaff={assignedStaff}
              canEdit={canEdit}
              onActiveSubTab={setActiveSubTab}
              onActiveSubTabGroups={setActiveSubTab}
              onActiveSubTabStaff={setActiveSubTab}
              onChangeParticipantTeam={handleChangeParticipantTeam}
              onDeleteTeam={deleteTeam}
              onDeployTeam={handleDeployTeam}
              onOpenStaffModal={() => setShowStaffModal(true)}
              onOpenTeamDetails={handleOpenTeamDetails}
              onRemoveStaff={removeStaff}
              onSelectedParticipants={setSelectedParticipants}
              onSelectedParticipants2={setSelectedParticipants}
              onToggleParticipant={handleToggleParticipant}
              participants={participants}
              selectedParticipants={selectedParticipants}
              teams={teams}
            />
          )}

          {activeTab === "curriculum" && (
            <CurriculumTab
              assignedStaff={assignedStaff}
              canContribute={canContribute}
              canEdit={canEdit}
              expandedSessionId={expandedSessionId}
              id={id}
              kpis={kpis}
              onAddSession={handleAddSession}
              onDeleteSession={handleDeleteSession}
              onEditSessionDescription={handleEditSessionDescription}
              onExpandedSessionId={setExpandedSessionId}
              onOpenRequirementForSession={handleOpenRequirementForSession}
              onOpenSessionAttendance={handleOpenSessionAttendance}
              onOpenSessionPMReport={handleOpenSessionPMReport}
              onSendRequirementReminder={handleSendRequirementReminder}
              onShowArchivedSessions={setShowArchivedSessions}
              onToggleSessionExpanded={handleToggleSessionExpanded}
              onToggleSessionHandler={handleToggleSessionHandler}
              onToggleSessionLock={handleToggleSessionLock}
              onUpdateSessionFieldBlur={updateSessionField}
              onUpdateSessionFieldChange={updateSessionField}
              onUpdateSessionFieldEndDateChange={updateSessionField}
              onUpdateSessionFieldEndTimeChange={updateSessionField}
              onUpdateSessionFieldScheduledDateChange={updateSessionField}
              onUpdateSessionFieldStartTimeChange={updateSessionField}
              onUpdateSessionFieldTimezoneChange={updateSessionField}
              onUpdateSessionFieldWeekNumberChange={updateSessionField}
              onUpdateSessionStatusChange={updateSessionStatus}
              programTeamMembers={programTeamMembers}
              requirements={requirements}
              sessions={sessions}
              showArchivedSessions={showArchivedSessions}
            />
          )}

          {activeTab === "attendance" && (
            <AttendanceTab
              onOpenAttendanceModal={handleOpenAttendanceModal}
              sessions={sessions}
            />
          )}

          {activeTab === "config" && (
            <ConfigTab
              configDescRef={configDescRef}
              configEndRef={configEndRef}
              configGradingRef={configGradingRef}
              configNameRef={configNameRef}
              configStartRef={configStartRef}
              configStatusRef={configStatusRef}
              configWeeksRef={configWeeksRef}
              isSaving={isSaving}
              kpis={kpis}
              onActivePDF={setActivePDF}
              onOpenPdfViewer={handleOpenPdfViewer}
              onRecalculateKpis={handleRecalculateKpis}
              onSaveConfig={saveConfig}
              program={program}
              user={user}
            />
          )}

          {activeTab === "reviews" && (
            <ReviewsTab
              facilitatorReviews={facilitatorReviews}
              onRefreshReviews={refreshReviews}
              onReviewDecision={handleReviewDecision}
              onReviewDecisionChangesRequested={handleReviewDecision}
              reviewAttentionLabel={reviewAttentionLabel}
              reviewEngagementLabel={reviewEngagementLabel}
              reviewRatingLabel={reviewRatingLabel}
              reviewsLoading={reviewsLoading}
            />
          )}
          {activeTab === "reports" && (
            <ReportsTab
              onExportPmReport={handleExportPmReport}
              reports={reports}
              user={user}
            />
          )}

          {activeTab === "submissions" && (
            <SubmissionsTab
              onOpenReviewModal={handleOpenReviewModal}
              onViewSubmission={handleViewSubmission}
              submissions={submissions}
              submissionsSeen={submissionsSeen}
            />
          )}

          {activeTab === "facilitators" && <FacilitatorsPanel programId={id} />}
        </div>
  );
}
