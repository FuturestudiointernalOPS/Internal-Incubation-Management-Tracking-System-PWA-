"use client";

import { useState, useMemo, useCallback } from "react";

/**
 * The board itself: which week is on screen, which rows are shown, and the
 * status write.
 *
 * The list the board shows is the one the parent handed down plus the reordering
 * a person made on it. The reordering is recorded AGAINST the exact prop value it
 * was made on, so a parent re-read hands down a new list and shows it — a stale
 * drag can never survive a fresh read.
 */
export default function useBoard({ mode, taskList, weekInfo, onTasksChange }) {
  // Compute effective week info — fallback to current ISO week if not provided
  const effectiveWeekInfo = useMemo(() => {
    if (weekInfo?.week && weekInfo?.year) return weekInfo;
    const now = new Date();
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    const week1 = new Date(date.getFullYear(), 0, 4);
    const week =
      1 +
      Math.round(
        ((date.getTime() - week1.getTime()) / 86400000 -
          3 +
          ((week1.getDay() + 6) % 7)) /
          7,
      );
    return { week, year: now.getFullYear() };
  }, [weekInfo]);

  const [localOrder, setLocalOrder] = useState(null);
  const tasks = useMemo(
    () =>
      localOrder && localOrder.base === taskList
        ? localOrder.list
        : taskList || [],
    [localOrder, taskList],
  );

  // Which task is mid-write, so its row can show the pending state.
  const [updatingTasks, setUpdatingTasks] = useState({});

  // ── Tasks grouped by relevance ──
  const filteredTasks = useMemo(() => {
    if (mode === "standup" && effectiveWeekInfo) {
      return tasks.filter(
        (task) =>
          task.created_week === effectiveWeekInfo.week &&
          task.created_year === effectiveWeekInfo.year,
      );
    }
    return tasks;
  }, [tasks, mode, effectiveWeekInfo]);

  const carryOverTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          !["completed", "archived"].includes(task.status) &&
          task.created_week !== effectiveWeekInfo?.week &&
          !task.parent_task_id,
      ),
    [tasks, effectiveWeekInfo],
  );

  const activeTasks = useMemo(
    () =>
      filteredTasks
        .filter(
          (task) =>
            task.carried_over_from_task_id === null &&
            task.status !== "carried_over" &&
            task.status !== "archived" &&
            !task.parent_task_id,
        )
        .sort(
          (leftTask, rightTask) =>
            new Date(leftTask.created_at).getTime() -
            new Date(rightTask.created_at).getTime(),
        ),
    [filteredTasks],
  );

  // Move task up or down in the active list
  const moveTask = useCallback(
    (taskId, direction) => {
      const orderedTasks = tasks;
      const index = orderedTasks.findIndex((task) => task.id === taskId);
      if (index === -1) return;
      const targetIdx = direction === "up" ? index - 1 : index + 1;
      if (targetIdx < 0 || targetIdx >= orderedTasks.length) return;
      const updated = [...orderedTasks];
      [updated[index], updated[targetIdx]] = [updated[targetIdx], updated[index]];
      setLocalOrder({ base: taskList, list: updated });
    },
    [tasks, taskList],
  );

  // ── API: Update task status ──
  const updateStatus = useCallback(
    async (taskId, newStatus) => {
      if (updatingTasks[taskId]) return;
      setUpdatingTasks((previousUpdating) => ({
        ...previousUpdating,
        [taskId]: true,
      }));
      try {
        // If completing parent, cascade to sub-tasks
        if (newStatus === "completed") {
          const task = tasks.find((candidate) => candidate.id === taskId);
          if (task?.subtasks?.length > 0) {
            await Promise.all(
              task.subtasks.map((subtask) =>
                fetch("/api/tasks", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: subtask.id, status: "completed" }),
                }),
              ),
            );
          }
        }
        await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: taskId, status: newStatus }),
        });
        // Re-fetch via callback
        if (onTasksChange) onTasksChange();
        if (typeof window !== "undefined") {
          window.__refreshDashboard?.();
          window.__refreshAdminDashboard?.();
        }
      } catch (error) {
        console.error(error);
      } finally {
        setUpdatingTasks((previousUpdating) => ({
          ...previousUpdating,
          [taskId]: false,
        }));
      }
    },
    [tasks, updatingTasks, onTasksChange],
  );

  return {
    effectiveWeekInfo,
    tasks,
    filteredTasks,
    carryOverTasks,
    activeTasks,
    moveTask,
    updateStatus,
    updatingTasks,
  };
}