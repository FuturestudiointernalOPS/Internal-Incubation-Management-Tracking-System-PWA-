/**
 * Curriculum actions — requirements and their reminders.
 *
 * Extracted verbatim from curriculum.js so the barrel and each module stay
 * within the line guardrail. Handler names, request URLs, payloads and
 * behaviour are unchanged.
 */

export function curriculumRequirementActions({
  t,
  notify,
  id,
  newRequirement,
  selectedSessionId,
  setNewRequirement,
  setShowRequirementModal,
  setNewSession,
  setIsSaving,
  fetchProgramData,
  setSelectedSessionId,
}) {
  const addRequirement = async (shouldClose = true) => {
    if (!newRequirement.title.trim()) return;
    if (!newRequirement.kpi_ids || newRequirement.kpi_ids.length === 0) {
      notify(t("pmMisc.workspace.kpiLinkRequired"), "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_requirement",
          program_id: id,
          session_id: selectedSessionId,
          title: newRequirement.title,
          description: newRequirement.description,
          allowed_format: newRequirement.allowed_format,
          kpi_ids: newRequirement.kpi_ids || [],
          due_date: newRequirement.due_date || null,
          assignee_type: newRequirement.assignee_type || "all",
          assignee_id: newRequirement.assignee_id || "",
          resource_url: newRequirement.resource_url || null,
          resource_label: newRequirement.resource_label || null,
          weight: 1,
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.added"));
        if (shouldClose) setShowRequirementModal(false);
        setNewRequirement({
          title: "",
          description: "",
          allowed_format: "pdf",
          kpi_ids: [],
          due_date: "",
          assignee_type: "all",
          assignee_id: "",
          resource_url: "",
          resource_label: "",
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

  const handleOpenRequirementForSession = (session) => {
    setSelectedSessionId(session.id);
    // Pre-populate KPIs from the session (handle JSON string or array)
    let sessionKpiIds = session.kpi_ids || [];
    if (typeof sessionKpiIds === "string") {
      try {
        sessionKpiIds = JSON.parse(sessionKpiIds);
      } catch (_) {
        sessionKpiIds = [];
      }
    }
    if (!Array.isArray(sessionKpiIds)) sessionKpiIds = [];
    setNewRequirement((prev) => ({ ...prev, kpi_ids: sessionKpiIds }));
    setShowRequirementModal(true);
  };

  const handleSendRequirementReminder = async (requirement) => {
    try {
      const response = await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_reminder",
          requirement_id: requirement.id,
          program_id: id,
        }),
      });
      const data = await response.json();
      if (data.success) {
        const message =
          data.sent > 0
            ? t("pmMisc.workspace.reminderSentTo", { count: data.sent })
            : t("pmMisc.workspace.reminderSent");
        notify(message);
      } else {
        notify(t("pmMisc.workspace.reminderFailed"));
      }
    } catch {
      notify(t("pmMisc.workspace.reminderError"));
    }
  };

  const handleAddSessionRequirement = () => {
    setNewSession((prev) => ({
      ...prev,
      requirements: [
        ...(prev.requirements || []),
        { ...newRequirement, kpi_ids: prev.kpi_ids || [] },
      ],
    }));
    setNewRequirement({
      title: "",
      description: "",
      allowed_format: "pdf",
      kpi_ids: [],
      due_date: "",
      assignee_type: "all",
      assignee_id: "",
      resource_url: "",
      resource_label: "",
    });
  };

  return {
    addRequirement,
    handleOpenRequirementForSession,
    handleSendRequirementReminder,
    handleAddSessionRequirement,
  };
}
