/**
 * Activation, result and retry email campaigns for the selected submissions.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 21 values this module reads into
 * runEmailActions().
 */



export function runEmailActions({
  activationForceResend,
  activationProcessing,
  eligibleResendActivationIds,
  eligibleSendActivationIds,
  eligibleSendResultIds,
  notify,
  openRun,
  resultProcessing,
  selectedRun,
  setActivationConfirmOpen,
  setActivationForceResend,
  setActivationProcessing,
  setActivationProgress,
  setBulkMenuOpen,
  setMessageSummary,
  setResultConfirmOpen,
  setResultPreviewId,
  setResultProcessing,
  setResultProgress,
  setSelectedIds,
  t,
}) {
  const openActivationConfirm = (forceResend = false) => {
    setBulkMenuOpen(false);
    const ids = forceResend ? eligibleResendActivationIds : eligibleSendActivationIds;
    if (ids.length === 0) {
      // State-aware messaging: the empty list means different things for
      // Send vs Resend, and the message must never claim an email was
      // "already sent" when it was not (or vice versa).
      if (!forceResend && eligibleResendActivationIds.length > 0) {
        notify(t("platformMisc.runs.noEligibleSendAlreadySent"));
      } else if (forceResend && eligibleSendActivationIds.length > 0) {
        notify(t("platformMisc.runs.noEligibleResendNotSentYet"));
      } else {
        notify(t(forceResend ? "platformMisc.runs.noEligibleResendNone" : "platformMisc.runs.noEligibleSendNone"));
      }
      return;
    }
    setActivationForceResend(forceResend);
    setActivationConfirmOpen(true);
  };

  const runSendActivationMessages = async () => {
    const targetIds = activationForceResend ? eligibleResendActivationIds : eligibleSendActivationIds;
    if (!selectedRun || targetIds.length === 0 || activationProcessing) return;
    setActivationConfirmOpen(false);
    setActivationProcessing(true);
    const forceResend = activationForceResend;
    const CHUNK = 30;
    const ids = [...targetIds];
    const summary = { sent: 0, already_sent: 0, skipped: 0, failed: 0, total: ids.length };
    setActivationProgress({ done: 0, total: ids.length });
    try {
      for (let chunkStart = 0; chunkStart < ids.length; chunkStart += CHUNK) {
        const chunk = ids.slice(chunkStart, chunkStart + CHUNK);
        const response = await fetch("/api/platform/form-runs?action=send_activation_messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: selectedRun.id, submission_ids: chunk, force: forceResend }),
        });
        const data = await response.json();
        if (!data.success) {
          notify(data.error || t("platformMisc.runs.messageSendFailed"));
          break;
        }
        for (const result of data.results || []) {
          if (result.status === "sent") summary.sent++;
          else if (result.status === "already_sent") summary.already_sent++;
          else if (result.status === "failed" || result.status === "not_found") summary.failed++;
          else summary.skipped++;
        }
        setActivationProgress({ done: Math.min(chunkStart + CHUNK, ids.length), total: ids.length });
      }
      setMessageSummary({
        title: t(forceResend ? "platformMisc.runs.sendActivationResendMessage" : "platformMisc.runs.sendActivationMessage"),
        sent: summary.sent,
        already_sent: summary.already_sent,
        skipped: summary.skipped,
        failed: summary.failed,
      });
      setSelectedIds([]);
      if (selectedRun) await openRun(selectedRun);
    } catch (_) {
      notify(t("platformMisc.runs.messageSendFailed"));
    } finally {
      setActivationProcessing(false);
      setActivationForceResend(false);
      setActivationProgress({ done: 0, total: 0 });
    }
  };

  const openSendResultConfirm = () => {
    setBulkMenuOpen(false);
    if (eligibleSendResultIds.length === 0) {
      notify(t("platformMisc.runs.noEligibleSendResult"));
      return;
    }
    // Open on the first recipient's document — it is the one most likely to be
    // reviewed, and any recipient can then be picked in the dialog.
    setResultPreviewId(eligibleSendResultIds[0]);
    setResultConfirmOpen(true);
  };

  const closeSendResultConfirm = () => {
    setResultConfirmOpen(false);
    setResultPreviewId(null);
  };

  const runSendResultEmails = async () => {
    if (!selectedRun || eligibleSendResultIds.length === 0 || resultProcessing) return;
    setResultConfirmOpen(false);
    setResultProcessing(true);
    const CHUNK = 30;
    const ids = [...eligibleSendResultIds];
    const summary = { sent: 0, already_sent: 0, skipped: 0, failed: 0, total: ids.length };
    setResultProgress({ done: 0, total: ids.length });
    try {
      setResultPreviewId(null);
      for (let chunkStart = 0; chunkStart < ids.length; chunkStart += CHUNK) {
        const chunk = ids.slice(chunkStart, chunkStart + CHUNK);
        const response = await fetch("/api/platform/form-runs?action=send_result_emails", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ run_id: selectedRun.id, submission_ids: chunk }),
        });
        const data = await response.json();
        if (!data.success) {
          notify(data.error || t("platformMisc.runs.sendResultFailed"));
          break;
        }
        for (const result of data.results || []) {
          if (result.status === "sent") summary.sent++;
          else if (result.status === "already_sent") summary.already_sent++;
          else if (result.status === "failed" || result.status === "not_found") summary.failed++;
          else summary.skipped++;
        }
        setResultProgress({ done: Math.min(chunkStart + CHUNK, ids.length), total: ids.length });
      }
      setMessageSummary({
        title: t("platformMisc.runs.sendResponseComplete"),
        sent: summary.sent,
        already_sent: summary.already_sent,
        skipped: summary.skipped,
        failed: summary.failed,
      });
      setSelectedIds([]);
      if (selectedRun) await openRun(selectedRun);
    } catch (_) {
      notify(t("platformMisc.runs.sendResultFailed"));
    } finally {
      setResultProcessing(false);
      setResultProgress({ done: 0, total: 0 });
    }
  };

  return {
    openActivationConfirm,
    runSendActivationMessages,
    openSendResultConfirm,
    closeSendResultConfirm,
    runSendResultEmails,
  };
}
