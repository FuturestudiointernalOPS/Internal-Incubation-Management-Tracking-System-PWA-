/**
 * Manual messages, manual respondent add, and a corrected respondent email.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 23 values this module reads into
 * messagingActions().
 */



export function messagingActions({
  manualAddEmail,
  manualAddName,
  manualAdding,
  messageBody,
  messageSending,
  messageSubject,
  notify,
  openRun,
  prompt,
  selectedIds,
  selectedRun,
  setAiPersonalizing,
  setBulkMenuOpen,
  setManualAddEmail,
  setManualAddName,
  setManualAdding,
  setMessageBody,
  setMessageResult,
  setMessageSending,
  setMessageSubject,
  setShowManualAdd,
  setShowMessageComposer,
  t,
}) {
  // ─── Manual message (Room Overview → selected participants) ───
  const openMessageComposer = () => {
    setMessageSubject("");
    setMessageBody("");
    setMessageResult(null);
    setBulkMenuOpen(false);
    setShowMessageComposer(true);
  };

  // ─── Manual add respondent (super admin injects a test person) ───
  const openManualAdd = () => {
    setManualAddName("");
    setManualAddEmail("");
    setBulkMenuOpen(false);
    setShowManualAdd(true);
  };

  const submitManualAdd = async () => {
    if (!selectedRun || manualAdding) return;
    if (!manualAddName.trim() && !manualAddEmail.trim()) {
      notify(t("platformMisc.runs.manualAddNameOrEmailRequired"));
      return;
    }
    setManualAdding(true);
    try {
      const response = await fetch("/api/platform/form-runs?action=manual_add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: selectedRun.id,
          name: manualAddName.trim(),
          email: manualAddEmail.trim(),
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("platformMisc.runs.manualAddSuccess"));
        setShowManualAdd(false);
        setManualAddName("");
        setManualAddEmail("");
        if (selectedRun) await openRun(selectedRun, { keepTab: true });
      } else {
        notify(data.error || t("platformMisc.runs.manualAddFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.manualAddFailed"));
    }
    setManualAdding(false);
  };

  // ─── Correct a respondent's email (a wrong address typed on the form / manual add) ───
  const editRespondentEmail = async (submission) => {
    const current = String(submission.email || "").trim();
    const next = await prompt({
      message: t("platformMisc.runs.editEmailPrompt"),
      inputLabel: t("platformMisc.runs.editEmailLabel"),
      defaultValue: current,
      inputType: "email",
      placeholder: t("platformMisc.runs.editEmailPlaceholder"),
      confirmLabel: t("platformMisc.runs.editEmailSave"),
      validate: (value) =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim()) ? null : t("errors.invalidEmail"),
    });
    if (next == null) return;
    const cleanEmail = String(next).trim();
    if (!cleanEmail || cleanEmail.toLowerCase() === current.toLowerCase()) return;
    try {
      const response = await fetch("/api/platform/form-runs?action=update_respondent_email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ run_id: selectedRun?.id, submission_id: submission.id, email: cleanEmail }),
      });
      const data = await response.json();
      if (data.success) {
        notify(
          data.contact_conflict
            ? t("platformMisc.runs.editEmailConflict")
            : t("platformMisc.runs.editEmailSuccess"),
        );
        if (selectedRun) await openRun(selectedRun, { keepTab: true });
      } else {
        notify(data.error || t("platformMisc.runs.editEmailFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.editEmailFailed"));
    }
  };

  const personalizeMessage = async () => {
    setAiPersonalizing(true);
    try {
      const response = await fetch("/api/platform/ai/personalize-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: "manual",
          existing_subject: messageSubject,
          existing_body: messageBody,
        }),
      });
      const data = await response.json();
      if (data.success) {
        if (data.subject) setMessageSubject(data.subject);
        if (data.body) setMessageBody(data.body);
        notify(t("platformMisc.runs.aiPersonalized"));
      } else {
        notify(data.error || t("platformMisc.runs.personalizeFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.personalizeFailed"));
    }
    setAiPersonalizing(false);
  };

  /**
   * Render a manual-message result TRUTHFULLY.
   *
   * `success` only means the request was processed — the API answers
   * `success: true` even when every single recipient failed, so reading it
   * reported a total failure as a green "Message sent" with no reason shown.
   * The outcome lives in `sent` / `failed`, and the reason only ever appears in
   * `results[].error` ("No usable recipient email", "Refused — placeholder
   * address is not a real recipient", a transport error, …).
   *
   * Colour classes stay full literals — never interpolated — so Tailwind's
   * scanner keeps them in the build.
   */
  const renderMessageResult = (result) => {
    if (!result) return null;
    const sent = result.sent || 0;
    const failed = result.failed || 0;
    const failures = (result.results || []).filter((resultRow) => resultRow.status !== "sent");
    const box =
      sent === 0
        ? "bg-rose-500/10 border-rose-500/20"
        : failed > 0
          ? "bg-amber-500/10 border-amber-500/20"
          : "bg-emerald-500/10 border-emerald-500/20";
    const text =
      sent === 0 ? "text-rose-400" : failed > 0 ? "text-amber-400" : "text-emerald-400";
    const title =
      sent === 0
        ? t("platformMisc.runs.messageNothingSentTitle")
        : failed > 0
          ? t("platformMisc.runs.messagePartialTitle")
          : t("platformMisc.runs.messageSentTitle");

    return (
      <div className="space-y-3">
        <div className={`p-4 rounded-xl border ${box}`}>
          <p className={`text-sm font-black ${text}`}>{title}</p>
          <p className="text-[10px] font-bold text-[var(--text-secondary)] mt-1">{t("platformMisc.runs.messageRecipientsCount", { count: result.recipients })}</p>
          <p className={`text-[10px] font-bold mt-1 ${sent > 0 ? "text-emerald-400" : "text-[var(--text-secondary)]"}`}>{t("platformMisc.runs.messageSentCount", { count: sent })}</p>
          {failed > 0 && <p className="text-[10px] font-bold text-rose-400 mt-1">{t("platformMisc.runs.messageFailedCount", { count: failed })}</p>}
        </div>
        {failures.length > 0 && (
          <div className="p-4 rounded-xl bg-secondary/40 border border-[var(--border-primary)] space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-secondary)]">{t("platformMisc.runs.messageFailureReasons")}</p>
            {failures.map((failure) => (
              <div key={failure.submission_id} className="text-[10px] leading-relaxed">
                <span className="font-bold text-[var(--text-primary)]">{failure.name || failure.to || `#${failure.submission_id}`}</span>
                <span className="block text-rose-400">{failure.error || t("platformMisc.runs.messageFailureUnknown")}</span>
              </div>
            ))}
          </div>
        )}
        <button onClick={() => { setShowMessageComposer(false); setMessageResult(null); }} className="w-full py-2.5 rounded-lg bg-[var(--brand-orange)] text-black text-sm font-bold uppercase tracking-wide">{t("platformMisc.runs.done")}</button>
      </div>
    );
  };

  const sendManualMessages = async (ccAddresses = "") => {
    if (!selectedRun || selectedIds.length === 0 || messageSending) return;
    if (!messageSubject.trim() || !messageBody.trim()) {
      notify(t("platformMisc.runs.messageSubjectBodyRequired"));
      return;
    }
    setMessageSending(true);
    setMessageResult(null);
    try {
      const response = await fetch("/api/platform/form-runs?action=send_manual_message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: selectedRun.id,
          submission_ids: selectedIds,
          subject: messageSubject,
          body: messageBody,
          cc: ccAddresses,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessageResult(data);
      } else if (data.error === "invalid_cc_addresses") {
        notify(t("platformMisc.runs.messageCcInvalid"));
      } else if (data.error === "too_many_cc_addresses") {
        notify(t("platformMisc.runs.messageCcTooMany"));
      } else {
        notify(data.error || t("platformMisc.runs.messageSendFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.messageSendFailed"));
    }
    setMessageSending(false);
  };

  return {
    openMessageComposer,
    openManualAdd,
    submitManualAdd,
    editRespondentEmail,
    personalizeMessage,
    renderMessageResult,
    sendManualMessages,
  };
}
