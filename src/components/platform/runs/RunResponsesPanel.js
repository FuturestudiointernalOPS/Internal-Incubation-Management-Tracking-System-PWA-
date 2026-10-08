/**
 * The Overview tab: filters, the responses table, selection and the bulk menu.
 *
 * Cut out of src/app/platform/runs/page.js as-is: the page keeps every state
 * value and every write, and hands this block what it reads through `ctx`.
 * The names it needs are listed in the signature — nothing else.
 */

"use client";

import OverviewTab from "@/components/platform/runs/OverviewTab";

export default function RunResponsesPanel({ bulkAbortRef, filterRowRef, runBulkApprove, ctx }) {
  const {
    activationConfirmOpen,
    activationForceResend,
    activationProcessing,
    activationProgress,
    activeFieldFilters,
    activeTrackingFilters,
    allFilteredSelected,
    allSelectedEvaluated,
    approved,
    availableParams,
    bulkConfirmOpen,
    bulkIncludeResultPdf,
    bulkMenuOpen,
    bulkProcessing,
    bulkProgress,
    bulkSummary,
    clearRunFilters,
    clearScoreFilter,
    closeSendResultConfirm,
    detailTab,
    drafts,
    duplicateEmailSet,
    duplicateGroups,
    editRespondentEmail,
    eligibleResendActivationIds,
    eligibleSendActivationIds,
    eligibleSendResultIds,
    emailLog,
    evaluatedSubmissionIds,
    evaluations,
    fieldOptionsOf,
    filterPickerMode,
    filterPickerOpen,
    filteredSubmissions,
    handleDeleteSubmission,
    hasRunFilters,
    messageSummary,
    openActivationConfirm,
    openMessageComposer,
    openReview,
    openSendResultConfirm,
    overdue,
    pagedSubmissions,
    paymentsBySubmission,
    perPage,
    pickFilterParam,
    previewNonce,
    previewSubmission,
    regenerateReport,
    rejected,
    removeFieldFilter,
    reportFile,
    reportRegenerating,
    respSafePage,
    respSearch,
    respTotalPages,
    resultConfirmOpen,
    resultPreviewId,
    resultProcessing,
    resultProgress,
    reviews,
    revision,
    runFormFields,
    runSendActivationMessages,
    runSendResultEmails,
    runSettings,
    scoreChipActive,
    scoreChipLabel,
    scoreOp,
    scoreValue,
    scoreValue2,
    selectedIds,
    selectedSet,
    selectedSubmission,
    setActivationConfirmOpen,
    setBulkConfirmOpen,
    setBulkIncludeResultPdf,
    setBulkMenuOpen,
    setBulkSummary,
    setExportScope,
    setFieldFilters,
    setFilterPickerMode,
    setFilterPickerOpen,
    setMessageSummary,
    setPreviewSubmission,
    setRespPage,
    setRespSearch,
    setResultPreviewId,
    setScoreOp,
    setScoreValue,
    setScoreValue2,
    setSelectedSubmission,
    setShowDuplicates,
    setShowExportOptions,
    setSubFilter,
    setTrackingFilter,
    showDuplicates,
    subFilter,
    subLoading,
    submissions,
    submitted,
    subtotal,
    toggleSelect,
    toggleSelectAllFiltered,
    trackingFilterOptionLabel,
    trackingFilterOptions,
    visibleSubmissions,
  } = ctx;

  return (
    <>
        {/* ─── OVERVIEW TAB ─── */}
        {detailTab === "overview" && (
          <OverviewTab
            subtotal={subtotal} submitted={submitted} approved={approved} rejected={rejected} revision={revision} drafts={drafts} overdue={overdue}
            respSearch={respSearch} setRespSearch={setRespSearch}
            scoreChipActive={scoreChipActive} scoreChipLabel={scoreChipLabel} clearScoreFilter={clearScoreFilter}
            activeFieldFilters={activeFieldFilters} removeFieldFilter={removeFieldFilter}
            activeTrackingFilters={activeTrackingFilters} setTrackingFilter={setTrackingFilter}
            filterPickerMode={filterPickerMode} setFilterPickerMode={setFilterPickerMode} filterRowRef={filterRowRef}
            scoreOp={scoreOp} setScoreOp={setScoreOp} scoreValue={scoreValue} setScoreValue={setScoreValue} scoreValue2={scoreValue2} setScoreValue2={setScoreValue2}
            fieldOptionsOf={fieldOptionsOf} setFieldFilters={setFieldFilters}
            filterPickerOpen={filterPickerOpen} setFilterPickerOpen={setFilterPickerOpen}
            availableParams={availableParams} pickFilterParam={pickFilterParam}
            trackingFilterOptions={trackingFilterOptions} trackingFilterOptionLabel={trackingFilterOptionLabel}
            duplicateGroups={duplicateGroups} showDuplicates={showDuplicates} setShowDuplicates={setShowDuplicates}
            hasRunFilters={hasRunFilters} clearRunFilters={clearRunFilters}
            visibleSubmissions={visibleSubmissions} setShowExportOptions={setShowExportOptions} setExportScope={setExportScope}
            allFilteredSelected={allFilteredSelected} toggleSelectAllFiltered={toggleSelectAllFiltered}
            filteredSubmissions={filteredSubmissions}
            selectedIds={selectedIds} selectedSet={selectedSet} toggleSelect={toggleSelect}
            bulkMenuOpen={bulkMenuOpen} setBulkMenuOpen={setBulkMenuOpen} bulkProcessing={bulkProcessing}
            setBulkIncludeResultPdf={setBulkIncludeResultPdf} setBulkConfirmOpen={setBulkConfirmOpen}
            openActivationConfirm={openActivationConfirm} openSendResultConfirm={openSendResultConfirm} openMessageComposer={openMessageComposer}
            respSafePage={respSafePage} perPage={perPage}
            subLoading={subLoading}
            runFormFields={runFormFields}
            pagedSubmissions={pagedSubmissions}
            paymentsBySubmission={paymentsBySubmission} reviews={reviews} evaluations={evaluations} emailLog={emailLog}
            duplicateEmailSet={duplicateEmailSet}
            evaluatedSubmissionIds={evaluatedSubmissionIds}
            openReview={openReview} handleDeleteSubmission={handleDeleteSubmission}
            setSelectedSubmission={setSelectedSubmission} selectedSubmission={selectedSubmission}
            respTotalPages={respTotalPages} setRespPage={setRespPage}
            bulkConfirmOpen={bulkConfirmOpen} bulkIncludeResultPdf={bulkIncludeResultPdf} allSelectedEvaluated={allSelectedEvaluated} runBulkApprove={runBulkApprove}
            activationConfirmOpen={activationConfirmOpen} activationForceResend={activationForceResend}
            eligibleResendActivationIds={eligibleResendActivationIds} eligibleSendActivationIds={eligibleSendActivationIds}
            submissions={submissions}
            setActivationConfirmOpen={setActivationConfirmOpen} activationProcessing={activationProcessing} runSendActivationMessages={runSendActivationMessages}
            activationProgress={activationProgress}
            resultConfirmOpen={resultConfirmOpen} eligibleSendResultIds={eligibleSendResultIds}
            resultPreviewId={resultPreviewId} setResultPreviewId={setResultPreviewId}
            closeSendResultConfirm={closeSendResultConfirm} resultProcessing={resultProcessing} runSendResultEmails={runSendResultEmails}
            previewSubmission={previewSubmission} runSettings={runSettings} reportFile={reportFile} regenerateReport={regenerateReport} reportRegenerating={reportRegenerating}
            previewNonce={previewNonce} setPreviewSubmission={setPreviewSubmission}
            resultProgress={resultProgress}
            bulkAbortRef={bulkAbortRef} bulkProgress={bulkProgress}
            bulkSummary={bulkSummary} setBulkSummary={setBulkSummary}
            messageSummary={messageSummary} setMessageSummary={setMessageSummary}
            subFilter={subFilter} setSubFilter={setSubFilter}
            onEditRespondentEmail={editRespondentEmail}
          />
        )}
    </>
  );
}
