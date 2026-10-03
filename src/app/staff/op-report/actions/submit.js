/**
 * Submitting the stand-up, and opening the modal that submits it.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 * 19 names this module reads into submitActions().
 */

export function submitActions({
  checkDraft,
  clearDraft,
  form,
  isHistorical,
  notify,
  readOnly,
  refreshHistory,
  refreshReport,
  refreshTasks,
  reportType,
  setDraftAvailable,
  setSaving,
  setShowStandupModal,
  setShowTaskForm,
  setTaskRows,
  t,
  taskRows,
  user,
  weekInfo,
}) {
  // Opening the standup dialog asks the browser's stored draft whether there is
  // one, and offers it. Done where the dialog is opened rather than in an effect
  // watching it: the answer is a fact about storage, read when it is needed, and
  // in an effect the panel appeared without it for a frame - which is what the
  // fifty-millisecond delay in the old code was waiting for.
  const openStandupModal = () => {
    setShowStandupModal(true);
    if (!readOnly && !isHistorical) checkDraft();
    else setDraftAvailable(false);
  };

  const handleSubmit = async (status = "submitted") => {
    if (!user) return;

    setSaving(true);
    try {
      // First: create only NEW task rows as real tasks (skip existing ones already in DB)
      const userId = user.cid || user.id;
      // Use weekInfo (the viewed week) for both task creation AND standup — keep them in sync
      const weekData = weekInfo;

      // Map local row IDs to real DB IDs for parent_task_id resolution
      const idMapping = {};
      // Sort: parents before children so real IDs are available for sub-tasks
      const sortedRows = [...taskRows].sort((first, second) => {
        if (first.parent_task_id && !second.parent_task_id) return 1;
        if (!first.parent_task_id && second.parent_task_id) return -1;
        return 0;
      });
      for (const row of sortedRows) {
        if (!row.name.trim()) continue;
        // Skip rows that already exist in DB unless they are carryovers waiting to be created for the new week
        if (
          row.status !== null &&
          row.status !== undefined &&
          !row.is_carryover
        )
          continue;

        // Resolve the real parent_task_id: if the parent was just created in this batch,
        // use the real DB ID; otherwise use the provided parent_task_id as-is
        let resolvedParentId = row.parent_task_id || null;
        if (resolvedParentId && idMapping[resolvedParentId]) {
          resolvedParentId = idMapping[resolvedParentId];
        }

        // Use shared carry-over API if this row has an original DB task to migrate
        if (row.carried_over_from_task_id) {
          const carryoverResponse = await fetch("/api/tasks/carryover", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              task_id: row.carried_over_from_task_id,
              target_week: weekData.week,
              target_year: weekData.year,
              user_id: userId,
              user_name: user.name || "",
            }),
          });
          const carryoverData = await carryoverResponse.json();
          if (carryoverData.success) {
            idMapping[row.id] = carryoverData.id;
          }
        } else {
          const taskResponse = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: row.name.trim(),
              description: row.description || null,
              project_id: row.project_id || null,
              category: row.category || null,
              user_id: userId,
              user_name: user.name || "",
              status: row.is_carryover
                ? row.status || "in_progress"
                : "in_progress",
              created_week: weekData.week,
              created_year: weekData.year,
              parent_task_id: resolvedParentId,
              start_date: row.start_date
                ? `${row.start_date}${row.start_time ? `T${row.start_time}:00` : ""}`
                : null,
              end_date: row.due_date
                ? `${row.due_date}${row.due_time ? `T${row.due_time}:00` : ""}`
                : null,
            }),
          });
          const taskData = await taskResponse.json();
          if (taskData.success) {
            idMapping[row.id] = taskData.id;
          }
        }
      }

      // Then: submit the report
      const body = {
        user_id: user.cid || user.id,
        user_name: user.name || "",
        user_role: user.role || "staff",
        report_type: reportType,
        week_number: weekInfo.week,
        year: weekInfo.year,
        status,
        // Stand-up structured fields
        top_priorities: JSON.stringify(form.top_priorities),
        expected_deliverables: JSON.stringify(form.expected_deliverables),
        projects_tasks: form.projects_tasks || null,
        has_dependencies: form.has_dependencies,
        dependency_note: form.dependency_note || null,
        has_blockers: form.has_blockers,
        blocker_description: form.blocker_description || null,
        needs_support: form.needs_support,
        support_note: form.support_note || null,
        additional_notes: form.additional_notes || null,
        // Retro fields (passthrough)
        completed_work: form.completed_work || null,
        unfinished_tasks: form.unfinished_tasks || null,
        challenges: form.challenges || null,
        wins: JSON.stringify(form.wins || []),
        carryover_items: JSON.stringify(form.carryover_items || []),
        retro_notes: form.retro_notes || null,
      };
      const response = await fetch("/api/op-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (data.success) {
        notify(
          status === "submitted"
            ? t("reports.reportSubmitted")
            : t("reports.reportSaved"),
          "success",
        );
        clearDraft();
        setTaskRows([]);
        setShowTaskForm(false);
        refreshReport();
        refreshHistory();
        refreshTasks();
      } else {
        notify(
          t(data.error || t("reports.failedToSave") || "") ||
            data.error ||
            t("reports.failedToSave"),
          "error",
        );
      }
    } catch {
      notify(t("errors.networkError"), "error");
    } finally {
      setSaving(false);
    }
  };

  return {
    openStandupModal,
    handleSubmit,
  };
}
