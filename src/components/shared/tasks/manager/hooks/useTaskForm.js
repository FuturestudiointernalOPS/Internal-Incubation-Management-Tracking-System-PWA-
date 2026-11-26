"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { uploadTaskAttachment } from "@/lib/storage";
import { notify } from "@/lib/notify";

/**
 * The new-task form: its fields, the project picker, the attachment, and the
 * write.
 *
 * The form can be opened from OUTSIDE the board (the standup "Add Task" shortcut
 * bumps a counter), and it stays open across several saves so a person can add a
 * week of work in one sitting — so "is it open" is not the same as "has it been
 * dismissed", and closing records the exact counter value it dismissed.
 */
export default function useTaskForm({
  mode,
  projectId,
  projects,
  userId,
  userName,
  effectiveWeekInfo,
  requestNewTask,
  onTasksChange,
  t,
}) {
  const uid = userId;

  const [form, setForm] = useState({
    name: "",
    description: "",
    project_id: "",
    category: "",
    assigned_to: "",
    priority: "medium",
    start_date: "",
    due_date: "",
    start_time: "",
    due_time: "",
    link: "",
  });

  // New-task file attachment
  const [taskFile, setTaskFile] = useState(null);
  const [pendingParentTaskId, setPendingParentTaskId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [addedCount, setAddedCount] = useState(0);

  const [availableCategories, setAvailableCategories] = useState([]);

  const [projectSearch, setProjectSearch] = useState("");
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const projectDropdownRef = useRef(null);

  // The creation form is open when either the person opened it, or the parent
  // asked for it by bumping the counter (the standup "Add Task" shortcut).
  // Closing clears the local half and records the exact counter value it
  // dismissed, so a signal that is still up does not reopen the form, while a
  // later bump (a larger value) does.
  const [formOpen, setFormOpen] = useState(false);
  const [dismissedRequest, setDismissedRequest] = useState(0);
  const showTaskForm = formOpen || requestNewTask > dismissedRequest;

  // Opening the form is also where its project is seeded in project mode: that
  // reset belongs to the action that opens the control, not to an effect
  // watching the flag.
  const openTaskForm = useCallback(() => {
    if (mode === "project" && projectId) {
      setForm((previousForm) => ({
        ...previousForm,
        project_id: String(projectId),
      }));
    }
    setFormOpen(true);
  }, [mode, projectId]);

  const handleCloseForm = useCallback(() => {
    setFormOpen(false);
    // Dismiss the parent's request at the value it was made with, so a signal
    // still up cannot immediately reopen the form.
    setDismissedRequest(requestNewTask);
    setPendingParentTaskId(null);
    setAddedCount(0);
    setForm({
      name: "",
      description: "",
      project_id: "",
      category: "",
      assigned_to: "",
      priority: "medium",
      start_date: "",
      due_date: "",
      start_time: "",
      due_time: "",
      link: "",
    });
  }, [requestNewTask]);

  // Close project dropdown on outside click
  useEffect(() => {
    if (!showProjectDropdown) return;
    const handler = (event) => {
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(event.target)
      ) {
        setShowProjectDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showProjectDropdown]);

  // Fetch available categories from API
  useEffect(() => {
    fetch("/api/categories")
      .then((response) => response.json())
      .then((payload) => {
        if (payload.success)
          setAvailableCategories(
            payload.categories.map((category) => category.name),
          );
      })
      .catch(() => {});
  }, []);

  // ── Available projects / categories ──
  const selectedProject = projects.find(
    (project) => String(project.id) === String(form.project_id),
  );
  const filteredProjects = projects.filter((project) => {
    if (!projectSearch) return true;
    return project.name?.toLowerCase().includes(projectSearch.toLowerCase());
  });

  const validateTaskDates = (start, due) => {
    const today = new Date().toISOString().split("T")[0];
    if (start && start < today) return "Start date cannot be in the past.";
    if (start && due && due < start)
      return "Due date cannot be earlier than the start date.";
    return null;
  };

  const attachFileToTask = async (taskId, file) => {
    const upload = await uploadTaskAttachment(file, taskId);
    if (!upload.success)
      return { success: false, error: upload.error || "Upload failed" };
    try {
      const res = await fetch("/api/tasks/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_id: taskId,
          name: file.name,
          url: upload.url,
          type: "file",
          file_name: file.name,
          file_size: file.size,
        }),
      });
      const data = await res.json();
      return { success: !!data?.success, error: data?.error };
    } catch (error) {
      console.error("Attach file to task error:", error);
      return { success: false, error: "Upload failed" };
    }
  };

  // ── API: Create task ──
  const createTask = useCallback(
    async (taskData) => {
      const week = effectiveWeekInfo || { week: 0, year: 0 };
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskData.title,
          description: taskData.description || null,
          project_id: taskData.project_id || null,
          category: taskData.category || null,
          user_id: uid,
          user_name: userName || "User",
          status: "in_progress",
          parent_task_id: taskData.parent_task_id || null,
          created_week: week.week || 0,
          created_year: week.year || 0,
          start_date: taskData.start_date || null,
          end_date: taskData.due_date || null,
          assigned_to: taskData.assigned_to || null,
          link: taskData.link || null,
          priority: taskData.priority || "medium",
        }),
      });
      return await res.json();
    },
    [uid, userName, effectiveWeekInfo],
  );

  // ── Submit new task from form ──
  const handleAddTask = useCallback(async () => {
    if (creating) return;
    if (!form.name.trim()) return;
    if (!form.project_id && !form.category) return;
    const dateError = validateTaskDates(form.start_date, form.due_date);
    if (dateError) {
      notify("error", dateError);
      return;
    }

    setCreating(true);
    try {
      const data = await createTask({
        title: form.name.trim(),
        description: form.description || null,
        project_id: form.project_id || null,
        category: form.category || null,
        parent_task_id: pendingParentTaskId || null,
        assigned_to: form.assigned_to || null,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        link: form.link || null,
        priority: form.priority || "medium",
      });

      if (data.success) {
        if (taskFile && data.id) {
          const attach = await attachFileToTask(data.id, taskFile);
          if (!attach.success) {
            notify(
              "error",
              t(attach.error || "Upload failed") ||
                attach.error ||
                "Upload failed",
            );
          }
        }
        setTaskFile(null);
        setForm((previousForm) => ({
          ...previousForm,
          name: "",
          start_date: "",
          due_date: "",
          start_time: "",
          due_time: "",
        }));
        setPendingParentTaskId(null);
        setAddedCount((previousCount) => previousCount + 1);
        if (onTasksChange) onTasksChange();
        if (typeof window !== "undefined") {
          window.__refreshDashboard?.();
          window.__refreshAdminDashboard?.();
        }
      } else {
        notify("error", data.error || t("errors.taskCreateFailed"));
      }
    } catch (error) {
      console.error("Create task error:", error);
      notify(
        "error",
        t("errors.somethingWrong") || "Something went wrong. Please try again.",
      );
    } finally {
      setCreating(false);
    }
  }, [
    form,
    pendingParentTaskId,
    createTask,
    onTasksChange,
    creating,
    taskFile,
    t,
  ]);

  return {
    form,
    setForm,
    showTaskForm,
    openTaskForm,
    handleCloseForm,
    handleAddTask,
    creating,
    addedCount,
    pendingParentTaskId,
    setPendingParentTaskId,
    taskFile,
    setTaskFile,
    availableCategories,
    validateTaskDates,
    createTask,
    attachFileToTask,
    projectPicker: {
      projectDropdownRef,
      projectSearch,
      setProjectSearch,
      showProjectDropdown,
      setShowProjectDropdown,
      filteredProjects,
      selectedProject,
    },
  };
}