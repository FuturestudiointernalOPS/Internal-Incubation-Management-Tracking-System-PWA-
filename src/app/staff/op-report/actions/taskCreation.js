/**
 * Creating a task from the week picker.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 * 9 names this module reads into taskCreationActions().
 */

import { getCurrentWeek } from "@/components/staff/op-report/dates";

export function taskCreationActions({
  newTaskForm,
  notify,
  refreshTasks,
  setCreatingTask,
  setNewTaskForm,
  setTaskCreationOpen,
  t,
  user,
  weekInfo,
}) {
  // Create a new task immediately via the existing tasks API, then refresh.
  const handleCreateNewTask = async () => {
    if (!newTaskForm.name.trim()) return;
    if (
      newTaskForm.start_date &&
      newTaskForm.due_date &&
      newTaskForm.due_date < newTaskForm.start_date
    ) {
      notify(t("errors.dueDateBeforeStartDate"), "error");
      return;
    }
    setCreatingTask(true);
    try {
      const week = weekInfo || getCurrentWeek();
      const userId = user?.cid || user?.id;
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTaskForm.name.trim(),
          project_id: newTaskForm.project_id || null,
          user_id: userId,
          user_name: user?.name || "User",
          status: "in_progress",
          created_week: week.week,
          created_year: week.year,
          start_date: newTaskForm.start_date || null,
          end_date: newTaskForm.due_date || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setTaskCreationOpen(false);
        setNewTaskForm({
          name: "",
          project_id: "",
          category: "",
          start_date: "",
          start_time: "",
          due_date: "",
          due_time: "",
          collaborator: "",
          collaborator_note: "",
          project_search: "",
          show_dropdown: false,
        });
        notify(t("staff.opReport.tasksCreated", { count: 1 }));
        refreshTasks();
      } else {
        notify(data.error || t("errors.taskCreateFailed"), "error");
      }
    } catch (error) {
      console.error("Create task error:", error);
      notify(
        t("errors.somethingWrong") || "Something went wrong. Please try again.",
        "error",
      );
    } finally {
      setCreatingTask(false);
    }
  };

  return {
    handleCreateNewTask,
  };
}
