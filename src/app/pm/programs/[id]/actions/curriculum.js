/**
 * Curriculum actions: sessions, requirements and the materials attached to them,
 * plus the KPI toggle the session and requirement modals share. One factory per
 * screen concern — the page keeps every state value and hands this module the
 * values it reads.
 */
import { getWeekNumber } from "@/lib/constants";

export function curriculumActions({
  t,
  notify,
  id,
  kpis,
  sessions,
  newSession,
  selectedSessionId,

  newRequirement,
  newSessionMaterial,
  program,
  programTeamMembers,
  assignedStaff,
  expandedSessionId,
  setSessions,
  setShowSessionModal,
  setShowRequirementModal,
  setShowAttendanceModal,
  setShowPMReportModal,
  setNewSession,
  setNewRequirement,
  setNewSessionMaterial,
  setExpandedSessionId,
  setSelectedSessionId,
  setSelectedSessionForAttendance,
  setConfirmTarget,
  setIsSaving,
  fetchProgramData,
}) {
  const toggleKpi = (type, kpiId) => {
    if (type === "session") {
      setNewSession((prev) => {
        const ids = prev.kpi_ids || [];
        const next = ids.includes(kpiId)
          ? ids.filter((id) => id !== kpiId)
          : [...ids, kpiId];
        return { ...prev, kpi_ids: next };
      });
    } else {
      setNewRequirement((prev) => {
        const ids = prev.kpi_ids || [];
        const next = ids.includes(kpiId)
          ? ids.filter((id) => id !== kpiId)
          : [...ids, kpiId];
        return { ...prev, kpi_ids: next };
      });
    }
  };

  /** Close the session form. */
  const closeSessionModal = () => {
    setShowSessionModal(false);
  };

  const addSession = async () => {
    if (!newSession.title.trim()) return;
    if (
      kpis.length > 0 &&
      (!newSession.kpi_ids || newSession.kpi_ids.length === 0)
    ) {
      notify(t("pmMisc.workspace.kpiRequired"), "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_session",
          program_id: id,
          title: newSession.title,
          week_number: newSession.week_number,
          status: newSession.status,
          handler_id: (newSession.handler_ids || []).join(","),
          handler_name: (newSession.handler_names || []).join(", "),
          kpi_ids: newSession.kpi_ids || [],
          scheduled_date: newSession.scheduled_date || null,
          start_time: newSession.start_time || null,
          end_time: newSession.end_time || null,
          notes: newSession.notes || null,
          extra_materials: newSession.extra_materials || [],
          requirements: newSession.requirements || [],
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(t("pmMisc.workspace.added"));
        setShowSessionModal(false);
        setNewSession({
          title: "",
          week_number:
            sessions.length > 0
              ? Math.max(
                  ...sessions.map((session) => session.week_number || 0),
                ) + 1
              : 1,
          status: "pending",
          kpi_ids: [],
          handler_ids: [],
          handler_names: [],
          scheduled_date: "",
          start_time: "",
          end_time: "",
          notes: "",
          extra_materials: [],
          requirements: [],
        });
        fetchProgramData(true);
      } else
        notify(
          t(data.error || t("pmMisc.workspace.addFailed") || "") ||
            data.error ||
            t("pmMisc.workspace.addFailed"),
          "error",
        );
    } catch {
      notify(t("pmMisc.workspace.networkError"), "error");
    } finally {
      setIsSaving(false);
    }
  };

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

  const updateSessionStatus = async (sessionId, status) => {
    // Optimistic Update
    const previousSessions = [...sessions];
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId ? { ...session, status } : session,
      ),
    );

    try {
      const response = await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_status",
          program_id: id,
          id: sessionId,
          status,
        }),
      });
      const data = await response.json();
      if (data.success) {
        notify(
          t("pmMisc.workspace.statusUpdatedTo", {
            status: status.toUpperCase(),
          }),
        );
        // Sync with server just in case
        fetchProgramData(true);
      } else {
        setSessions(previousSessions);
        notify(t("pmMisc.workspace.statusUpdateFailed"), "error");
      }
    } catch {
      setSessions(previousSessions);
      notify(t("pmMisc.workspace.statusUpdateFailed"), "error");
    }
  };

  const updateSessionField = async (
    sessionId,
    field,
    value,
    handlerName = null,
  ) => {
    // Optimistic update: apply to local state immediately
    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId ? { ...session, [field]: value } : session,
      ),
    );

    try {
      const response = await fetch("/api/pm/curriculum", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program_id: id,
          sessionId,
          field,
          value,
          handlerName,
        }),
      });
      const data = await response.json();
      if (data.success) {
        const silentFields = ["title", "description", "notes"];
        if (!silentFields.includes(field)) {
          notify(t("pmMisc.workspace.sessionFieldSynced"));
        }
        fetchProgramData(true);

        // When a staff member is assigned, create a task for their calendar
        if (field === "handler_id" && value && handlerName) {
          const session = sessions.find(
            (candidate) => candidate.id === sessionId,
          );
          if (session) {
            const now = new Date();
            const weekNumber = getWeekNumber(now);
            const year = now.getFullYear();

            await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                user_id: value,
                user_name: handlerName,
                title: `${session.title || "Session"} - ${program?.name || "Program"}`,
                description: `Assigned session for week ${session.week_number}`,
                status: "pending",
                created_week: weekNumber,
                created_year: year,
                start_date: session.scheduled_date || null,
                end_date: session.end_date || null,
                category: "curriculum",
              }),
            });
          }
        }
      } else {
        if (response.status === 401) {
          notify(t("pmMisc.workspace.sessionExpired"), "error");
        } else {
          notify(
            t(data.error || t("pmMisc.workspace.fieldSyncFailed") || "") ||
              data.error ||
              t("pmMisc.workspace.fieldSyncFailed"),
            "error",
          );
        }
      }
    } catch {
      notify(t("pmMisc.workspace.fieldSyncFailed"), "error");
    }
  };

  const deleteSession = (sessionId) => {
    setConfirmTarget({
      id: sessionId,
      message: t("pmMisc.workspace.confirmArchiveSession"),
      onConfirm: () => performDeleteSession(sessionId),
    });
  };

  const performDeleteSession = async (sessionId) => {
    try {
      await fetch("/api/pm/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_status",
          program_id: id,
          id: sessionId,
          status: "archived",
        }),
      });
      notify(t("pmMisc.workspace.sessionArchived"));
      fetchProgramData(true);
    } catch {}
  };

  const handleAddSession = () => {
    const nextWeekNumber =
      sessions.length > 0
        ? Math.max(...sessions.map((session) => session.week_number || 0)) + 1
        : 1;
    setNewSession({
      title: "",
      week_number: nextWeekNumber,
      status: "pending",
      kpi_ids: [],
      handler_ids: [],
      handler_names: [],
      scheduled_date: "",
      start_time: "",
      end_time: "",
      notes: "",
      extra_materials: [],
    });
    setShowSessionModal(true);
  };

  const handleToggleSessionExpanded = (event, session) => {
    event.stopPropagation();
    setExpandedSessionId(expandedSessionId === session.id ? null : session.id);
  };

  const handleOpenSessionAttendance = (event, session) => {
    event.stopPropagation();
    setSelectedSessionId(session.id);
    setSelectedSessionForAttendance(session);
    setShowAttendanceModal(true);
  };

  const handleOpenSessionPMReport = (event, session) => {
    event.stopPropagation();
    setSelectedSessionId(session.id);
    setShowPMReportModal(true);
  };

  const handleToggleSessionLock = (event, session) => {
    event.stopPropagation();
    const newStatus = session.status === "locked" ? "not started" : "locked";
    updateSessionStatus(session.id, newStatus);
  };

  const handleDeleteSession = (event, session) => {
    event.stopPropagation();
    deleteSession(session.id);
  };

  const handleEditSessionDescription = (event, session) => {
    // Update local state only, save on blur
    const updated = sessions.map((item) =>
      item.id === session.id
        ? { ...item, description: event.target.value }
        : item,
    );
    setSessions(updated);
  };

  const handleToggleSessionHandler = (event, session, stringId) => {
    const checked = event.target.checked;
    let currentIds = [];
    try {
      currentIds = JSON.parse(session.handler_id || "[]");
      if (!Array.isArray(currentIds))
        currentIds = session.handler_id ? [session.handler_id] : [];
    } catch {
      currentIds = session.handler_id ? [session.handler_id] : [];
    }

    let newIds;
    if (checked) {
      newIds = [...new Set([...currentIds, stringId])];
    } else {
      newIds = currentIds.filter((id) => id !== stringId);
    }

    const staffList =
      programTeamMembers.length > 0 ? programTeamMembers : assignedStaff;
    const selectedStaff = staffList.filter((staff) =>
      newIds.includes(String(staff.cid)),
    );
    const selectedNames = selectedStaff.map((staff) => staff.name);

    updateSessionField(
      session.id,
      "handler_id",
      JSON.stringify(newIds),
      JSON.stringify(selectedNames),
    );
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

  const handleToggleSessionStaff = (staff) => {
    const handlerIds = newSession.handler_ids || [];
    const handlerNames = newSession.handler_names || [];
    const staffCid = String(staff.cid);
    if (handlerIds.includes(staffCid)) {
      const index = handlerIds.indexOf(staffCid);
      setNewSession((prev) => ({
        ...prev,
        handler_ids: handlerIds.filter((id) => id !== staffCid),
        handler_names: handlerNames.filter(
          (_, nameIndex) => nameIndex !== index,
        ),
      }));
    } else {
      setNewSession((prev) => ({
        ...prev,
        handler_ids: [...handlerIds, staffCid],
        handler_names: [...handlerNames, staff.name],
      }));
    }
  };

  const handleSessionMaterialFile = (event) => {
    const file = event.target.files?.[0];
    if (file)
      setNewSessionMaterial((prev) => ({
        ...prev,
        content: file.name,
        name: file.name,
      }));
  };

  const handleAttachSessionMaterial = () => {
    if (!newSessionMaterial.content.trim()) return;
    setNewSession((prev) => ({
      ...prev,
      extra_materials: [
        ...(prev.extra_materials || []),
        { ...newSessionMaterial },
      ],
    }));
    setNewSessionMaterial({
      type: "text",
      content: "",
      name: "",
    });
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
    toggleKpi,
    closeSessionModal,
    addSession,
    addRequirement,
    updateSessionStatus,
    updateSessionField,
    deleteSession,
    handleAddSession,
    handleToggleSessionExpanded,
    handleOpenSessionAttendance,
    handleOpenSessionPMReport,
    handleToggleSessionLock,
    handleDeleteSession,
    handleEditSessionDescription,
    handleToggleSessionHandler,
    handleOpenRequirementForSession,
    handleSendRequirementReminder,
    handleToggleSessionStaff,
    handleSessionMaterialFile,
    handleAttachSessionMaterial,
    handleAddSessionRequirement,
  };
}
