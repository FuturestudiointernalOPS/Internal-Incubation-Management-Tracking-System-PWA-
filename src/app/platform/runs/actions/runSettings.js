/**
 * Run settings, the AI report brief, and the reference document of a run.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 19 values this module reads into
 * runSettingsActions().
 */



export function runSettingsActions({
  confirm,
  notify,
  reportFileBusy,
  reportFileText,
  reportFileTextOpen,
  reportRegenerating,
  runSettings,
  selectedRun,
  setEditingSettings,
  setPreviewNonce,
  setReportFile,
  setReportFileBusy,
  setReportFileText,
  setReportFileTextOpen,
  setReportRegenerating,
  setRunSettings,
  setSaving,
  setSelectedRun,
  t,
}) {
  const handleSaveSettings = async () => {
    if (!selectedRun) return;
    setSaving(true);
    try {
      const response = await fetch("/api/platform/form-runs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedRun.id, settings: runSettings }),
      });
      const data = await response.json();
      if (data.success) {
        setSelectedRun(data.run);
        setRunSettings(data.run.settings || {});
        notify(t("platformMisc.runs.settingsSaved"));
        setEditingSettings(false);
      } else {
        // Server errors are i18n keys when they are ours; `t` passes anything
        // else through unchanged.
        notify(data.error ? t(data.error) : t("platformMisc.runs.settingsSaveFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.settingsSaveFailed"));
    }
    setSaving(false);
  };

  // Re-roll the AI-composed report for an unchanged instruction. Meaningful
  // only when this run carries an Output Instruction — otherwise the server
  // keeps answering with the default document and this is a no-op.
  const regenerateReport = async (submissionId) => {
    if (reportRegenerating) return;
    setReportRegenerating(submissionId);
    try {
      const response = await fetch("/api/platform/form-runs?action=regenerate_report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId }),
      });
      if (response.ok) {
        notify(t("platformMisc.runs.regenerateReportDone"));
        setPreviewNonce((previousNonce) => previousNonce + 1); // reload the preview with the new document
      } else {
        let message = "";
        try { const data = await response.json(); message = data?.error || ""; } catch (_) {}
        notify(message ? t(message) : t("platformMisc.runs.regenerateReportFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.regenerateReportFailed"));
    }
    setReportRegenerating(null);
  };

  // ─── Reference document — the file half of the report brief ───
  //
  // Attaching a document is its OWN immediate action rather than part of the
  // settings form: the file travels as an upload, it is read into text on the
  // server, and the row it writes is what the report writer then reads. Nothing
  // is deferred, so there is no half-saved state to reconcile with "Save".
  const uploadReportFile = async (file) => {
    if (!selectedRun || !file || reportFileBusy) return;
    setReportFileBusy(true);
    try {
      const body = new FormData();
      body.append("run_id", String(selectedRun.id));
      body.append("file", file);
      const response = await fetch("/api/platform/form-runs/report-file", { method: "POST", body });
      const data = await response.json();
      if (data.success) {
        setReportFile(data.file || null);
        setReportFileText(null);
        setReportFileTextOpen(false);
        // Any report already generated was written from the PREVIOUS document.
        setPreviewNonce((previousNonce) => previousNonce + 1);
        notify(t("platformMisc.runs.reportFileUploaded"));
      } else {
        notify(data.error ? t(data.error) : t("platformMisc.runs.reportFileUploadFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.reportFileUploadFailed"));
    }
    setReportFileBusy(false);
  };

  // The link is minted on click and expires: never held in state.
  const openReportFile = async () => {
    if (!selectedRun) return;
    // Opened SYNCHRONOUSLY and pointed at the signed link once it arrives: a
    // window opened after an await is treated as a popup and blocked.
    const tab = window.open("", "_blank");
    if (tab) {
      try { tab.opener = null; } catch (_) {}
    }
    try {
      const response = await fetch(`/api/platform/form-runs/report-file?run_id=${selectedRun.id}`);
      const data = await response.json();
      if (data.success && data.file?.url) {
        if (tab) tab.location.href = data.file.url;
        else window.open(data.file.url, "_blank", "noopener,noreferrer");
      } else {
        if (tab) tab.close();
        notify(t("platformMisc.runs.reportFileOpenFailed"));
      }
    } catch (_) {
      if (tab) tab.close();
      notify(t("platformMisc.runs.reportFileOpenFailed"));
    }
  };

  // Show exactly what the report writer is given — including how much of a long
  // document it actually reads, so an attachment never looks fully used when it
  // is not.
  const toggleReportFileText = async () => {
    if (!selectedRun) return;
    if (reportFileTextOpen) {
      setReportFileTextOpen(false);
      return;
    }
    setReportFileTextOpen(true);
    if (reportFileText && !reportFileText.error) return; // already read once
    setReportFileText({ loading: true });
    try {
      const response = await fetch(`/api/platform/form-runs/report-file?run_id=${selectedRun.id}&text=1`);
      const data = await response.json();
      if (data.success) {
        setReportFileText({ text: data.text || "", prompt_limit: data.prompt_limit || null });
      } else {
        setReportFileText({ error: true });
      }
    } catch (_) {
      setReportFileText({ error: true });
    }
  };

  const removeReportFile = async () => {
    if (!selectedRun || reportFileBusy) return;
    if (!(await confirm({ message: t("platformMisc.runs.reportFileRemoveConfirm"), tone: "danger" }))) return;
    setReportFileBusy(true);
    try {
      const response = await fetch(`/api/platform/form-runs/report-file?run_id=${selectedRun.id}`, { method: "DELETE" });
      const data = await response.json();
      if (data.success) {
        setReportFile(null);
        setReportFileText(null);
        setReportFileTextOpen(false);
        setPreviewNonce((previousNonce) => previousNonce + 1);
        notify(t("platformMisc.runs.reportFileRemoved"));
      } else {
        notify(data.error ? t(data.error) : t("platformMisc.runs.reportFileRemoveFailed"));
      }
    } catch (_) {
      notify(t("platformMisc.runs.reportFileRemoveFailed"));
    }
    setReportFileBusy(false);
  };

  return {
    handleSaveSettings,
    regenerateReport,
    uploadReportFile,
    openReportFile,
    toggleReportFileText,
    removeReportFile,
  };
}
