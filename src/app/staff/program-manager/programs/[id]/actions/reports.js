/**
 * Weekly-report actions: the PDF attachment upload, the structured weekly report
 * itself, and the CSV/XLSX/PDF export the reports tab offers.
 */

export function reportActions({
  t,
  notify,
  id,
  user,
  sessions,
  selectedSessionId,
  newPMReport,
  pmReportAttachments,
  setShowPMReportModal,
  setPmReportAttachments,
  setNewPMReport,
  setIsSaving,
  fetchProgramData,
}) {
  // Upload a PDF attachment for the weekly report (stored in Supabase storage).
  const handleReportAttachmentUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      notify(t("pmMisc.workspace.attachmentPdfOnly"), "error");
      event.target.value = "";
      return;
    }
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (data.success && data.url) {
        setPmReportAttachments((prev) => ({
          ...prev,
          type: "file",
          url: data.url,
        }));
        notify(t("pmMisc.workspace.attachmentUploaded"));
      } else {
        notify(
          t(data.error || t("pmMisc.workspace.attachmentUploadFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.attachmentUploadFailed"),
          "error",
        );
      }
    } catch (_) {
      notify(t("pmMisc.workspace.attachmentUploadFailed"), "error");
    } finally {
      setIsSaving(false);
      event.target.value = "";
    }
  };

  const submitPMReport = async () => {
    // Validate required fields
    if (
      !newPMReport.week_status ||
      !newPMReport.week_rating ||
      !newPMReport.main_topic?.trim()
    ) {
      notify(t("pmMisc.workspace.reportRequiredFields"), "error");
      return;
    }
    setIsSaving(true);
    try {
      const body = {
        action: "submit_pm_report",
        program_id: id,
        session_id: selectedSessionId,
        week_number: sessions.find(
          (session) => session.id === selectedSessionId,
        )?.week_number,
        summary: newPMReport.summary,
        status: newPMReport.status,
        pm_id: user.cid || user.id,
        // New structured fields
        week_status: newPMReport.week_status,
        week_rating: newPMReport.week_rating,
        main_topic: newPMReport.main_topic,
        // KPI-linked assignment tracking
        assignment_given: newPMReport.assignment_given,
        assignment_kpi_ids: newPMReport.assignment_kpi_ids,
        assignment_objective: newPMReport.assignment_objective || null,
        assignment_outcome: newPMReport.assignment_outcome || null,
        attendance_level: newPMReport.attendance_level || null,
        participation_level: newPMReport.participation_level || null,
        participants_need_attention: newPMReport.participants_need_attention,
        participants_attention_notes:
          newPMReport.participants_attention_notes || null,
        standout_participants: newPMReport.standout_participants,
        standout_notes: newPMReport.standout_notes || null,
        delivery_quality: newPMReport.delivery_quality || null,
        participant_understanding:
          newPMReport.participant_understanding || null,
        delivery_challenges: newPMReport.delivery_challenges,
        delivery_challenge_note: newPMReport.delivery_challenge_note || null,
        had_issues: newPMReport.had_issues,
        issue_types: newPMReport.issue_types,
        requires_admin_attention: newPMReport.requires_admin_attention,
        additional_issue_note: newPMReport.additional_issue_note || null,
        program_on_track: newPMReport.program_on_track,
        planned_adjustments: newPMReport.planned_adjustments || null,
        attachment_type: pmReportAttachments.type || null,
        attachment_url: pmReportAttachments.url || null,
      };
      const response = await fetch("/api/pm/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.reportTransmitted"));
        setShowPMReportModal(false);
        setPmReportAttachments({ type: "", url: "" });
        setNewPMReport({
          summary: "",
          status: "optimal",
          week_status: "",
          week_rating: "",
          main_topic: "",
          assignment_given: false,
          assignment_kpi_ids: [],
          assignment_objective: "",
          assignment_outcome: "",
          attendance_level: "",
          participation_level: "",
          participants_need_attention: false,
          participants_attention_notes: "",
          standout_participants: false,
          standout_notes: "",
          delivery_quality: "",
          participant_understanding: "",
          delivery_challenges: false,
          delivery_challenge_note: "",
          had_issues: false,
          issue_types: [],
          requires_admin_attention: false,
          additional_issue_note: "",
          program_on_track: true,
          planned_adjustments: "",
        });
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.failed") || "") ||
            data.error ||
            t("pmMisc.workspace.failed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportPmReport = async (type, format, label) => {
    try {
      const response = await fetch(
        `/api/pm/export?type=${type}&program_id=${id}&format=${format}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error("Export failed");
      if (format === "pdf") {
        const { rows: data, filename } = await response.json();
        const { default: jsPDF } = await import("jspdf");
        const doc = new jsPDF({ orientation: "landscape" });
        doc.setFontSize(12);
        doc.text(`${type.toUpperCase()} - Talent for Startups`, 10, 10);
        if (data && data.length > 0) {
          const headers = Object.keys(data[0]);
          let lineY = 20;
          doc.setFontSize(7);
          // Header row
          headers.forEach((header, columnIndex) =>
            doc.text(String(header), 10 + columnIndex * 35, lineY),
          );
          lineY += 5;
          // Data rows (max 40 rows per page)
          data.slice(0, 80).forEach((row, _ri) => {
            if (lineY > 180) {
              doc.addPage();
              lineY = 15;
            }
            headers.forEach((header, columnIndex) => {
              const cellValue = String(row[header] ?? "").substring(0, 20);
              doc.text(cellValue, 10 + columnIndex * 35, lineY);
            });
            lineY += 4;
          });
        }
        doc.save(filename);
      } else {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        const fileExtension = format === "xlsx" ? "xlsx" : "csv";
        anchor.href = url;
        anchor.download = `${type}-${id}.${fileExtension}`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      notify(t("pmMisc.workspace.exported", { label }));
    } catch {
      notify(t("pmMisc.workspace.exportFailed"), "error");
    }
  };

  return {
    handleReportAttachmentUpload,
    submitPMReport,
    handleExportPmReport,
  };
}
