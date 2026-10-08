/**
 * The Emails, Share, Assignments, Settings and Templates tabs of an open run.
 *
 * Cut out of src/app/platform/runs/page.js as-is: the page keeps every state
 * value and every write, and hands this block what it reads through `ctx`.
 * The names it needs are listed in the signature — nothing else.
 */

"use client";

import AssignmentsTab from "@/components/platform/runs/AssignmentsTab";
import EmailsTab from "@/components/platform/runs/EmailsTab";
import SettingsTab from "@/components/platform/runs/SettingsTab";
import ShareTab from "@/components/platform/runs/ShareTab";
import TemplatesTab from "@/components/platform/runs/TemplatesTab";

export default function RunAdminTabs({ retryAbortRef, runRetryEmails, ctx }) {
  const {
    allEmailRows,
    assignGroupId,
    assignOtherId,
    assignOtherType,
    assignProgramId,
    assignTypes,
    assignUserId,
    assignments,
    contacts,
    creatingGroup,
    detailTab,
    editingSettings,
    emailDateFrom,
    emailDateTo,
    emailSearch,
    emailStatusFilter,
    emailStatusSets,
    emailSummary,
    emailTotalPages,
    emailTypeFilter,
    groups,
    handleAssign,
    handleAssignWithGroup,
    handleCreateGroupInline,
    handleSaveSettings,
    handleUnassign,
    inlineGroupName,
    isRunAutomationOverride,
    notify,
    openReportFile,
    pagedEmailRows,
    programs,
    removeReportFile,
    reportFile,
    reportFileBusy,
    reportFileText,
    reportFileTextOpen,
    resetAssignModal,
    resetRunAutomation,
    retryProcessing,
    retryProgress,
    retrySelected,
    retrySelectedSet,
    retrySummary,
    retryableVisible,
    runAutomationValue,
    runFormSettings,
    runPersonalizing,
    runSettings,
    runTemplates,
    runTplSaving,
    safeEmailPage,
    saving,
    selectedRun,
    setAssignGroupId,
    setAssignOtherId,
    setAssignOtherType,
    setAssignProgramId,
    setAssignUserId,
    setEditingSettings,
    setEmailDateFrom,
    setEmailDateTo,
    setEmailPage,
    setEmailSearch,
    setEmailStatusFilter,
    setEmailTypeFilter,
    setInlineGroupName,
    setRetrySelected,
    setRetrySummary,
    setRunAutomationFlag,
    setRunPersonalizing,
    setRunSettings,
    setRunTemplates,
    setRunTplSaving,
    setSelectedRun,
    setShowAssign,
    setShowInlineGroup,
    showAssign,
    showInlineGroup,
    toggleAssignType,
    toggleReportFileText,
    toggleRetrySelect,
    uploadReportFile,
    visibleEmailRows,
  } = ctx;

  return (
    <>
        {/* ─── EMAILS TAB ─── */}
        {detailTab === "emails" && (
          <EmailsTab
            allEmailRows={allEmailRows} visibleEmailRows={visibleEmailRows} pagedEmailRows={pagedEmailRows}
            retryableVisible={retryableVisible} retrySelectedSet={retrySelectedSet} emailStatusSets={emailStatusSets} emailSummary={emailSummary}
            emailTypeFilter={emailTypeFilter} setEmailTypeFilter={setEmailTypeFilter}
            emailStatusFilter={emailStatusFilter} setEmailStatusFilter={setEmailStatusFilter}
            emailSearch={emailSearch} setEmailSearch={setEmailSearch}
            emailDateFrom={emailDateFrom} setEmailDateFrom={setEmailDateFrom}
            emailDateTo={emailDateTo} setEmailDateTo={setEmailDateTo}
            setEmailPage={setEmailPage}
            retrySelected={retrySelected} setRetrySelected={setRetrySelected}
            retryProcessing={retryProcessing} runRetryEmails={runRetryEmails} toggleRetrySelect={toggleRetrySelect}
            safeEmailPage={safeEmailPage} emailTotalPages={emailTotalPages}
            retryProgress={retryProgress} retrySummary={retrySummary} setRetrySummary={setRetrySummary} retryAbortRef={retryAbortRef}
          />
        )}

        {/* ─── SHARE TAB ─── */}
        {detailTab === "share" && <ShareTab selectedRun={selectedRun} notify={notify} />}

        {/* ─── ASSIGNMENTS TAB ─── */}
        {detailTab === "assignments" && (
          <AssignmentsTab
            assignments={assignments} groups={groups} contacts={contacts} programs={programs}
            showAssign={showAssign} setShowAssign={setShowAssign} resetAssignModal={resetAssignModal}
            assignTypes={assignTypes} toggleAssignType={toggleAssignType}
            assignUserId={assignUserId} setAssignUserId={setAssignUserId}
            assignGroupId={assignGroupId} setAssignGroupId={setAssignGroupId}
            showInlineGroup={showInlineGroup} setShowInlineGroup={setShowInlineGroup}
            inlineGroupName={inlineGroupName} setInlineGroupName={setInlineGroupName}
            handleCreateGroupInline={handleCreateGroupInline} handleAssignWithGroup={handleAssignWithGroup} creatingGroup={creatingGroup}
            assignProgramId={assignProgramId} setAssignProgramId={setAssignProgramId}
            assignOtherType={assignOtherType} setAssignOtherType={setAssignOtherType}
            assignOtherId={assignOtherId} setAssignOtherId={setAssignOtherId}
            handleAssign={handleAssign} saving={saving} handleUnassign={handleUnassign}
          />
        )}

        {/* ─── SETTINGS TAB ─── */}
        {detailTab === "settings" && (
          <SettingsTab
            selectedRun={selectedRun} editingSettings={editingSettings} setEditingSettings={setEditingSettings}
            runSettings={runSettings} setRunSettings={setRunSettings} saving={saving} handleSaveSettings={handleSaveSettings}
            reportFile={reportFile} reportFileBusy={reportFileBusy} reportFileText={reportFileText} reportFileTextOpen={reportFileTextOpen}
            openReportFile={openReportFile} toggleReportFileText={toggleReportFileText} removeReportFile={removeReportFile} uploadReportFile={uploadReportFile}
            runFormSettings={runFormSettings} runAutomationValue={runAutomationValue} isRunAutomationOverride={isRunAutomationOverride}
            setRunAutomationFlag={setRunAutomationFlag} resetRunAutomation={resetRunAutomation}
          />
        )}

        {/* ─── TEMPLATES TAB (run-level email overrides) ─── */}
        {detailTab === "templates" && (
          <TemplatesTab
            selectedRun={selectedRun} setSelectedRun={setSelectedRun}
            runSettings={runSettings} setRunSettings={setRunSettings}
            runTemplates={runTemplates} setRunTemplates={setRunTemplates}
            runTplSaving={runTplSaving} setRunTplSaving={setRunTplSaving}
            runFormSettings={runFormSettings} runPersonalizing={runPersonalizing} setRunPersonalizing={setRunPersonalizing}
            notify={notify}
          />
        )}
    </>
  );
}
