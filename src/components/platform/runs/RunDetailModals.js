/**
 * The modals of an open run: review, manual add, message composer, export.
 *
 * Cut out of src/app/platform/runs/page.js as-is: the page keeps every state
 * value and every write, and hands this block what it reads through `ctx`.
 * The names it needs are listed in the signature — nothing else.
 */

"use client";

import ExportOptionsModal from "@/components/platform/runs/ExportOptionsModal";
import ManualAddModal from "@/components/platform/runs/ManualAddModal";
import MessageComposerModal from "@/components/platform/runs/MessageComposerModal";
import ReviewModal from "@/components/platform/runs/ReviewModal";

export default function RunDetailModals({ ctx }) {
  const {
    aiPersonalizing,
    canReview,
    closeReview,
    evaluation,
    exportFormat,
    exportParticipants,
    exportScope,
    handleReevaluate,
    handleReview,
    manualAddEmail,
    manualAddName,
    manualAdding,
    messageBody,
    messageResult,
    messageSending,
    messageSubject,
    personalizeMessage,
    renderMessageResult,
    reviewData,
    reviewIncludeResultPdf,
    reviewTimeline,
    reviewing,
    runFormFields,
    saving,
    selectedIds,
    sendManualMessages,
    setEvaluation,
    setExportFormat,
    setExportScope,
    setManualAddEmail,
    setManualAddName,
    setMessageBody,
    setMessageSubject,
    setReviewData,
    setReviewIncludeResultPdf,
    setShowExportOptions,
    setShowManualAdd,
    setShowMessageComposer,
    showExportOptions,
    showManualAdd,
    showMessageComposer,
    showReview,
    submitManualAdd,
    t,
    visibleSubmissions,
  } = ctx;

  return (
    <>
      {/* Review Modal */}
      {showReview && reviewing && (
        <ReviewModal
          reviewing={reviewing}
          evaluation={evaluation}
          setEvaluation={setEvaluation}
          runFormFields={runFormFields}
          reviewTimeline={reviewTimeline}
          reviewData={reviewData}
          setReviewData={setReviewData}
          reviewIncludeResultPdf={reviewIncludeResultPdf}
          setReviewIncludeResultPdf={setReviewIncludeResultPdf}
          canReview={canReview}
          saving={saving}
          closeReview={closeReview}
          handleReview={handleReview}
          handleReevaluate={handleReevaluate}
          t={t}
        />
      )}

      {/* ─── MANUAL ADD RESPONDENT MODAL ─── */}
      {showManualAdd && (
        <ManualAddModal
          onClose={() => setShowManualAdd(false)}
          name={manualAddName}
          setName={setManualAddName}
          email={manualAddEmail}
          setEmail={setManualAddEmail}
          adding={manualAdding}
          onSubmit={submitManualAdd}
          t={t}
        />
      )}

      {/* ─── MESSAGE COMPOSER MODAL ─── */}
      {showMessageComposer && (
        <MessageComposerModal
          messageResult={messageResult}
          renderMessageResult={renderMessageResult}
          messageSubject={messageSubject}
          setMessageSubject={setMessageSubject}
          messageBody={messageBody}
          setMessageBody={setMessageBody}
          aiPersonalizing={aiPersonalizing}
          onPersonalize={personalizeMessage}
          messageSending={messageSending}
          onSend={sendManualMessages}
          selectedCount={selectedIds.length}
          onClose={() => setShowMessageComposer(false)}
          t={t}
        />
      )}

      {/* ─── EXPORT OPTIONS MODAL ─── */}
      {showExportOptions && (
        <ExportOptionsModal
          exportFormat={exportFormat}
          setExportFormat={setExportFormat}
          exportScope={exportScope}
          setExportScope={setExportScope}
          selectedCount={selectedIds.length}
          filteredCount={visibleSubmissions.length}
          onExport={() => exportParticipants(exportFormat, exportScope)}
          onClose={() => setShowExportOptions(false)}
          t={t}
        />
      )}
    </>
  );
}
