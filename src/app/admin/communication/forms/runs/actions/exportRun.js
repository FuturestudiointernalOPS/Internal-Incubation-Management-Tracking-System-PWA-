/**
 * The shared export dataset (one row per participant) and its download.
 *
 * Cut out of src/app/platform/runs/page.js as-is: no state, no React, no read of
 * its own. The page keeps every state value and every data read, and passes the
 * 11 values this module reads into
 * runExportActions().
 */



export function runExportActions({
  emailLog,
  evaluations,
  fieldLabels,
  notify,
  runFormFields,
  selectedRun,
  selectedSet,
  setShowExportOptions,
  submissionAnswers,
  t,
  visibleSubmissions,
}) {
  // ─── Export (shared dataset: Overview = Messaging = Export) ───
  // Always one row per participant. Each form question becomes a COLUMN;
  // answers stay in the participant's row. No joins/arrays/events may ever
  // duplicate a participant.
  const buildExportRows = (submissionList) => {
    const seen = new Set();
    const unique = submissionList.filter((submission) => {
      if (seen.has(submission.id)) return false;
      seen.add(submission.id);
      return true;
    });

    // Form questions as ordered columns (hidden fields already excluded).
    // Fall back to fieldLabels when the field list has not loaded yet.
    const questionFields = runFormFields.length > 0
      ? runFormFields.map((field) => ({ id: String(field.id), label: field.label }))
      : Object.entries(fieldLabels)
          .filter(([, label]) => label)
          .map(([id, label]) => ({ id, label }));

    const headers = [
      t("platformMisc.runs.colSn"),
      t("platformMisc.runs.colName"),
      t("platformMisc.runs.colEmail"),
      ...questionFields.map((questionField) => questionField.label),
      t("platformMisc.runs.colAiScore"),
      t("platformMisc.runs.colApprovalEmail"),
      t("platformMisc.runs.colActivationEmail"),
      t("platformMisc.runs.colAccountStatus"),
    ];

    const rows = unique.map((submission, index) => {
      const evalRow = evaluations.find((evaluation) => evaluation.submission_id === submission.id);
      const activationEmail = emailLog
        .filter((email) => email.submission_id === submission.id && email.email_type === "activation")
        .slice(-1)[0];
      const approvalEmail = emailLog
        .filter((email) => email.submission_id === submission.id && email.email_type === "approval")
        .slice(-1)[0];
      const accountStatus = submission.account_status || (submission.account_activated
        ? "active"
        : submission.account_created
          ? "activation_pending"
          : "not_created");
      const answers = submissionAnswers(submission);
      const cells = [
        index + 1,
        submission.display_name || submission.submitter_name || submission.submitter_id,
        submission.email || "",
      ];
      for (const questionField of questionFields) cells.push(answers[questionField.label] ?? "");
      cells.push(
        evalRow != null ? evalRow.overall_score : (submission.data?._scores?.overall ?? ""),
        approvalEmail ? approvalEmail.status : "",
        activationEmail ? activationEmail.status : "",
        accountStatus,
      );
      return cells;
    });
    return { headers, rows };
  };

  const exportParticipants = async (format, scope) => {
    const source = scope === "selected"
      ? visibleSubmissions.filter((submission) => selectedSet.has(submission.id))
      : visibleSubmissions;
    if (!source.length) return;

    const { headers, rows } = buildExportRows(source);
    const baseName = `${selectedRun?.name || "run"}-participants`;

    if (format === "xlsx") {
      try {
        const { default: writeXlsxFile } = await import("write-excel-file/browser");
        await writeXlsxFile([headers, ...rows], { sheet: "Participants" }).toFile(`${baseName}.xlsx`);
      } catch (_) {
        notify(t("platformMisc.runs.excelExportFailed"));
      }
    } else {
      const escapeCsv = (value) => {
        const text = value == null ? "" : String(value);
        return `"${text.replace(/"/g, '""')}"`;
      };
      const csv = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows.map((row) => row.map(escapeCsv).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${baseName}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }
    setShowExportOptions(false);
  };

  return {
    buildExportRows,
    exportParticipants,
  };
}
