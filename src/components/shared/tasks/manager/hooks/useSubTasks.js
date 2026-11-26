"use client";

import { useState, useCallback } from "react";
import { notify } from "@/lib/notify";

/**
 * The sub-task popup's state and its write.
 *
 * A sub-task inherits its parent's project and category, so the popup only
 * collects the parts that are its own: what it is, who it goes to, when, and an
 * optional attachment. The shared create call and the date rule come from the
 * form hook, so a sub-task is created exactly the way a task is.
 */
export default function useSubTasks({
  onTasksChange,
  t,
  createTask,
  attachFileToTask,
  validateTaskDates,
}) {
  // subTaskModal: { id, project_id, category, title } or null
  const [subTaskModal, setSubTaskModal] = useState(null);
  const [subTaskInput, setSubTaskInput] = useState("");
  const [subTaskDescription, setSubTaskDescription] = useState("");
  const [subTaskPriority, setSubTaskPriority] = useState("medium");
  const [subTaskAssignedTo, setSubTaskAssignedTo] = useState("");
  const [subTaskStartDate, setSubTaskStartDate] = useState("");
  const [subTaskEndDate, setSubTaskEndDate] = useState("");
  const [subTaskLink, setSubTaskLink] = useState("");
  const [subTaskSuccess, setSubTaskSuccess] = useState("");
  const [subTaskFile, setSubTaskFile] = useState(null);

  // ── Open sub-task popup modal ──
  const openSubTask = useCallback(
    (parentId, parentProjectId, parentCategory, parentTitle) => {
      setSubTaskModal({
        id: parentId,
        project_id: parentProjectId,
        category: parentCategory,
        title: parentTitle,
      });
      setSubTaskInput("");
    },
    [],
  );

  const addSubTaskFromModal = useCallback(async () => {
    const name = subTaskInput.trim();
    if (!name || !subTaskModal) return;
    const dateError = validateTaskDates(subTaskStartDate, subTaskEndDate);
    if (dateError) {
      notify("error", dateError);
      return;
    }
    try {
      const data = await createTask({
        title: name,
        description: subTaskDescription || null,
        project_id: subTaskModal.project_id || null,
        category: subTaskModal.category || null,
        parent_task_id: subTaskModal.id,
        assigned_to: subTaskAssignedTo || null,
        priority: subTaskPriority || "medium",
        start_date: subTaskStartDate || null,
        due_date: subTaskEndDate || null,
        link: subTaskLink || null,
      });

      if (data.success) {
        if (subTaskFile && data.id) {
          const attach = await attachFileToTask(data.id, subTaskFile);
          if (!attach.success) {
            notify(
              "error",
              t(attach.error || "Upload failed") ||
                attach.error ||
                "Upload failed",
            );
          }
        }
        setSubTaskFile(null);
        setSubTaskInput("");
        setSubTaskDescription("");
        setSubTaskAssignedTo("");
        setSubTaskPriority("medium");
        setSubTaskStartDate("");
        setSubTaskEndDate("");
        setSubTaskLink("");
        setSubTaskSuccess("Sub-task added!");
        setTimeout(() => setSubTaskSuccess(""), 2000);
        if (onTasksChange) onTasksChange();
        if (typeof window !== "undefined") {
          window.__refreshDashboard?.();
          window.__refreshAdminDashboard?.();
        }
      }
    } catch (error) {
      console.error("Add sub-task error:", error);
      notify(
        "error",
        t("errors.somethingWrong") || "Something went wrong. Please try again.",
      );
    }
  }, [
    subTaskInput,
    subTaskDescription,
    subTaskAssignedTo,
    subTaskPriority,
    subTaskModal,
    subTaskStartDate,
    subTaskEndDate,
    subTaskLink,
    subTaskFile,
    createTask,
    onTasksChange,
    t,
  ]);

  return {
    subTaskModal,
    setSubTaskModal,
    subTaskInput,
    setSubTaskInput,
    subTaskDescription,
    setSubTaskDescription,
    subTaskPriority,
    setSubTaskPriority,
    subTaskAssignedTo,
    setSubTaskAssignedTo,
    subTaskStartDate,
    setSubTaskStartDate,
    subTaskEndDate,
    setSubTaskEndDate,
    subTaskLink,
    setSubTaskLink,
    subTaskSuccess,
    subTaskFile,
    setSubTaskFile,
    openSubTask,
    addSubTaskFromModal,
  };
}