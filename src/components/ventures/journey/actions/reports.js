/**
 * Progress reports
 *
 * Opening the composer, then saving it — as a draft or as a sent report.
 *
 * Cut out of src/components/ventures/JourneyManagerPanel.js as-is: no state of
 * its own, no reads. The panel keeps every state value and every read, and hands
 * this factory what it reads through `values` — plus what the factories above
 * it return. The names it need are listed in the signature — nothing else.
 */



export function reportWrites({
  t,
  setReportFor,
  setReportForm,
  reportForm,
  notify,
  setReportSaving,
  ventureId,
  refreshReports,
}) {
  const reportStatusLabel = (status) =>
    t(`venture.manager.reportStatuses.${["draft", "submitted", "reviewed", "archived"].includes(status) ? status : "draft"}`);

  /** A textarea of bullet lines → the array the report stores (one per line). */
  const linesToArray = (text) =>
    String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);

  const openReportComposer = (stage, kind = "progress") => {
    setReportFor(stage.id);
    setReportForm({
      kind,
      title: kind === "closing" ? t("venture.manager.closingReportTitle", { name: stage.name }) : "",
      period: "",
      summary: "",
      completed: "",
      outstanding: "",
      support: "",
      challenges: "",
      recommendation: "",
    });
  };

  /** Save the report this journey is owed, optionally submitting it to Super Admin. */
  const saveReport = async (stage, submit) => {
    const form = reportForm || {};
    if (!String(form.title || "").trim()) {
      notify(t("venture.manager.reportTitleRequired"), "error");
      return;
    }
    setReportSaving(true);
    try {
      const res = await fetch(`/api/ventures/${ventureId}/progress-reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: String(form.title).trim(),
          journey_stage_id: stage.id,
          report_kind: form.kind || "progress",
          reporting_period: form.period || null,
          summary: form.summary || null,
          completed_items: linesToArray(form.completed),
          outstanding_items: linesToArray(form.outstanding),
          support_delivered: form.support || null,
          challenges: form.challenges || null,
          recommendation: form.recommendation || null,
        }),
      });
      const payload = await res.json();
      if (!payload.success) {
        notify(payload.error || t("venture.manager.actionFailed"), "error");
        return;
      }
      if (submit) {
        await fetch(`/api/ventures/${ventureId}/progress-reports`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: payload.id, status: "submitted" }),
        });
      }
      notify(t(submit ? "venture.manager.reportSubmitted" : "venture.manager.reportSaved"));
      setReportFor(null);
      setReportForm(null);
      refreshReports();
    } catch (_) {
      notify(t("venture.manager.actionFailed"), "error");
    } finally {
      setReportSaving(false);
    }
  };

  return {
    reportStatusLabel,
    linesToArray,
    openReportComposer,
    saveReport,
  };
}
