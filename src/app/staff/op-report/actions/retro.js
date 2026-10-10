/**
 * The retro: toggles and the task status change.
 *
 * Cut out of src/app/staff/op-report/page.js as-is: no state of its own, no
 * React. The page keeps every state value and every read, and passes the
 */
import { clearResponseCachePrefix } from "@/lib/hooks/useApi";

export function retroActions({
  notify,
  refreshTasks,
  setBlockerModal,
  setExpandedTasks,
  setExpandedWeek,
  setUpdatingTasks,
  t,
  updatingTasks,
}) {
  const handleToggleRetroWeek = (weekKey) =>
    setExpandedWeek((prev) => (prev === weekKey ? null : weekKey));

  const handleToggleRetroTask = async (task) => {
    if (updatingTasks[task.id]) return;
    setUpdatingTasks((prev) => ({
      ...prev,
      [task.id]: true,
    }));
    try {
      const newStatus =
        task.status === "completed" ? "in_progress" : "completed";
      let blocked = false;
      // If completing parent, cascade to all sub-tasks
      if (newStatus === "completed" && task.subtasks?.length > 0) {
        const subtaskResults = await Promise.all(
          task.subtasks.map(async (subtask) => {
            const response = await fetch("/api/tasks", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                id: subtask.id,
                status: "completed",
              }),
            });
            return {
              subtaskId: subtask.id,
              data: await response.json(),
            };
          }),
        );
        const blockedSubtasks = subtaskResults.filter(
          (result) => result.data?.hasActiveBlockers,
        );
        if (blockedSubtasks.length > 0) {
          blocked = true;
          notify(t("staff.opReport.blockerActive"), "error");
        }
      }
      if (!blocked) {
        const response = await fetch("/api/tasks", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: task.id,
            status: newStatus,
          }),
        });
        const data = await response.json();
        if (data.success === false && data.hasActiveBlockers) {
          notify(t("staff.opReport.blockerActive"), "error");
        } else {
          clearResponseCachePrefix("/api/tasks");
          refreshTasks();
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingTasks((prev) => ({
        ...prev,
        [task.id]: false,
      }));
    }
  };

  const handleToggleRetroSubtasks = (task) => {
    if (task.subtasks?.length > 0) {
      setExpandedTasks((prev) => ({
        ...prev,
        [task.id]: !prev[task.id],
      }));
    }
  };

  const handleToggleRetroSubtask = async (subtask) => {
    if (updatingTasks[subtask.id]) return;
    setUpdatingTasks((prev) => ({
      ...prev,
      [subtask.id]: true,
    }));
    try {
      const subtaskResponse = await fetch("/api/tasks", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: subtask.id,
          status: subtask.status === "completed" ? "in_progress" : "completed",
        }),
      });
      const subtaskData = await subtaskResponse.json();
      if (subtaskData.success === false && subtaskData.hasActiveBlockers) {
        notify(t("staff.opReport.blockerActive"), "error");
      } else {
        clearResponseCachePrefix("/api/tasks");
        refreshTasks();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setUpdatingTasks((prev) => ({
        ...prev,
        [subtask.id]: false,
      }));
    }
  };

  const handleOpenBlockerForTask = (task) =>
    setBlockerModal({
      type: "api",
      taskId: task.id,
    });

  const handleChangeRetroTaskStatus = async (task, event) => {
    const newStatus = event.target.value;
    if (updatingTasks[task.id]) return;
    setUpdatingTasks((prev) => ({
      ...prev,
      [task.id]: true,
    }));
    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: task.id,
          status: newStatus,
        }),
      });
      clearResponseCachePrefix("/api/tasks");
      refreshTasks();
      if (newStatus === "blocked") {
        setBlockerModal({
          type: "api",
          taskId: task.id,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingTasks((prev) => ({
        ...prev,
        [task.id]: false,
      }));
    }
  };

  return {
    handleToggleRetroWeek,
    handleToggleRetroTask,
    handleToggleRetroSubtasks,
    handleToggleRetroSubtask,
    handleOpenBlockerForTask,
    handleChangeRetroTaskStatus,
  };
}
