"use client";

import { useState, useRef, useCallback } from "react";
import { useI18n } from "@/lib/i18n";

const BULK_BATCH = 10;

/**
 * The run screen's bulk operations and the state they own: bulk approve /
 * retry emails, the activation and result batches, and the preview slots they
 * open. The two batch runners are the only writers; they refresh the open run
 * through `openRunRef` (a ref, because the page's `openRun` is defined after
 * this hook yet these handlers must read the latest one at call time).
 */
export default function useRunBulkActions({ selectedRun, selectedIds, setSelectedIds, openRunRef, notify }) {
  const { t } = useI18n();
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false); // bulk Actions dropdown
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false); // confirm dialog
  const [bulkProcessing, setBulkProcessing] = useState(false); // bulk op running
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkSummary, setBulkSummary] = useState(null); // { approved, already_approved, failed[] }
  const [bulkIncludeResultPdf, setBulkIncludeResultPdf] = useState(false); // opt-in: also email the AI result PDF
  const bulkAbortRef = useRef(false); // stops issuing new bulk batches when true
  const [retrySelected, setRetrySelected] = useState([]); // "submissionId:emailType" keys
  const [retryProcessing, setRetryProcessing] = useState(false);
  const [retryProgress, setRetryProgress] = useState({ done: 0, total: 0 });
  const [retrySummary, setRetrySummary] = useState(null); // { sent, already_sent, failed[] }
  const retryAbortRef = useRef(false); // stops issuing new retry batches when true
  const [activationConfirmOpen, setActivationConfirmOpen] = useState(false);
  const [activationForceResend, setActivationForceResend] = useState(false);
  const [activationProcessing, setActivationProcessing] = useState(false);
  const [activationProgress, setActivationProgress] = useState({ done: 0, total: 0 });
  // Bulk Send Result (response PDF email) — Actions menu
  const [resultConfirmOpen, setResultConfirmOpen] = useState(false);
  const [resultProcessing, setResultProcessing] = useState(false);
  const [resultProgress, setResultProgress] = useState({ done: 0, total: 0 });
  // Read-only preview of the document about to be sent (one recipient at a time)
  const [resultPreviewId, setResultPreviewId] = useState(null);
  // Standalone document preview opened from a single response row
  const [previewSubmission, setPreviewSubmission] = useState(null);
  // Bumped to force the open preview to reload after a regeneration
  const [previewNonce, setPreviewNonce] = useState(0);
  const [reportRegenerating, setReportRegenerating] = useState(null); // submission id while composing

  const resetBulk = useCallback(() => {
    setBulkSummary(null);
    setBulkMenuOpen(false);
    setBulkConfirmOpen(false);
    setResultConfirmOpen(false);
    setResultPreviewId(null);
    setPreviewSubmission(null);
    setRetrySelected([]);
    setRetrySummary(null);
  }, []);

  // Bulk approve: batches of 10 through the SAME review workflow as a single
  // approval (server-side action=bulk_review → processReviewInternal).
  const runBulkApprove = async () => {
    if (!selectedRun || selectedIds.length === 0 || bulkProcessing) return;
    setBulkProcessing(true);
    setBulkConfirmOpen(false);
    setBulkIncludeResultPdf(false);
    bulkAbortRef.current = false;
    const ids = [...selectedIds];
    const includeResultPdf = bulkIncludeResultPdf;
    const summary = { approved: 0, already_approved: 0, failed: [], cancelled: 0 };
    let pdfFailed = 0;
    setBulkProgress({ done: 0, total: ids.length });
    let aborted = false;
    let processed = 0;
    for (let batchStart = 0; batchStart < ids.length && !aborted && !bulkAbortRef.current; batchStart += BULK_BATCH) {
      const chunk = ids.slice(batchStart, batchStart + BULK_BATCH);
      let data;
      try {
        const response = await fetch("/api/platform/form-runs?action=bulk_review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            run_id: selectedRun.id,
            submission_ids: chunk,
            decision: "approved",
            ...(includeResultPdf ? { include_result_pdf: true } : {}),
          }),
        });
        data = await response.json();
      } catch (_) {
        aborted = true;
        summary.failed.push({ name: t("platformMisc.runs.batchLabel", { count: Math.floor(batchStart / BULK_BATCH) + 1 }), error: t("platformMisc.runs.bulkNetworkError") });
        break;
      }
      if (!data.success) {
        aborted = true;
        summary.failed.push({ name: t("platformMisc.runs.batchFallback"), error: data.error || t("platformMisc.runs.bulkFailedError") });
        break;
      }
      for (const result of data.results || []) {
        if (result.status === "approved") summary.approved++;
        else if (result.status === "already_approved") summary.already_approved++;
        else summary.failed.push({ name: result.name || `#${result.submission_id}`, error: result.error || t("platformMisc.runs.failedFallback") });
        if (result.result_pdf === "failed") pdfFailed++;
      }
      processed = Math.min(batchStart + BULK_BATCH, ids.length);
      setBulkProgress({ done: processed, total: ids.length });
    }
    // Anything not yet processed when the user cancels (or a batch fails) is
    // reported as cancelled — nothing was sent for those rows, and they stay
    // in their previous state so they can be selected again later.
    summary.cancelled = ids.length - processed;
    // Record the unprocessed remainder as CANCELLED so history keeps
    // sent / failed / cancelled distinct and those rows stay retryable later.
    const unprocessedIds = ids.slice(processed);
    if (unprocessedIds.length > 0 && selectedRun) {
      try {
        await fetch("/api/platform/form-runs?action=mark_email_cancelled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            run_id: selectedRun.id,
            items: unprocessedIds.map((submissionId) => ({ submission_id: submissionId, email_type: "approval" })),
          }),
        });
      } catch (_) {}
    }
    setBulkProcessing(false);
    setSelectedIds([]);
    if (selectedRun) await openRunRef.current?.(selectedRun);
    setBulkSummary(summary);
    if (pdfFailed > 0) notify(t("platformMisc.runs.bulkResultPdfSendFailed", { count: pdfFailed }));
  };

  const runRetryEmails = async () => {
    if (!selectedRun || retrySelected.length === 0 || retryProcessing) return;
    setRetryProcessing(true);
    retryAbortRef.current = false;
    const items = retrySelected.map((retryKey) => {
      const [submissionId, type] = retryKey.split(":");
      return { submission_id: parseInt(submissionId), email_type: type };
    });
    const summary = { sent: 0, already_sent: 0, failed: [], cancelled: 0 };
    setRetryProgress({ done: 0, total: items.length });
    let aborted = false;
    let processed = 0;
    for (let chunkStart = 0; chunkStart < items.length && !aborted && !retryAbortRef.current; chunkStart += 10) {
      const chunk = items.slice(chunkStart, chunkStart + 10);
      let data;
      try {
        const response = await fetch("/api/platform/form-runs?action=retry_emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: selectedRun.id, retries: chunk }),
        });
        data = await response.json();
      } catch (_) {
        aborted = true;
        summary.failed.push({ name: t("platformMisc.runs.batchLabel", { count: Math.floor(chunkStart / 10) + 1 }), error: t("platformMisc.runs.retryNetworkError") });
        break;
      }
      if (!data.success) {
        aborted = true;
        summary.failed.push({ name: t("platformMisc.runs.batchFallback"), error: data.error || t("platformMisc.runs.retryFailedError") });
        break;
      }
      for (const result of data.results || []) {
        if (result.status === "sent") summary.sent++;
        else if (result.status === "already_sent") summary.already_sent++;
        else summary.failed.push({ name: result.name || `#${result.submission_id} (${result.email_type})`, error: result.error || t("platformMisc.runs.failedFallback") });
      }
      processed = Math.min(chunkStart + 10, items.length);
      setRetryProgress({ done: processed, total: items.length });
    }
    summary.retried = items.length;
    summary.cancelled = items.length - processed;
    // Record the unprocessed remainder as CANCELLED so history keeps
    // sent / failed / bounced / cancelled distinct and those rows stay
    // retryable later.
    const unprocessed = items.slice(processed);
    if (unprocessed.length > 0 && selectedRun) {
      try {
        await fetch("/api/platform/form-runs?action=mark_email_cancelled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: selectedRun.id, items: unprocessed }),
        });
      } catch (_) {}
    }
    setRetryProcessing(false);
    setRetrySelected([]);
    // Refresh with keepTab so we STAY on the Emails tab — the summary modal
    // lives there, and the Failed list must update in place: successful
    // retries disappear from it, failures keep their latest reason.
    if (selectedRun) await openRunRef.current?.(selectedRun, { keepTab: true });
    setRetrySummary(summary);
    notify(
      summary.failed.length > 0
        ? t("platformMisc.runs.emailRetryPartial", { sent: summary.sent, failed: summary.failed.length })
        : t("platformMisc.runs.emailRetrySuccess", { sent: summary.sent })
    );
  };

  return {
    bulkMenuOpen, setBulkMenuOpen,
    bulkConfirmOpen, setBulkConfirmOpen,
    bulkProcessing, setBulkProcessing,
    bulkProgress, setBulkProgress,
    bulkSummary, setBulkSummary,
    bulkIncludeResultPdf, setBulkIncludeResultPdf,
    bulkAbortRef,
    retrySelected, setRetrySelected,
    retryProcessing, setRetryProcessing,
    retryProgress, setRetryProgress,
    retrySummary, setRetrySummary,
    retryAbortRef,
    activationConfirmOpen, setActivationConfirmOpen,
    activationForceResend, setActivationForceResend,
    activationProcessing, setActivationProcessing,
    activationProgress, setActivationProgress,
    resultConfirmOpen, setResultConfirmOpen,
    resultProcessing, setResultProcessing,
    resultProgress, setResultProgress,
    resultPreviewId, setResultPreviewId,
    previewSubmission, setPreviewSubmission,
    previewNonce, setPreviewNonce,
    reportRegenerating, setReportRegenerating,
    resetBulk,
    runBulkApprove,
    runRetryEmails,
  };
}
